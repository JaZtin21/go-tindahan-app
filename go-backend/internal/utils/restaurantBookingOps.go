package utils

import (
	"context"
	"errors"
	"fmt"
	"log"
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
	if err := db.QueryRow(ctx,
		`SELECT default_turn_duration_min FROM restaurants WHERE id = $1`, input.RestaurantID,
	).Scan(&turnDuration); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, NewBookingError(CodeNotFound, "not found: restaurant does not exist", err)
		}
		return nil, err
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
