package utils

import (
	"context"
	"errors"
	"fmt"
	"log"
	"strconv"
	"strings"
	"time"

	"go-backend/internal/graph/model"

	"github.com/99designs/gqlgen/graphql"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/vektah/gqlparser/v2/gqlerror"
)

// ----------------------------------------------------------------------------
// SHARED BOOKING OPERATIONS
//
// These are the single source of truth for the public booking flow. Both the
// GraphQL resolvers (restaurant.resolvers.go) and the Vapi webhook handler
// (internal/vapi) call these — never duplicate this SQL. Lives in utils so it
// survives `go generate`.
// ----------------------------------------------------------------------------

// BookingError carries a stable code (mirrors the GraphQL error extension
// codes) plus a human message, so resolvers and the webhook map failures the
// same way.
type BookingError struct {
	Code    string
	Message string
	Err     error
}

func (e *BookingError) Error() string { return e.Message }
func (e *BookingError) Unwrap() error { return e.Err }

const (
	CodeNotFound    = "NOT_FOUND"
	CodeBadInput    = "BAD_USER_INPUT"
	CodeTableBooked = "TABLE_ALREADY_BOOKED"
	CodeInternal    = "INTERNAL_SERVER_ERROR"
)

func NewBookingError(code, message string, err error) *BookingError {
	return &BookingError{Code: code, Message: message, Err: err}
}

func AsBookingError(err error) (*BookingError, bool) {
	var be *BookingError
	if errors.As(err, &be) {
		return be, true
	}
	return nil, false
}

// HandleBookingError maps a *BookingError onto the GraphQL error stream
// (same extension codes the resolvers used before this extraction) and
// returns true. For non-booking errors it returns false so callers can bubble
// them up as raw 500s.
func HandleBookingError(ctx context.Context, err error) bool {
	var be *BookingError
	if errors.As(err, &be) {
		graphql.AddError(ctx, &gqlerror.Error{
			Message:    be.Message,
			Extensions: map[string]any{"code": be.Code},
		})
		return true
	}
	return false
}

// FindOrCreateCustomer looks a customer up by phone, creating them if they
// don't exist yet (upsert on phone). Returns the customer row.
func FindOrCreateCustomer(ctx context.Context, db *pgxpool.Pool, input model.FindOrCreateCustomerInput) (*model.Customer, error) {
	var c model.Customer
	var createdAt time.Time

	err := db.QueryRow(ctx, `
		INSERT INTO customers (phone, name, email)
		VALUES ($1, $2, $3)
		ON CONFLICT (phone) DO UPDATE SET
			name = COALESCE(EXCLUDED.name, customers.name),
			email = COALESCE(EXCLUDED.email, customers.email)
		RETURNING id, phone, name, email, created_at
	`, input.Phone, input.Name, input.Email).Scan(&c.ID, &c.Phone, &c.Name, &c.Email, &createdAt)

	if err != nil {
		log.Printf("🔴 DATABASE TRANSACTION FAILED IN FINDORCREATECUSTOMER: %v", err)
		return nil, NewBookingError(CodeInternal, "internal server error: failed to resolve customer", err)
	}

	c.CreatedAt = createdAt.Format(time.RFC3339)
	return &c, nil
}

// ResolveTableID accepts either a table UUID or a table number (the form the
// voice model reports from check_availability results, e.g. "2") and returns
// the table's UUID for the given restaurant. Returns ("", nil) when nothing
// matches, so callers can fail with a clear message instead of letting the
// raw value hit a uuid column (invalid input syntax for type uuid).
func ResolveTableID(ctx context.Context, db *pgxpool.Pool, restaurantID, tableRef string) (string, error) {
	ref := strings.TrimSpace(tableRef)
	if ref == "" {
		return "", nil
	}
	var id string
	err := db.QueryRow(ctx, `
		SELECT id FROM restaurant_tables
		WHERE restaurant_id = $1 AND is_active = true
		  AND (id::text = $2 OR table_number = $2)
	`, restaurantID, ref).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", nil
	}
	if err != nil {
		log.Printf("🔴 DATABASE QUERY FAILED IN RESOLVETABLEID: %v (restaurant=%s ref=%q)", err, restaurantID, ref)
	}
	return id, err
}

