package vapi

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"go-backend/internal/graph/model"
	"go-backend/internal/utils"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ----------------------------------------------------------------------------
// VAPI VOICE-AGENT WEBHOOK
//
// Single endpoint, POST /vapi/webhook, HMAC-signed (VapiSignatureMiddleware
// runs before this handler). The dispatcher branches on tool name and reuses
// the shared booking ops in internal/utils — same source of truth as the
// GraphQL resolvers.
//
// TWO INCOMING FORMATS ARE SUPPORTED:
//
// 1. Envelope (Vapi's webhook/function tool type):
//
//	{ "message": { "type": "tool-calls", "toolCallList": [ { "id", "name",
//	  "arguments" } ] }, "call": { "id", "customer": { "number": { "e164" } } } }
//
//	→ responds { "results": [ { "toolCallId": "<same id>", "result": "..." } ] }
//
// 2. Bare arguments (Vapi's apiRequest tool type): Vapi posts ONLY the
//	arguments object built from the tool's body schema (plus any static body
//	fields) — there is no message envelope and no call block. The tool name is
//	inferred from which argument keys are present (see detectBareTool).
//
//	→ responds { "message": "..." } — apiRequest feeds the raw response body
//	  back to the voice model, so return the human-readable message (the
//	  key=value facts stay server-side in the call log).
//
// TOOL CONTRACT — the assistant's tool definitions in Vapi's dashboard must
// use these exact names and argument keys (camelCase or snake_case are both
// accepted per-argument):
//
//	check_availability        restaurantId/restaurant_id, partySize/party_size,
//	                          date (YYYY-MM-DD) + time (HH:MM), OR requestedTime/requested_time (ISO 8601)
//	find_or_create_customer  phone/phone_number, name/caller_name, email
//	create_booking           restaurantId, customerId, tableId (optional),
//	                          partySize, date + time, OR bookingTime (ISO 8601),
//	                          specialRequests, idempotencyKey (recommended — see below)
//	add_to_waitlist          restaurantId, customerId, partySize, date + time,
//	                          OR requestedTime (ISO 8601)
//
// TIME INTERPRETATION: if the args carry an ISO timestamp (requestedTime /
// bookingTime) it is used as-is. Otherwise a date+time pair is interpreted in
// the restaurant's OWN timezone (restaurants.timezone) — the voice model only
// echoes the wall-clock date/time the caller said, and never does timezone
// math (see utils.ResolveRestaurantInstant).
//
// IDEMPOTENCY: create_booking derives a fallback key (vapi:<callId>:<toolCallId>)
// when the tool doesn't send idempotencyKey. For strongest protection against
// Vapi webhook retries double-booking, define idempotencyKey in the tool
// definition (e.g. caller phone + requested time + party size).
// ----------------------------------------------------------------------------

// Handler holds the DB pool the webhook operations run against.
type Handler struct {
	DB *pgxpool.Pool
}

func NewHandler(db *pgxpool.Pool) *Handler {
	return &Handler{DB: db}
}

// --- wire types -------------------------------------------------------------

type toolCall struct {
	ID        string         `json:"id"`
	Name      string         `json:"name"`
	Arguments map[string]any `json:"arguments"`
}

type message struct {
	Type         string     `json:"type"`
	ToolCallList []toolCall `json:"toolCallList"`
}

type webhookRequest struct {
	Message message `json:"message"`
	Call    *struct {
		ID       string `json:"id"`
		Customer *struct {
			Number *struct {
				E164 string `json:"e164"`
			} `json:"number"`
		} `json:"customer"`
	} `json:"call"`
}

type toolResult struct {
	ToolCallID string `json:"toolCallId"`
	Result     string `json:"result"`
}

type webhookResponse struct {
	Results []toolResult `json:"results"`
}

// --- gin handler ------------------------------------------------------------

