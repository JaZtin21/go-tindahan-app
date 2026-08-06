package utils

import (
	"context"
	"errors"
	"fmt"
	"log"
	"time"

	"go-backend/internal/graph/model"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ----------------------------------------------------------------------------
// RESTAURANT INFO & MENU + CANCEL-BY-PHONE OPERATIONS
//
// Shared source of truth for the voice agent's restaurant_info and
// cancel_booking tools and the staff dashboard's menu management. Lives in
// utils so it survives `go generate`.
// ----------------------------------------------------------------------------

// BookingWithTableNumber pairs a booking with its physical table number (the
// dashboard shows table numbers, the model.Booking type only carries the id).
type BookingWithTableNumber struct {
	Booking     *model.Booking
	TableNumber *string
}

// RestaurantInfo aggregates everything the restaurant_info tool reads aloud:
// identity/address, weekly hours, closures, and menu items. Fields are kept
// pointer-free where the tool message building wants plain strings.
type RestaurantInfo struct {
	RestaurantID      string
	Name              string
	Phone             string
	Email             *string
	AddressLine1      string
	Suburb            string
	State             string
	Postcode          string
	Timezone          string
	CuisineType       *string
	Description       *string
	ParkingInfo       *string
	MaxPartySize      int
	TodayLocal        string   // restaurant-local today (YYYY-MM-DD)
	TodayLocalDisplay string   // e.g. "Wednesday, August 5, 2026" (restaurant-local)
	NowLocalTime      string   // e.g. "5:30 PM" (restaurant-local current time)
	DayDate           string   // date whose hours were resolved (requested or today)
	DayHours          string   // e.g. "12:00 PM – 9:00 PM" or "Closed"
	WeeklyHours       []string // one human summary per weekday (0 = Sunday)
	UpcomingClosures  []string // closure dates with reason, next 30 days
	MenuItems         []*model.MenuItem
}

// LoadMenuItems returns all menu items for a restaurant, available first,
// ordered by sort_order then name. Empty list when the restaurant has none.
func LoadMenuItems(ctx context.Context, db *pgxpool.Pool, restaurantID string) ([]*model.MenuItem, error) {
	rows, err := db.Query(ctx, `
		SELECT id, restaurant_id, name, COALESCE(description, ''), price_cents,
			COALESCE(category, ''), is_available, COALESCE(allergens, '{}'), sort_order
		FROM menu_items
		WHERE restaurant_id = $1
		ORDER BY is_available DESC, sort_order ASC, name ASC
	`, restaurantID)
	if err != nil {
		log.Printf("🔴 DATABASE QUERY FAILED IN LOADMENUITEMS: %v", err)
		return nil, err
	}
	defer rows.Close()

	var items []*model.MenuItem
	for rows.Next() {
		var m model.MenuItem
		var desc, category string
		var allergens []string
		if err := rows.Scan(
			&m.ID, &m.RestaurantID, &m.Name, &desc, &m.PriceCents,
			&category, &m.IsAvailable, &allergens, &m.SortOrder,
		); err != nil {
			log.Printf("⚠️ Failed to scan menu item row: %v", err)
			continue
		}
		m.Description = &desc
		m.Category = &category
		m.Allergens = allergens
		items = append(items, &m)
	}

	if items == nil {
		items = []*model.MenuItem{}
	}
	return items, nil
}

// LoadRestaurantInfo loads the restaurant profile plus resolved weekly hours,
// closures, and menu items for the restaurant_info tool. dateStr is optional —
// when empty the "day hours" resolve to the restaurant's local today.
func LoadRestaurantInfo(ctx context.Context, db *pgxpool.Pool, restaurantID, dateStr string) (*RestaurantInfo, error) {
	info := &RestaurantInfo{RestaurantID: restaurantID, DayDate: dateStr}

	err := db.QueryRow(ctx, `
		SELECT name, phone, email, address_line1, suburb, state, postcode, timezone,
			cuisine_type, description, parking_info, max_party_size
		FROM restaurants WHERE id = $1
	`, restaurantID).Scan(
		&info.Name, &info.Phone, &info.Email, &info.AddressLine1, &info.Suburb, &info.State, &info.Postcode,
		&info.Timezone, &info.CuisineType, &info.Description, &info.ParkingInfo, &info.MaxPartySize,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, NewBookingError(CodeNotFound, "not found: restaurant does not exist", err)
		}
		log.Printf("🔴 DATABASE QUERY FAILED IN LOADRESTAURANTINFO: %v", err)
		return nil, err
	}

	loc := time.UTC
	if info.Timezone != "" {
		if l, err := time.LoadLocation(info.Timezone); err == nil {
			loc = l
		} else {
			log.Printf("⚠️ LoadRestaurantInfo: unknown timezone %q, falling back to UTC: %v", info.Timezone, err)
		}
	}
	now := time.Now().In(loc)
	info.TodayLocal = now.Format("2006-01-02")
	info.TodayLocalDisplay = now.Format("Monday, January 2, 2006")
	info.NowLocalTime = now.Format("3:04 PM")

	// Weekly hours, human summaries per weekday.
	weekdayNames := []string{"Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"}
	hoursByDay := map[int]string{}
	rows, err := db.Query(ctx, `
		SELECT day_of_week, open_time::text, close_time::text, is_closed
		FROM operating_hours WHERE restaurant_id = $1 ORDER BY day_of_week ASC
	`, restaurantID)
	if err != nil {
		log.Printf("🔴 OPERATING HOURS QUERY FAILED IN LOADRESTAURANTINFO: %v", err)
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var dow int
		var open, close *string
		var isClosed bool
		if err := rows.Scan(&dow, &open, &close, &isClosed); err != nil {
			log.Printf("⚠️ Failed to scan operating hour row: %v", err)
			continue
		}
		if isClosed || open == nil || close == nil {
			continue // closed day — leave the map empty
		}
		hoursByDay[dow] = formatClockRange(*open, *close)
	}
	if err := rows.Err(); err != nil {
		log.Printf("🔴 OPERATING HOURS ROW ITERATION FAILED IN LOADRESTAURANTINFO: %v", err)
		return nil, err
	}

	if len(hoursByDay) > 0 {
		for d := 0; d < 7; d++ {
			if v, ok := hoursByDay[d]; ok {
				info.WeeklyHours = append(info.WeeklyHours, weekdayNames[d]+": "+v)
			} else {
				info.WeeklyHours = append(info.WeeklyHours, weekdayNames[d]+": Closed")
			}
		}
	} else {
		info.WeeklyHours = []string{}
	}

	// Resolve the day that matters (requested date or local today).
	day := info.TodayLocal
	if dateStr != "" {
		day = dateStr
	}
	info.DayDate = day
	info.DayHours = "Closed" // default — corrected below if open
	if parsedDay, err := time.ParseInLocation("2006-01-02", day, loc); err == nil {
		var closedDay bool
		if err := db.QueryRow(ctx,
			`SELECT EXISTS(SELECT 1 FROM closures WHERE restaurant_id = $1 AND closure_date = $2::date)`,
			restaurantID, day,
		).Scan(&closedDay); err != nil {
			log.Printf("🔴 CLOSURES QUERY FAILED IN LOADRESTAURANTINFO: %v", err)
			return nil, err
		}
		if !closedDay {
			if v, ok := hoursByDay[int(parsedDay.Weekday())]; ok {
				info.DayHours = v
			}
		}
	}

	// Upcoming closures (next 30 days) so Riley can warn callers in advance.
	closureRows, err := db.Query(ctx, `
		SELECT closure_date::text, COALESCE(reason, '')
		FROM closures
		WHERE restaurant_id = $1 AND closure_date >= CURRENT_DATE
		ORDER BY closure_date ASC
		LIMIT 10
	`, restaurantID)
	if err != nil {
		log.Printf("🔴 CLOSURES QUERY FAILED IN LOADRESTAURANTINFO: %v", err)
		return nil, err
	}
	defer closureRows.Close()
	for closureRows.Next() {
		var d, reason string
		if err := closureRows.Scan(&d, &reason); err != nil {
			log.Printf("⚠️ Failed to scan closure row: %v", err)
			continue
		}
		if reason != "" {
			d = d + " (" + reason + ")"
		}
		info.UpcomingClosures = append(info.UpcomingClosures, d)
	}
	if err := closureRows.Err(); err != nil {
		log.Printf("🔴 CLOSURES ROW ITERATION FAILED IN LOADRESTAURANTINFO: %v", err)
		return nil, err
	}

	menu, err := LoadMenuItems(ctx, db, restaurantID)
	if err != nil {
		return nil, err
	}
	info.MenuItems = menu
	return info, nil
}