// GetBookingByID loads a booking by id with no access guard. Used by the
// create-booking idempotency paths (a retried webhook request should return
// the original booking, not require a staff session to read it back).
func GetBookingByID(ctx context.Context, db *pgxpool.Pool, id string) (*model.Booking, error) {
	query := `
		SELECT id, restaurant_id, customer_id, table_id, party_size, booking_time,
			duration_minutes, status, special_requests, payment_status, source, created_at, updated_at
		FROM bookings WHERE id = $1
	`

	var b model.Booking
	var bt, createdAt, updatedAt time.Time
	err := db.QueryRow(ctx, query, id).Scan(
		&b.ID, &b.RestaurantID, &b.CustomerID, &b.TableID, &b.PartySize, &bt,
		&b.DurationMinutes, &b.Status, &b.SpecialRequests, &b.PaymentStatus, &b.Source, &createdAt, &updatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		log.Printf("🔴 DATABASE QUERY FAILED IN GETBOOKINGBYID: %v", err)
		return nil, err
	}

	b.BookingTime = bt.Format(time.RFC3339)
	b.CreatedAt = createdAt.Format(time.RFC3339)
	b.UpdatedAt = updatedAt.Format(time.RFC3339)
	return &b, nil
}

// CheckAvailability returns every active table that fits the party size and
// has no overlapping non-cancelled booking in the requested window. This is
// the fast-path check; the bookings EXCLUDE constraint is the hard guarantee
// if two requests race.
func CheckAvailability(ctx context.Context, db *pgxpool.Pool, input model.CheckAvailabilityInput) ([]*model.AvailableSlot, error) {
	requestedTime, err := time.Parse(time.RFC3339, input.RequestedTime)
	if err != nil {
		return nil, NewBookingError(CodeBadInput, "invalid requestedTime: must be ISO 8601 / RFC3339", err)
	}

	var turnDuration int
	var tzName string
	if err := db.QueryRow(ctx,
		`SELECT default_turn_duration_min, timezone FROM restaurants WHERE id = $1`, input.RestaurantID,
	).Scan(&turnDuration, &tzName); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, NewBookingError(CodeNotFound, "not found: restaurant does not exist", err)
		}
		return nil, err
	}

	// Operating-hours gate: if the restaurant is closed that day (or has no
	// hours configured), or the requested window falls outside the day's
	// open/close times, there is no availability regardless of table capacity.
	// Wall-clock hours are interpreted in the restaurant's own timezone.
	open, err := operatingWindow(ctx, db, input.RestaurantID, requestedTime, tzName, turnDuration)
	if err != nil {
		return nil, err
	}
	if !open {
		return []*model.AvailableSlot{}, nil
	}

	// Compute the window end in Go and pass both bounds as timestamptz —
	// previously this was `$4 || ' minutes'` in SQL which forced the int to
	// encode as text and blew up pgx's encoder.
	endTime := requestedTime.Add(time.Duration(turnDuration) * time.Minute)

	query := `
		SELECT rt.id, rt.table_number, rt.capacity_min, rt.capacity_max, rt.section
		FROM restaurant_tables rt
		WHERE rt.restaurant_id = $1
			AND rt.is_active = true
			AND rt.capacity_max >= $2
			AND rt.capacity_min <= $2
			AND NOT EXISTS (
				SELECT 1 FROM bookings b
				WHERE b.table_id = rt.id
					AND b.status NOT IN ('CANCELLED', 'NO_SHOW')
					AND b.time_range && tstzrange($3::timestamptz, $4::timestamptz)
			)
		ORDER BY rt.capacity_max ASC
	`

	rows, err := db.Query(ctx, query, input.RestaurantID, input.PartySize, requestedTime, endTime)
	if err != nil {
		log.Printf("🔴 DATABASE QUERY FAILED IN CHECKAVAILABILITY: %v", err)
		return nil, err
	}
	defer rows.Close()

	var slots []*model.AvailableSlot
	for rows.Next() {
		var t model.RestaurantTable
		t.RestaurantID = input.RestaurantID
		t.IsActive = true
		if err := rows.Scan(&t.ID, &t.TableNumber, &t.CapacityMin, &t.CapacityMax, &t.Section); err != nil {
			log.Printf("⚠️ Failed to scan table row in checkAvailability: %v", err)
			continue
		}
		slots = append(slots, &model.AvailableSlot{
			Table:     &t,
			StartTime: requestedTime.Format(time.RFC3339),
			EndTime:   endTime.Format(time.RFC3339),
		})
	}

	if slots == nil {
		slots = []*model.AvailableSlot{}
	}
	return slots, nil
}