// Handle is the gin handler for POST /vapi/webhook.
func (h *Handler) Handle(c *gin.Context) {
	remote := c.ClientIP()

	body, err := c.GetRawData()
	if err != nil {
		log.Printf("🔴 VAPI WEBHOOK: rejected request from %s — cannot read body: %v", remote, err)
		c.JSON(http.StatusBadRequest, webhookResponse{})
		return
	}

	var req webhookRequest
	if err := json.Unmarshal(body, &req); err != nil {
		log.Printf("🔴 VAPI WEBHOOK: rejected request from %s — failed to decode payload: %v", remote, err)
		c.JSON(http.StatusBadRequest, webhookResponse{})
		return
	}

	callID := vapiCallID(req)
	phone := callerPhone(req)
	log.Printf("📥 VAPI WEBHOOK: received message type=%q callId=%s phone=%s tools=%d from %s",
		req.Message.Type, callID, phone, len(req.Message.ToolCallList), remote)

	ctx := c.Request.Context()

	// Format 1: the standard envelope ({message:{type:"tool-calls",toolCallList}})
	// sent by Vapi's webhook/function tool type.
	if req.Message.Type == "tool-calls" && len(req.Message.ToolCallList) > 0 {
		h.handleEnvelope(ctx, c, req, callID, phone)
		return
	}

	// Format 2: Vapi's apiRequest tool type POSTs the arguments object directly
	// (no envelope, no call block). Infer the tool from the argument keys.
	if name, args, ok := detectBareTool(body); ok {
		if args == nil {
			// Recognized tool whose arguments couldn't be parsed — tell the
			// model explicitly rather than acking with an empty results array.
			log.Printf("⚠️ VAPI WEBHOOK: bare tool call %q had unparseable arguments (callId=%q)", name, callID)
			c.JSON(http.StatusOK, gin.H{"message": "I couldn't read the booking details — please try again."})
			return
		}
		log.Printf("📥 VAPI WEBHOOK: apiRequest bare tool call name=%q args=%d callId=%q from %s",
			name, len(args), callID, remote)

		// Unique synthetic tool id per invocation: create_booking's idempotency
		// fallback is vapi:<callId>:<toolCallId>, and apiRequest bodies carry no
		// call id — a constant here would make every booking after the first
		// return the first booking via the idempotency lookup.
		toolID := fmt.Sprintf("api:%s:%d", name, time.Now().UnixNano())
		res := h.dispatch(ctx, toolCall{ID: toolID, Name: name, Arguments: args}, req)

		// Best-effort call log — only possible if the tool sent call info
		// (e.g. a static body field like callId: {{call.id}}).
		callLog := utils.CallLogEntry{VapiCallID: callID}
		if phone != "" {
			p := phone
			callLog.CustomerPhone = &p
		}
		mergeCallLog(&callLog, res)
		if callLog.VapiCallID != "" {
			if err := utils.UpsertCallLog(ctx, h.DB, callLog); err != nil {
				log.Printf("🔴 VAPI WEBHOOK: call log not written for callId=%s: %v", callID, err)
			} else {
				log.Printf("💾 VAPI WEBHOOK: call log upserted for callId=%s outcome=%v bookingId=%v restaurantId=%v",
					callID, deref(callLog.Outcome), deref(callLog.BookingID), deref(callLog.RestaurantID))
			}
		}

		log.Printf("⚙️ VAPI WEBHOOK: tool call callId=%s toolId=api:%s name=%q -> %s",
			callID, name, name, summarizeResult(res.Result))

		// apiRequest feeds the raw response body back to the voice model —
		// return the human message, not the packed facts.
		c.JSON(http.StatusOK, gin.H{"message": unpackMessage(res.Result)})
		return
	}

	// Vapi also sends lifecycle messages (status-update, speech-update,
	// end-of-call-report, ...). Acknowledge them with an empty results array.
	// A body with no message.type at all means it wasn't an envelope either —
	// flag it so unexpected shapes are diagnosable instead of silently acked.
	if req.Message.Type == "" {
		log.Printf("⚠️ VAPI WEBHOOK: unrecognized payload (no tool-calls envelope, no known apiRequest args) from %s: %s",
			remote, summarizeResult(string(body)))
	}
	log.Printf("↪️ VAPI WEBHOOK: acknowledged non-tool message (type=%q) — no results returned", req.Message.Type)
	c.JSON(http.StatusOK, webhookResponse{Results: []toolResult{}})
}