// FindBookingsByPhone lists a caller's upcoming (non-cancelled) bookings for a
// restaurant, optionally narrowed to one local calendar date. Used by the
// cancel_booking tool so the voice agent can confirm which booking to cancel.
func FindBookingsByPhone(ctx context.Context, db *pgxpool.Pool, restaurantID, phone string, dateStr string) ([]*BookingWithTableNumber, error) {
	var dateArg any
	if dateStr != "" {
		dateArg = dateStr
	}

	rows, err := db.Query(ctx, `
		SELECT b.id, b.restaurant_id, b.customer_id, b.table_id, b.party_size, b.booking_time,
			b.duration_minutes, b.status, b.special_requests, b.payment_status, b.source, b.created_at, b.updated_at,
			rt.table_number
		FROM bookings b
		JOIN customers c ON c.id = b.customer_id
		LEFT JOIN restaurant_tables rt ON rt.id = b.table_id
		WHERE b.restaurant_id = $1 AND c.phone = $2
			AND b.status NOT IN ('CANCELLED', 'NO_SHOW')
			AND b.booking_time >= NOW()
			AND ($3::date IS NULL OR b.booking_time::date = $3::date)
		ORDER BY b.booking_time ASC
	`, restaurantID, phone, dateArg)
	if err != nil {
		log.Printf("🔴 DATABASE QUERY FAILED IN FINDBOOKINGSBYPHONE: %v", err)
		return nil, err
	}
	defer rows.Close()

	var results []*BookingWithTableNumber
	for rows.Next() {
		var b model.Booking
		var bt, createdAt, updatedAt time.Time
		var tableNumber *string
		if err := rows.Scan(
			&b.ID, &b.RestaurantID, &b.CustomerID, &b.TableID, &b.PartySize, &bt,
			&b.DurationMinutes, &b.Status, &b.SpecialRequests, &b.PaymentStatus, &b.Source, &createdAt, &updatedAt,
			&tableNumber,
		); err != nil {
			log.Printf("⚠️ Failed to scan booking row in FindBookingsByPhone: %v", err)
			continue
		}
		b.BookingTime = bt.Format(time.RFC3339)
		b.CreatedAt = createdAt.Format(time.RFC3339)
		b.UpdatedAt = updatedAt.Format(time.RFC3339)
		results = append(results, &BookingWithTableNumber{Booking: &b, TableNumber: tableNumber})
	}

	if results == nil {
		results = []*BookingWithTableNumber{}
	}
	return results, nil
}

