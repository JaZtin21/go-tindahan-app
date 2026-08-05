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
// runs before this handler). Vapi sends every tool call as:
//
//	{ "message": { "type": "tool-calls", "toolCallList": [ { "id", "name",
//	  "arguments" } ] }, "call": { "id", "customer": { "number": { "e164" } } } }
//
// and expects back:
//
//	{ "results": [ { "toolCallId": "<same id>", "result": "..." } ] }
//
// The dispatcher branches on tool name and reuses the shared booking ops in
// internal/utils — same source of truth as the GraphQL resolvers.
//
// TOOL CONTRACT — the assistant's tool definitions in Vapi's dashboard must
// use these exact names and argument keys (camelCase or snake_case are both
// accepted per-argument):
//
//	check_availability        restaurantId/restaurant_id, partySize/party_size,
//	                          requestedTime/requested_time (ISO 8601)
//	find_or_create_customer  phone/phone_number, name/caller_name, email
//	create_booking           restaurantId, customerId, tableId (optional),
//	                          partySize, bookingTime (ISO 8601), specialRequests,
//	                          idempotencyKey (recommended — see below)
//	add_to_waitlist          restaurantId, customerId, partySize, requestedTime
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
	body, err := c.GetRawData()
	if err != nil {
		c.JSON(http.StatusBadRequest, webhookResponse{})
		return
	}

	var req webhookRequest
	if err := json.Unmarshal(body, &req); err != nil {
		log.Printf("🔴 VAPI WEBHOOK: failed to decode payload: %v", err)
		c.JSON(http.StatusBadRequest, webhookResponse{})
		return
	}

	// Vapi also sends non-tool messages (status-update, end-of-call-report,
	// etc.). Acknowledge them with an empty results array — they carry no
	// tool calls to answer.
	if req.Message.Type != "tool-calls" {
		c.JSON(http.StatusOK, webhookResponse{Results: []toolResult{}})
		return
	}

	ctx := c.Request.Context()

	// One call_logs row per Vapi call; enrich it as tools run.
	callLog := utils.CallLogEntry{
		VapiCallID: vapiCallID(req),
	}
	if phone := callerPhone(req); phone != "" {
		p := phone
		callLog.CustomerPhone = &p
	}

	results := make([]toolResult, 0, len(req.Message.ToolCallList))

	for _, tc := range req.Message.ToolCallList {
		res := h.dispatch(ctx, tc, req)
		results = append(results, res)

		// Fold per-tool facts into the call log (first non-nil wins).
		mergeCallLog(&callLog, res)
	}

	// Persist the call log row best-effort — a logging hiccup should never
	// fail the voice call itself.
	if callLog.VapiCallID != "" {
		if err := utils.UpsertCallLog(ctx, h.DB, callLog); err != nil {
			log.Printf("⚠️ VAPI WEBHOOK: call log not written: %v", err)
		}
	}

	c.JSON(http.StatusOK, webhookResponse{Results: results})
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

// packFacts joins key=value facts with \u001f so the webhook can fold them
// into the call log without parsing free-form LLM prose.
func packFacts(pairs ...string) string {
	return strings.Join(pairs, "\u001f")
}

// --- tools ------------------------------------------------------------------

func (h *Handler) toolCheckAvailability(ctx context.Context, args map[string]any) string {
	input := model.CheckAvailabilityInput{
		RestaurantID:  arg(args, "restaurantId", "restaurant_id"),
		PartySize:     argInt(args, "partySize", "party_size"),
		RequestedTime: arg(args, "requestedTime", "requested_time"),
	}

	slots, err := utils.CheckAvailability(ctx, h.DB, input)
	if err != nil {
		var be *utils.BookingError
		if errors.As(err, &be) {
			return fmt.Sprintf("I couldn't check availability: %s", be.Message)
		}
		log.Printf("🔴 VAPI check_availability failed: %v", err)
		return "I'm sorry, I couldn't check availability right now. Please try again."
	}

	if len(slots) == 0 {
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
		log.Printf("🔴 VAPI find_or_create_customer failed: %v", err)
		return "I'm sorry, I had trouble looking up your details. Please try again."
	}

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
		BookingTime:    arg(args, "bookingTime", "booking_time"),
		IdempotencyKey: idem,
		Source:         &source,
	}
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
			return fmt.Sprintf("I couldn't complete the booking: %s", be.Message)
		}
		log.Printf("🔴 VAPI create_booking failed: %v", err)
		return "I'm sorry, I couldn't complete the booking. Please try again."
	}

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
	requestedTime := arg(args, "requestedTime", "requested_time")
	if requestedTime == "" {
		requestedTime = time.Now().UTC().Format(time.RFC3339)
	}

	input := model.CreateWaitlistEntryInput{
		RestaurantID:  arg(args, "restaurantId", "restaurant_id"),
		CustomerID:    arg(args, "customerId", "customer_id"),
		PartySize:     argInt(args, "partySize", "party_size"),
		RequestedTime: requestedTime,
	}

	entry, err := utils.CreateWaitlistEntry(ctx, h.DB, input)
	if err != nil {
		var be *utils.BookingError
		if errors.As(err, &be) {
			return fmt.Sprintf("I couldn't add you to the waitlist: %s", be.Message)
		}
		log.Printf("🔴 VAPI add_to_waitlist failed: %v", err)
		return "I'm sorry, I couldn't add you to the waitlist. Please try again."
	}

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