// handleEnvelope processes the standard {message:{type:"tool-calls",toolCallList}}
// envelope: one result per tool call, matching toolCallId, plus a call log row.
func (h *Handler) handleEnvelope(ctx context.Context, c *gin.Context, req webhookRequest, callID, phone string) {
	// One call_logs row per Vapi call; enrich it as tools run.
	callLog := utils.CallLogEntry{
		VapiCallID: callID,
	}
	if phone != "" {
		p := phone
		callLog.CustomerPhone = &p
	}

	results := make([]toolResult, 0, len(req.Message.ToolCallList))

	for _, tc := range req.Message.ToolCallList {
		res := h.dispatch(ctx, tc, req)
		results = append(results, res)

		// Fold per-tool facts into the call log (first non-nil wins).
		mergeCallLog(&callLog, res)

		log.Printf("⚙️ VAPI WEBHOOK: tool call callId=%s toolId=%s name=%q -> %s",
			callID, tc.ID, tc.Name, summarizeResult(res.Result))
	}

	// Persist the call log row best-effort — a logging hiccup should never
	// fail the voice call itself.
	if callLog.VapiCallID != "" {
		if err := utils.UpsertCallLog(ctx, h.DB, callLog); err != nil {
			log.Printf("🔴 VAPI WEBHOOK: call log not written for callId=%s: %v", callID, err)
		} else {
			log.Printf("💾 VAPI WEBHOOK: call log upserted for callId=%s outcome=%v bookingId=%v restaurantId=%v",
				callID, deref(callLog.Outcome), deref(callLog.BookingID), deref(callLog.RestaurantID))
		}
	}

	c.JSON(http.StatusOK, webhookResponse{Results: results})
}

// detectBareTool recognizes Vapi's apiRequest tool format: the arguments object
// is POSTed directly (built from the tool's body schema + static body fields)
// with no message envelope. The tool name is inferred from which argument keys
// are present. Returns the tool name, the arguments map, and whether a known
// tool was matched.
func detectBareTool(body []byte) (string, map[string]any, bool) {
	var raw map[string]any
	if err := json.Unmarshal(body, &raw); err != nil || len(raw) == 0 {
		return "", nil, false
	}

	// Shape: raw model function call {id, type:"function", function:{name,
	// arguments:"{...}"}} — Vapi's apiRequest tool can forward the model's
	// original function call instead of a server-message envelope. The
	// arguments arrive as a JSON *string* (OpenAI style), not an object.
	if fn, ok := raw["function"].(map[string]any); ok {
		name, _ := fn["name"].(string)
		if !isKnownTool(name) {
			log.Printf("⚠️ VAPI WEBHOOK: unknown tool in raw function-call payload name=%q — check the tool names match the contract", name)
			return "", nil, false
		}
		args, err := parseArguments(fn["arguments"])
		if err != nil {
			log.Printf("⚠️ VAPI WEBHOOK: raw function-call arguments failed to parse for %q: %v", name, err)
			// Recognized tool with unusable arguments — return a nil args map so
			// the caller answers with an explicit error instead of the empty
			// results ack (which the model would read as "no availability").
			return name, nil, true
		}
		// Static body fields (e.g. restaurantId) may sit at the top level of
		// the forwarded object rather than inside the arguments string — merge
		// them in so the tool receives everything it needs.
		for k, v := range raw {
			if k == "id" || k == "type" || k == "function" {
				continue
			}
			if _, exists := args[k]; !exists {
				args[k] = v
			}
		}
		return name, args, true
	}

	args := raw
	// Some builds nest the arguments under a "message" key — unwrap if so.
	if m, ok := raw["message"].(map[string]any); ok && len(m) > 0 {
		args = m
	}
	// A top-level "name" from the tool definition wins when it's one of ours.
	if n, ok := raw["name"].(string); ok && isKnownTool(n) {
		return n, args, true
	}
	has := func(keys ...string) bool {
		for _, k := range keys {
			if _, ok := args[k]; ok {
				return true
			}
		}
		return false
	}

	// Order matters. create_booking bodies often also carry phone/name (so the
	// webhook can create the customer if needed) — the booking signatures must
	// be matched BEFORE the phone rule, or a booking call is silently misrouted
	// to find_or_create_customer. check_availability is the only tool that
	// never carries a customerId, so the !customerId guard cleanly separates it
	// from the customer-scoped tools even when the time arrives as date+time
	// instead of requestedTime. create_booking (which always has customerId) is
	// matched before add_to_waitlist so a date+time booking body isn't mistaken
	// for a waitlist entry — the raw function-call shape (with a real tool
	// name) handles waitlist unambiguously whenever Vapi forwards the name.
	switch {
	case has("bookingTime", "booking_time") && has("customerId", "customer_id"):
		return "create_booking", args, true
	case has("customerId", "customer_id") && has("date", "reservation_date", "time", "reservation_time"):
		return "create_booking", args, true
	case has("phone", "phone_number"):
		return "find_or_create_customer", args, true
	case has("requestedTime", "requested_time") && has("customerId", "customer_id"):
		return "add_to_waitlist", args, true
	case has("restaurantId", "restaurant_id") && has("partySize", "party_size") && !has("customerId", "customer_id"):
		return "check_availability", args, true
	}
	return "", nil, false
}