// CancelBookingByID cancels a booking, but only if it belongs to the given
// restaurant AND the customer whose phone matches — the ownership guard that
// makes cancel-by-phone safe (a caller can only cancel their own booking).
// Returns a BookingError with code NOT_FOUND when nothing matches.
func CancelBookingByID(ctx context.Context, db *pgxpool.Pool, bookingID, restaurantID, phone string) (*model.Booking, error) {
	var b model.Booking
	var bt, createdAt, updatedAt time.Time
	err := db.QueryRow(ctx, `
		UPDATE bookings b SET status = 'CANCELLED', updated_at = NOW()
		FROM customers c
		WHERE b.id = $1 AND b.restaurant_id = $2 AND c.id = b.customer_id AND c.phone = $3
			AND b.status NOT IN ('COMPLETED', 'NO_SHOW')
		RETURNING b.id, b.restaurant_id, b.customer_id, b.table_id, b.party_size, b.booking_time,
			b.duration_minutes, b.status, b.special_requests, b.payment_status, b.source, b.created_at, b.updated_at
	`, bookingID, restaurantID, phone).Scan(
		&b.ID, &b.RestaurantID, &b.CustomerID, &b.TableID, &b.PartySize, &bt,
		&b.DurationMinutes, &b.Status, &b.SpecialRequests, &b.PaymentStatus, &b.Source, &createdAt, &updatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, NewBookingError(CodeNotFound, "no booking found for this phone number", nil)
		}
		log.Printf("🔴 DATABASE UPDATE FAILED IN CANCELBOOKINGBYID: %v", err)
		return nil, NewBookingError(CodeInternal, "internal server error: failed to cancel booking", err)
	}

	b.BookingTime = bt.Format(time.RFC3339)
	b.CreatedAt = createdAt.Format(time.RFC3339)
	b.UpdatedAt = updatedAt.Format(time.RFC3339)
	return &b, nil
}

// formatClockRange renders an "HH:MM" open/close pair as a spoken-friendly
// range like "12:00 PM – 9:00 PM", handling overnight service (close < open).
func formatClockRange(openStr, closeStr string) string {
	openMin, ok1 := parseClockMinutes(openStr)
	closeMin, ok2 := parseClockMinutes(closeStr)
	if !ok1 || !ok2 {
		return openStr + " – " + closeStr
	}
	if closeMin < openMin {
		closeMin += 24 * 60
	}
	return fmt.Sprintf("%s – %s", minutesToClock(openMin), minutesToClock(closeMin))
}

// minutesToClock renders minutes-since-midnight as a 12-hour clock string.
func minutesToClock(m int) string {
	m = ((m % 1440) + 1440) % 1440
	hour := m / 60
	min := m % 60
	suffix := "AM"
	if hour >= 12 {
		suffix = "PM"
	}
	h12 := hour % 12
	if h12 == 0 {
		h12 = 12
	}
	if min == 0 {
		return fmt.Sprintf("%d:00 %s", h12, suffix)
	}
	return fmt.Sprintf("%d:%02d %s", h12, min, suffix)
}