// operatingWindow reports whether the booking window starting at start (with
// the given duration in minutes) falls inside the restaurant's operating hours
// for that local day and is not on a closure date. Wall-clock open/close times
// are interpreted in the restaurant's own timezone (the operating_hours table
// stores plain TIME values). A day with no hours row, a row marked closed, or
// NULL open/close is treated as closed. Overnight service (close < open) is
// supported for windows that begin on the service day; windows that start
// before the day's open time are rejected even if the previous day's service
// wrapped past midnight.
func operatingWindow(ctx context.Context, db *pgxpool.Pool, restaurantID string, start time.Time, tzName string, durationMin int) (bool, error) {
	loc := time.UTC
	if tzName != "" {
		if l, err := time.LoadLocation(tzName); err == nil {
			loc = l
		} else {
			log.Printf("⚠️ operatingWindow: unknown timezone %q, falling back to UTC: %v", tzName, err)
		}
	}
	local := start.In(loc)

	// One-off closure on the local calendar date.
	var closedDay bool
	if err := db.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM closures WHERE restaurant_id = $1 AND closure_date = $2::date)`,
		restaurantID, local.Format("2006-01-02"),
	).Scan(&closedDay); err != nil {
		log.Printf("🔴 CLOSURES QUERY FAILED IN OPERATINGWINDOW: %v", err)
		return false, err
	}
	if closedDay {
		return false, nil
	}

	// Weekly hours for the local weekday (day_of_week: 0 = Sunday).
	var openStr, closeStr *string
	var isClosed bool
	err := db.QueryRow(ctx,
		`SELECT open_time::text, close_time::text, is_closed
		 FROM operating_hours
		 WHERE restaurant_id = $1 AND day_of_week = $2`,
		restaurantID, int(local.Weekday()),
	).Scan(&openStr, &closeStr, &isClosed)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			// No hours configured for this day → treat as closed (never offer
			// a table when we can't confirm the restaurant is open), but log it
			// so a new restaurant that hasn't set hours yet is diagnosable.
			log.Printf("⚠️ operatingWindow: no operating_hours row for restaurant %s on weekday %d — treating as closed", restaurantID, int(local.Weekday()))
			return false, nil
		}
		log.Printf("🔴 OPERATING HOURS QUERY FAILED IN OPERATINGWINDOW: %v", err)
		return false, err
	}
	if isClosed || openStr == nil || closeStr == nil {
		return false, nil
	}

	openMin, ok := parseClockMinutes(*openStr)
	closeMin, ok2 := parseClockMinutes(*closeStr)
	if !ok || !ok2 {
		return false, nil
	}
	// Service that crosses midnight (close < open) ends on the following day.
	if closeMin < openMin {
		closeMin += 24 * 60
	}

	startMin := local.Hour()*60 + local.Minute()
	endMin := startMin + durationMin
	return startMin >= openMin && endMin <= closeMin, nil
}

// parseClockMinutes converts an "HH:MM" / "HH:MM:SS" TIME string to minutes
// since midnight. ok is false if the value can't be parsed. Lenient about
// fractional seconds — Postgres TIME defaults to microsecond precision, so
// ::text can include a ".ffffff" suffix that strict time.Parse rejects.
func parseClockMinutes(hhmmss string) (int, bool) {
	if i := strings.IndexByte(hhmmss, '.'); i >= 0 {
		hhmmss = hhmmss[:i]
	}
	parts := strings.Split(hhmmss, ":")
	if len(parts) < 2 || len(parts) > 3 {
		return 0, false
	}
	h, err1 := strconv.Atoi(parts[0])
	m, err2 := strconv.Atoi(parts[1])
	if err1 != nil || err2 != nil || h < 0 || h > 23 || m < 0 || m > 59 {
		return 0, false
	}
	return h*60 + m, true
}

// ResolveRestaurantInstant interprets a wall-clock date+time pair in the
// restaurant's OWN timezone (restaurants.timezone) and returns the absolute
// instant as RFC3339. This is the voice-agent contract: the model only passes
// the date and time exactly as the caller said them ("2026-08-07" + "19:00") —
// it never does timezone math. The instant is then checked against operating
// hours / closures / overlaps in the same restaurant-local frame downstream.
func ResolveRestaurantInstant(ctx context.Context, db *pgxpool.Pool, restaurantID, date, timeOfDay string) (string, error) {
	var tzName string
	if err := db.QueryRow(ctx, `SELECT timezone FROM restaurants WHERE id = $1`, restaurantID).Scan(&tzName); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", NewBookingError(CodeNotFound, "not found: restaurant does not exist", err)
		}
		log.Printf("🔴 DATABASE QUERY FAILED IN RESOLVERESTAURANTINSTANT: %v", err)
		return "", err
	}

	// Restaurant-local time is unresolvable without the restaurant's own
	// timezone — never guess (UTC would silently shift the booking by hours).
	if tzName == "" {
		return "", NewBookingError(CodeBadInput, "restaurant has no timezone configured — cannot interpret the requested time", nil)
	}
	loc, err := time.LoadLocation(tzName)
	if err != nil {
		log.Printf("⚠️ ResolveRestaurantInstant: unknown timezone %q, falling back to UTC: %v", tzName, err)
		loc = time.UTC
	}

	parsedDate, err := time.ParseInLocation("2006-01-02", strings.TrimSpace(date), loc)
	if err != nil {
		// Lenient fallback: "8/7/2026"
		parsedDate, err = time.ParseInLocation("1/2/2006", strings.TrimSpace(date), loc)
		if err != nil {
			return "", NewBookingError(CodeBadInput, "invalid date: expected YYYY-MM-DD (e.g. 2026-08-07)", err)
		}
	}

	clock, err := parseWallClockTime(timeOfDay)
	if err != nil {
		return "", NewBookingError(CodeBadInput, "invalid time: expected 24-hour HH:MM (e.g. 19:00)", err)
	}

	// time.Date normalizes DST gap/ambiguous local times (e.g. 2:30 AM during
	// a spring-forward) to a valid instant rather than erroring — acceptable:
	// the caller's stated wall-clock time simply doesn't exist that day.
	instant := time.Date(parsedDate.Year(), parsedDate.Month(), parsedDate.Day(),
		clock.Hour(), clock.Minute(), 0, 0, loc)
	return instant.Format(time.RFC3339), nil
}

// parseWallClockTime accepts 24-hour ("19:00", "19:00:00") and 12-hour
// ("7:00 PM", "7:00pm", "7 PM") clock strings. Go's time.Parse matches
// AM/PM case-insensitively, so the 12-hour layouts cover both cases.
func parseWallClockTime(s string) (time.Time, error) {
	s = strings.TrimSpace(s)
	layouts := []string{
		"15:04", "15:04:05", "3:04 PM", "3 PM",
	}
	for _, layout := range layouts {
		if t, err := time.Parse(layout, s); err == nil {
			return t, nil
		}
	}
	return time.Time{}, fmt.Errorf("could not parse time %q", s)
}

// CreateBooking inserts a booking with an idempotency key so retried requests
// (webhook retries, double-clicks) return the original booking instead of
// double-inserting. Table/time conflicts surface as CodeTableBooked.
func CreateBooking(ctx context.Context, db *pgxpool.Pool, input model.CreateBookingInput) (*model.Booking, error) {
	// Idempotency check first — if a retry sends the same key, return the
	// existing booking instead of erroring or double-inserting.
	var existingID string
	err := db.QueryRow(ctx,
		`SELECT id FROM bookings WHERE idempotency_key = $1`, input.IdempotencyKey,
	).Scan(&existingID)
	if err == nil {
		return GetBookingByID(ctx, db, existingID)
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		log.Printf("🔴 DATABASE QUERY FAILED IN CREATEBOOKING IDEMPOTENCY CHECK: %v", err)
		return nil, err
	}

	var turnDuration int
	if err := db.QueryRow(ctx,
		`SELECT default_turn_duration_min FROM restaurants WHERE id = $1`, input.RestaurantID,
	).Scan(&turnDuration); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, NewBookingError(CodeNotFound, "not found: restaurant does not exist", err)
		}
		return nil, err
	}

	bookingTime, err := time.Parse(time.RFC3339, input.BookingTime)
	if err != nil {
		return nil, NewBookingError(CodeBadInput, "invalid bookingTime: must be ISO 8601 / RFC3339", err)
	}

	endTime := bookingTime.Add(time.Duration(turnDuration) * time.Minute)
	timeRange := fmt.Sprintf("[%s,%s)", bookingTime.Format(time.RFC3339), endTime.Format(time.RFC3339))

	source := model.BookingSourcePhone
	if input.Source != nil {
		source = *input.Source
	}

	query := `
		INSERT INTO bookings (
			restaurant_id, customer_id, table_id, party_size, booking_time,
			duration_minutes, time_range, special_requests, source, idempotency_key
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7::tstzrange, $8, $9, $10)
		RETURNING id, status, payment_status, created_at, updated_at
	`

	var b model.Booking
	b.RestaurantID = input.RestaurantID
	b.CustomerID = input.CustomerID
	b.TableID = input.TableID
	b.PartySize = input.PartySize
	b.BookingTime = input.BookingTime
	b.DurationMinutes = turnDuration
	b.SpecialRequests = input.SpecialRequests
	b.Source = source

	var createdAt, updatedAt time.Time
	err = db.QueryRow(ctx, query,
		input.RestaurantID, input.CustomerID, input.TableID, input.PartySize, bookingTime,
		turnDuration, timeRange, input.SpecialRequests, source, input.IdempotencyKey,
	).Scan(&b.ID, &b.Status, &b.PaymentStatus, &createdAt, &updatedAt)

	if err != nil {
		if IsExclusionViolation(err) {
			return nil, NewBookingError(CodeTableBooked, "that table is already booked for the requested time", err)
		}
		if IsUniqueViolation(err) {
			var raceID string
			if lookupErr := db.QueryRow(ctx,
				`SELECT id FROM bookings WHERE idempotency_key = $1`, input.IdempotencyKey,
			).Scan(&raceID); lookupErr == nil {
				return GetBookingByID(ctx, db, raceID)
			}
		}
		log.Printf("🔴 DATABASE TRANSACTION FAILED IN CREATEBOOKING: %v", err)
		return nil, NewBookingError(CodeInternal, "internal server error: failed to create booking", err)
	}

	b.CreatedAt = createdAt.Format(time.RFC3339)
	b.UpdatedAt = updatedAt.Format(time.RFC3339)
	return &b, nil
}

// CreateWaitlistEntry adds a caller to the overflow queue when the restaurant
// is fully booked. Public — used by the Vapi voice agent and the website.
func CreateWaitlistEntry(ctx context.Context, db *pgxpool.Pool, input model.CreateWaitlistEntryInput) (*model.WaitlistEntry, error) {
	requestedTime, err := time.Parse(time.RFC3339, input.RequestedTime)
	if err != nil {
		return nil, NewBookingError(CodeBadInput, "invalid requestedTime: must be ISO 8601 / RFC3339", err)
	}

	var w model.WaitlistEntry
	var createdAt time.Time
	err = db.QueryRow(ctx, `
		INSERT INTO waitlist (restaurant_id, customer_id, party_size, requested_time)
		VALUES ($1, $2, $3, $4)
		RETURNING id, status, created_at
	`, input.RestaurantID, input.CustomerID, input.PartySize, requestedTime).
		Scan(&w.ID, &w.Status, &createdAt)

	if err != nil {
		if IsForeignKeyViolation(err) {
			return nil, NewBookingError(CodeNotFound, "not found: restaurant or customer does not exist", err)
		}
		log.Printf("🔴 DATABASE TRANSACTION FAILED IN CREATEWAITLISTENTRY: %v", err)
		return nil, NewBookingError(CodeInternal, "internal server error: failed to add to waitlist", err)
	}

	w.RestaurantID = input.RestaurantID
	w.CustomerID = input.CustomerID
	w.PartySize = input.PartySize
	w.RequestedTime = requestedTime.Format(time.RFC3339)
	w.CreatedAt = createdAt.Format(time.RFC3339)
	return &w, nil
}

// CallLogEntry is what the Vapi webhook writes per call. Outcome mirrors the
// CallOutcome enum values ('BOOKED', 'NO_AVAILABILITY', ...) as a plain
// string so this util never has to import the enum's marshalers.
type CallLogEntry struct {
	RestaurantID  *string
	VapiCallID    string
	CustomerPhone *string
	BookingID     *string
	Transcript    *string
	Outcome       *string
}

// UpsertCallLog writes one call_logs row per vapi_call_id: updates the row
// if the call is already logged (a call fires several webhook messages), or
// inserts a fresh one. The call_logs.vapi_call_id column is a plain index
// (not unique), so do an explicit update-then-insert rather than ON CONFLICT.
func UpsertCallLog(ctx context.Context, db *pgxpool.Pool, e CallLogEntry) error {
	tag, err := db.Exec(ctx, `
		UPDATE call_logs SET
			restaurant_id  = COALESCE($2, restaurant_id),
			customer_phone = COALESCE($3, customer_phone),
			booking_id     = COALESCE($4, booking_id),
			transcript     = COALESCE($5, transcript),
			outcome        = COALESCE($6, outcome)
		WHERE vapi_call_id = $1
	`, e.VapiCallID, e.RestaurantID, e.CustomerPhone, e.BookingID, e.Transcript, e.Outcome)
	if err != nil {
		log.Printf("🔴 CALLLOGS UPDATE FAILED IN UPSERTCALLLOG: %v", err)
		return err
	}

	if tag.RowsAffected() > 0 {
		return nil
	}

	_, err = db.Exec(ctx, `
		INSERT INTO call_logs (restaurant_id, vapi_call_id, customer_phone, booking_id, transcript, outcome)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, e.RestaurantID, e.VapiCallID, e.CustomerPhone, e.BookingID, e.Transcript, e.Outcome)
	if err != nil {
		log.Printf("🔴 CALLLOGS INSERT FAILED IN UPSERTCALLLOG: %v", err)
		return err
	}
	return nil
}