func isKnownTool(name string) bool {
	switch name {
	case "check_availability", "find_or_create_customer", "create_booking", "add_to_waitlist":
		return true
	}
	return false
}

// parseArguments converts an "arguments" field — a JSON object or a JSON
// string (OpenAI function-call style) — into a map. Empty strings become an
// empty map.
func parseArguments(v any) (map[string]any, error) {
	switch t := v.(type) {
	case map[string]any:
		return t, nil
	case string:
		if strings.TrimSpace(t) == "" {
			return map[string]any{}, nil
		}
		var m map[string]any
		if err := json.Unmarshal([]byte(t), &m); err != nil {
			return nil, err
		}
		return m, nil
	}
	return nil, fmt.Errorf("unsupported arguments type %T", v)
}

// unpackMessage extracts the human "message=..." fact from a packed result so
// the apiRequest response body handed back to the LLM is clean prose (the
// key=value facts stay server-side in the call log). Falls back to the whole
// string for non-packed results (plain error messages).
func unpackMessage(packed string) string {
	for _, part := range strings.Split(packed, "\u001f") {
		kv := strings.SplitN(part, "=", 2)
		if len(kv) == 2 && kv[0] == "message" {
			return kv[1]
		}
	}
	return packed
}

// summarizeResult shortens a tool result for log output (the packed facts
// include natural-language messages that would flood the logs). Truncates on
// a rune boundary so multi-byte UTF-8 (emojis, em-dashes) is never cut mid-
// sequence in the log output.
func summarizeResult(result string) string {
	const maxLen = 200
	if len(result) <= maxLen {
		return result
	}
	runes := []rune(result)
	return string(runes[:maxLen]) + "..."
}

func deref(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

func vapiCallID(req webhookRequest) string {
	if req.Call != nil {
		return req.Call.ID
	}
	return ""
}

func callerPhone(req webhookRequest) string {
	if req.Call != nil && req.Call.Customer != nil && req.Call.Customer.Number != nil {
		return req.Call.Customer.Number.E164
	}
	return ""
}

// mergeCallLog folds outcome/booking/restaurant facts collected during a tool
// call into the shared call log entry (first value wins).
func mergeCallLog(log *utils.CallLogEntry, res toolResult) {
	// Facts are packed into result strings with \u001f separators (see
	// packFacts) so they survive the string round-trip to Vapi's LLM.
	if res.Result == "" || !strings.Contains(res.Result, "\u001f") {
		return
	}
	parts := strings.Split(res.Result, "\u001f")
	for _, part := range parts {
		kv := strings.SplitN(part, "=", 2)
		if len(kv) != 2 || kv[1] == "" {
			continue
		}
		switch kv[0] {
		case "outcome":
			if log.Outcome == nil {
				v := kv[1]
				log.Outcome = &v
			}
		case "bookingId":
			if log.BookingID == nil {
				v := kv[1]
				log.BookingID = &v
			}
		case "restaurantId":
			if log.RestaurantID == nil {
				v := kv[1]
				log.RestaurantID = &v
			}
		}
	}
}

// --- dispatcher -------------------------------------------------------------

// dispatch runs one tool call and returns the result string for Vapi.
// Errors are converted into readable messages the voice model can respond
// with — the webhook itself should only fail at the HTTP layer for malformed
// requests or bad signatures.
func (h *Handler) dispatch(ctx context.Context, tc toolCall, req webhookRequest) toolResult {
	res := toolResult{ToolCallID: tc.ID}

	switch tc.Name {
	case "check_availability":
		res.Result = h.toolCheckAvailability(ctx, tc.Arguments)
	case "find_or_create_customer":
		res.Result = h.toolFindOrCreateCustomer(ctx, tc.Arguments)
	case "create_booking":
		res.Result = h.toolCreateBooking(ctx, tc.Arguments, vapiCallID(req), tc.ID)
	case "add_to_waitlist":
		res.Result = h.toolAddToWaitlist(ctx, tc.Arguments)
	default:
		res.Result = fmt.Sprintf(`{"error":"unknown tool %q"}`, tc.Name)
		log.Printf("⚠️ VAPI WEBHOOK: unknown tool name %q (callId=%s) — check the tool names in your Vapi assistant match the contract",
			tc.Name, vapiCallID(req))
	}
	return res
}

// --- argument helpers -------------------------------------------------------

// arg reads a string argument, accepting both camelCase and snake_case key
// spellings (Vapi tool definitions vary).
func arg(args map[string]any, camel, snake string) string {
	if v, ok := args[camel].(string); ok {
		return v
	}
	if v, ok := args[snake].(string); ok {
		return v
	}
	return ""
}

func argInt(args map[string]any, camel, snake string) int {
	for _, key := range []string{camel, snake} {
		switch v := args[key].(type) {
		case float64:
			return int(v)
		case string:
			n, err := strconv.Atoi(v)
			if err == nil {
				return n
			}
		}
	}
	return 0
}

// resolveTimeArg returns the RFC3339 instant for a time-taking tool. An
// explicit ISO timestamp from the args (requestedTime/bookingTime) is used
// as-is; otherwise a wall-clock date+time pair is interpreted in the
// restaurant's own timezone via utils.ResolveRestaurantInstant — the voice
// model never does timezone math. Returns ("", nil) when the args carry no
// time information at all, and a *BookingError for malformed values.
func (h *Handler) resolveTimeArg(ctx context.Context, args map[string]any, restaurantID, isoCamel, isoSnake string) (string, error) {
	if iso := arg(args, isoCamel, isoSnake); iso != "" {
		return iso, nil
	}
	date := arg(args, "date", "reservation_date")
	timeOfDay := arg(args, "time", "reservation_time")
	if date == "" && timeOfDay == "" {
		return "", nil
	}
	if date == "" || timeOfDay == "" {
		return "", utils.NewBookingError(utils.CodeBadInput, "both date and time are required together (e.g. date=2026-08-07, time=19:00)", nil)
	}
	return utils.ResolveRestaurantInstant(ctx, h.DB, restaurantID, date, timeOfDay)
}

// packFacts joins key=value facts with \u001f so the webhook can fold them
// into the call log without parsing free-form LLM prose.
func packFacts(pairs ...string) string {
	return strings.Join(pairs, "\u001f")
}

// --- tools ------------------------------------------------------------------

func (h *Handler) toolCheckAvailability(ctx context.Context, args map[string]any) string {
	input := model.CheckAvailabilityInput{
		RestaurantID: arg(args, "restaurantId", "restaurant_id"),
		PartySize:    argInt(args, "partySize", "party_size"),
	}
	if input.RestaurantID == "" {
		log.Printf("⚠️ VAPI check_availability: missing restaurantId — the tool's static body field is probably not set")
		return "I need the restaurant id to check availability — please set the restaurantId static field on this tool."
	}

	rt, err := h.resolveTimeArg(ctx, args, input.RestaurantID, "requestedTime", "requested_time")
	if err != nil {
		var be *utils.BookingError
		if errors.As(err, &be) {
			log.Printf("⚠️ VAPI check_availability: %s (code=%s restaurant=%s party=%d)",
				be.Message, be.Code, input.RestaurantID, input.PartySize)
			return fmt.Sprintf("I couldn't check availability: %s", be.Message)
		}
		log.Printf("🔴 VAPI check_availability: time resolution failed: %v (restaurant=%s)", err, input.RestaurantID)
		return "I'm sorry, I couldn't check availability right now. Please try again."
	}
	if rt == "" {
		log.Printf("⚠️ VAPI check_availability: no time supplied (restaurant=%s party=%d)", input.RestaurantID, input.PartySize)
		return "I need the date and time you'd like to book before I can check availability."
	}
	input.RequestedTime = rt

	slots, err := utils.CheckAvailability(ctx, h.DB, input)
	if err != nil {
		var be *utils.BookingError
		if errors.As(err, &be) {
			log.Printf("⚠️ VAPI check_availability: %s (code=%s restaurant=%s party=%d time=%s)",
				be.Message, be.Code, input.RestaurantID, input.PartySize, input.RequestedTime)
			return fmt.Sprintf("I couldn't check availability: %s", be.Message)
		}
		log.Printf("🔴 VAPI check_availability failed: %v (restaurant=%s party=%d time=%s)",
			err, input.RestaurantID, input.PartySize, input.RequestedTime)
		return "I'm sorry, I couldn't check availability right now. Please try again."
	}

	if len(slots) == 0 {
		log.Printf("ℹ️ VAPI check_availability: no tables for restaurant=%s party=%d time=%s",
			input.RestaurantID, input.PartySize, input.RequestedTime)
		return packFacts(
			"outcome=NO_AVAILABILITY",
			"restaurantId="+input.RestaurantID,
			"message=Sorry, there are no tables available for "+strconv.Itoa(input.PartySize)+" guests at the requested time.",
		)
	}

	names := make([]string, 0, len(slots))
	for _, s := range slots {
		names = append(names, s.Table.TableNumber)
	}
	log.Printf("ℹ️ VAPI check_availability: %d table(s) for restaurant=%s party=%d time=%s",
		len(slots), input.RestaurantID, input.PartySize, input.RequestedTime)
	return packFacts(
		"restaurantId="+input.RestaurantID,
		"message="+fmt.Sprintf(
			"Great news — I found %d table%s available for %d guests: %s.",
			len(slots), plural(len(slots)), input.PartySize, strings.Join(names, ", "),
		),
	)
}

func (h *Handler) toolFindOrCreateCustomer(ctx context.Context, args map[string]any) string {
	phone := arg(args, "phone", "phone_number")
	if phone == "" {
		return "I need the caller's phone number to find their account."
	}

	input := model.FindOrCreateCustomerInput{Phone: phone}
	if v := arg(args, "name", "caller_name"); v != "" {
		input.Name = &v
	}
	if v := arg(args, "email", "email_address"); v != "" {
		input.Email = &v
	}

	customer, err := utils.FindOrCreateCustomer(ctx, h.DB, input)
	if err != nil {
		log.Printf("🔴 VAPI find_or_create_customer failed: %v (phone=%s)", err, phone)
		return "I'm sorry, I had trouble looking up your details. Please try again."
	}

	log.Printf("ℹ️ VAPI find_or_create_customer: ok phone=%s customerId=%s", phone, customer.ID)
	return packFacts(
		"customerId="+customer.ID,
		"message="+fmt.Sprintf("Found you! Your account is ready — customer id %s.", customer.ID),
	)
}

func (h *Handler) toolCreateBooking(ctx context.Context, args map[string]any, callID, toolCallID string) string {
	// Idempotency key: if the tool call itself doesn't supply one, derive a
	// stable key from the Vapi call + tool call so Vapi retries never
	// double-book.
	idem := arg(args, "idempotencyKey", "idempotency_key")
	if idem == "" {
		idem = fmt.Sprintf("vapi:%s:%s", callID, toolCallID)
	}

	source := model.BookingSourcePhone
	input := model.CreateBookingInput{
		RestaurantID:   arg(args, "restaurantId", "restaurant_id"),
		CustomerID:     arg(args, "customerId", "customer_id"),
		PartySize:      argInt(args, "partySize", "party_size"),
		IdempotencyKey: idem,
		Source:         &source,
	}
	if input.RestaurantID == "" {
		log.Printf("⚠️ VAPI create_booking: missing restaurantId — the tool's static body field is probably not set")
		return "I need the restaurant id to book — please set the restaurantId static field on this tool."
	}

	rt, err := h.resolveTimeArg(ctx, args, input.RestaurantID, "bookingTime", "booking_time")
	if err != nil {
		var be *utils.BookingError
		if errors.As(err, &be) {
			log.Printf("⚠️ VAPI create_booking: %s (code=%s idem=%s)", be.Message, be.Code, idem)
			return fmt.Sprintf("I couldn't complete the booking: %s", be.Message)
		}
		log.Printf("🔴 VAPI create_booking: time resolution failed: %v (idem=%s)", err, idem)
		return "I'm sorry, I couldn't complete the booking. Please try again."
	}
	if rt == "" {
		log.Printf("⚠️ VAPI create_booking: no time supplied (idem=%s)", idem)
		return "I need the date and time for the booking before I can confirm it."
	}
	input.BookingTime = rt

	if v := arg(args, "tableId", "table_id"); v != "" {
		input.TableID = &v
	}
	if v := arg(args, "specialRequests", "special_requests"); v != "" {
		input.SpecialRequests = &v
	}

	booking, err := utils.CreateBooking(ctx, h.DB, input)
	if err != nil {
		var be *utils.BookingError
		if errors.As(err, &be) {
			log.Printf("⚠️ VAPI create_booking: %s (code=%s idem=%s)", be.Message, be.Code, idem)
			return fmt.Sprintf("I couldn't complete the booking: %s", be.Message)
		}
		log.Printf("🔴 VAPI create_booking failed: %v (idem=%s)", err, idem)
		return "I'm sorry, I couldn't complete the booking. Please try again."
	}

	log.Printf("✅ VAPI create_booking: bookingId=%s restaurant=%s party=%d time=%s idem=%s",
		booking.ID, booking.RestaurantID, booking.PartySize, booking.BookingTime, idem)
	return packFacts(
		"outcome=BOOKED",
		"bookingId="+booking.ID,
		"restaurantId="+booking.RestaurantID,
		"message="+fmt.Sprintf(
			"Your booking is confirmed — booking id %s for %d guests.",
			booking.ID, booking.PartySize,
		),
	)
}

func (h *Handler) toolAddToWaitlist(ctx context.Context, args map[string]any) string {
	input := model.CreateWaitlistEntryInput{
		RestaurantID: arg(args, "restaurantId", "restaurant_id"),
		CustomerID:   arg(args, "customerId", "customer_id"),
		PartySize:    argInt(args, "partySize", "party_size"),
	}

	requestedTime, err := h.resolveTimeArg(ctx, args, input.RestaurantID, "requestedTime", "requested_time")
	if err != nil {
		var be *utils.BookingError
		if errors.As(err, &be) {
			return fmt.Sprintf("I couldn't add you to the waitlist: %s", be.Message)
		}
		log.Printf("🔴 VAPI add_to_waitlist: time resolution failed: %v", err)
		return "I'm sorry, I couldn't add you to the waitlist. Please try again."
	}
	if requestedTime == "" {
		requestedTime = time.Now().UTC().Format(time.RFC3339)
	}
	input.RequestedTime = requestedTime

	entry, err := utils.CreateWaitlistEntry(ctx, h.DB, input)
	if err != nil {
		var be *utils.BookingError
		if errors.As(err, &be) {
			log.Printf("⚠️ VAPI add_to_waitlist: %s (code=%s restaurant=%s party=%d)",
				be.Message, be.Code, input.RestaurantID, input.PartySize)
			return fmt.Sprintf("I couldn't add you to the waitlist: %s", be.Message)
		}
		log.Printf("🔴 VAPI add_to_waitlist failed: %v (restaurant=%s party=%d)", err, input.RestaurantID, input.PartySize)
		return "I'm sorry, I couldn't add you to the waitlist. Please try again."
	}

	log.Printf("ℹ️ VAPI add_to_waitlist: waitlistId=%s restaurant=%s party=%d", entry.ID, entry.RestaurantID, entry.PartySize)
	return packFacts(
		"outcome=NO_AVAILABILITY",
		"restaurantId="+entry.RestaurantID,
		"message="+fmt.Sprintf(
			"You're on the waitlist. We'll call you when a table opens up.",
		),
	)
}

func plural(n int) string {
	if n == 1 {
		return ""
	}
	return "s"
}
