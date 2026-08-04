package utils

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"time"

	"go-backend/internal/graph/model"
	"go-backend/internal/middleware"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
	"golang.org/x/crypto/bcrypt"
)

// RestaurantSessionTTL and RestaurantRefreshCookieName live here (not in a
// *.resolvers.go file) so gqlgen's `go generate` never strips them — it only
// quarantines non-resolver code inside files matching your resolver
// filename pattern.
const RestaurantSessionTTL = 30 * 24 * time.Hour
const RestaurantRefreshCookieName = "restaurant_refresh_token"

// ----------------------------------------------------------------------------
// PERMISSION CHECKS
// ----------------------------------------------------------------------------

// RequireRestaurantStaff checks that the currentUser on ctx has a
// restaurant_staff row for the given restaurantID, with sufficient role.
// The unified AuthMiddleware injects the same CachedUser for both diner and
// restaurant sessions (it checks the "auth:" prefix, then falls back to
// "restaurant_auth:"), so we read the shared "currentUser" key here.
//
// Returns the caller's role on that restaurant, or an error if unauthorized.
func RequireRestaurantStaff(ctx context.Context, db *pgxpool.Pool, restaurantID string, allowStaffRole bool) (string, error) {
	currentUser, ok := ctx.Value("currentUser").(middleware.CachedUser)
	if !ok || currentUser.ID == "" {
		return "", errors.New("unauthorized: no restaurant session found")
	}

	var role string
	err := db.QueryRow(ctx, `
		SELECT role FROM restaurant_staff WHERE restaurant_id = $1 AND owner_id = $2
	`, restaurantID, currentUser.ID).Scan(&role)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", fmt.Errorf("forbidden: you do not have access to this restaurant")
		}
		return "", err
	}

	// Roles are stored uppercase in the DB (matches chk_restaurant_staff_role).
	if !allowStaffRole && role == "STAFF" {
		return "", fmt.Errorf("forbidden: this action requires owner or manager privileges")
	}

	return role, nil
}

// ----------------------------------------------------------------------------
// POSTGRES ERROR HELPERS
// ----------------------------------------------------------------------------

// IsExclusionViolation detects Postgres error 23P01 — fires when the
// bookings EXCLUDE constraint rejects an overlapping table/time_range insert
// or update (i.e. the table is already booked for that window).
func IsExclusionViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23P01"
}

// IsUniqueViolation detects Postgres error 23505 — same pattern as your
// existing barcode-conflict handling in AddInventoryItem.
func IsUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}

// IsForeignKeyViolation detects Postgres error 23503 — fires when an insert
// references a row that doesn't exist (e.g. a waitlist entry pointing at a
// missing restaurant or customer).
func IsForeignKeyViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23503"
}

// ----------------------------------------------------------------------------
// PASSWORD + SESSION HELPERS (for the restaurant owner auth resolvers)
// ----------------------------------------------------------------------------

func HashPassword(password string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(hash), nil
}

func CheckPassword(password, hash string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
}

// GenerateAccessToken produces a random opaque token — same style session
// system as your Google login, just a different Redis key prefix.
func GenerateAccessToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.URLEncoding.EncodeToString(b), nil
}

// CreateRestaurantSession stores the session in Redis under
// "restaurant_auth:<token>", mirroring the "auth:<token>" pattern your
// AuthMiddleware reads from for diner sessions.
func CreateRestaurantSession(ctx context.Context, redisClient *redis.Client, cached middleware.CachedUser, ttl time.Duration) (string, error) {
	token, err := GenerateAccessToken()
	if err != nil {
		return "", err
	}

	payload, err := json.Marshal(cached)
	if err != nil {
		return "", err
	}

	redisKey := fmt.Sprintf("restaurant_auth:%s", token)
	if err := redisClient.Set(ctx, redisKey, payload, ttl).Err(); err != nil {
		return "", err
	}

	return token, nil
}

// GetRestaurantSession looks up a cached session by token — same lookup
// AuthMiddleware does inline, exposed here so resolvers (e.g.
// RefreshRestaurantToken) can reuse it directly.
func GetRestaurantSession(ctx context.Context, redisClient *redis.Client, accessToken string) (*middleware.CachedUser, error) {
	redisKey := fmt.Sprintf("restaurant_auth:%s", accessToken)
	sessionJSON, err := redisClient.Get(ctx, redisKey).Result()
	if err != nil {
		return nil, err
	}

	var cached middleware.CachedUser
	if err := json.Unmarshal([]byte(sessionJSON), &cached); err != nil {
		return nil, err
	}

	return &cached, nil
}

// DeleteRestaurantSession wipes the Redis key on logout — mirrors your
// existing logout mutation's cache-clear behavior.
func DeleteRestaurantSession(ctx context.Context, redisClient *redis.Client, accessToken string) error {
	redisKey := fmt.Sprintf("restaurant_auth:%s", accessToken)
	return redisClient.Del(ctx, redisKey).Err()
}

// GetRestaurantByID fetches a single restaurant by id. Lives here (not in a
// resolvers.go file) so it survives `go generate`, and is callable from
// both mutationResolver and queryResolver methods without the
// can't-call-across-resolver-types problem, since it isn't a method on
// either.
func GetRestaurantByID(ctx context.Context, db *pgxpool.Pool, id string) (*model.Restaurant, error) {
	var res model.Restaurant
	var createdAt, updatedAt time.Time

	err := db.QueryRow(ctx, `
		SELECT id, name, phone, email, address_line1, suburb, state, postcode, timezone,
			cuisine_type, seating_type, default_turn_duration_min, booking_buffer_min,
			max_party_size, is_active, created_at, updated_at
		FROM restaurants WHERE id = $1
	`, id).Scan(
		&res.ID, &res.Name, &res.Phone, &res.Email, &res.AddressLine1, &res.Suburb, &res.State, &res.Postcode,
		&res.Timezone, &res.CuisineType, &res.SeatingType, &res.DefaultTurnDurationMin, &res.BookingBufferMin,
		&res.MaxPartySize, &res.IsActive, &createdAt, &updatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		log.Printf("🔴 DATABASE QUERY FAILED IN GETRESTAURANTBYID: %v", err)
		return nil, err
	}

	res.CreatedAt = createdAt.Format(time.RFC3339)
	res.UpdatedAt = updatedAt.Format(time.RFC3339)
	return &res, nil
}

// LoadOwnerRestaurantRoles returns every restaurant an owner account has a
// role on, with that role attached. Used to populate RestaurantOwner.restaurants
// (a non-null list — must never return nil, only an empty slice at worst).
func LoadOwnerRestaurantRoles(ctx context.Context, db *pgxpool.Pool, ownerID string) ([]*model.RestaurantStaffRole, error) {
	rows, err := db.Query(ctx, `
		SELECT rs.role, res.id, res.name, res.phone, res.email, res.address_line1, res.suburb,
			res.state, res.postcode, res.timezone, res.cuisine_type, res.seating_type,
			res.default_turn_duration_min, res.booking_buffer_min, res.max_party_size,
			res.is_active, res.created_at, res.updated_at
		FROM restaurant_staff rs
		JOIN restaurants res ON res.id = rs.restaurant_id
		WHERE rs.owner_id = $1
	`, ownerID)
	if err != nil {
		log.Printf("🔴 DATABASE QUERY FAILED IN LOADOWNERRESTAURANTROLES: %v", err)
		return nil, err
	}
	defer rows.Close()

	var results []*model.RestaurantStaffRole
	for rows.Next() {
		var role string
		var res model.Restaurant
		var createdAt, updatedAt time.Time
		if err := rows.Scan(
			&role, &res.ID, &res.Name, &res.Phone, &res.Email, &res.AddressLine1, &res.Suburb,
			&res.State, &res.Postcode, &res.Timezone, &res.CuisineType, &res.SeatingType,
			&res.DefaultTurnDurationMin, &res.BookingBufferMin, &res.MaxPartySize,
			&res.IsActive, &createdAt, &updatedAt,
		); err != nil {
			log.Printf("⚠️ Failed to scan restaurant role row: %v", err)
			continue
		}
		res.CreatedAt = createdAt.Format(time.RFC3339)
		res.UpdatedAt = updatedAt.Format(time.RFC3339)
		results = append(results, &model.RestaurantStaffRole{
			Restaurant: &res,
			Role:       model.RestaurantUserRole(role),
		})
	}

	if results == nil {
		results = []*model.RestaurantStaffRole{}
	}
	return results, nil
}

// GetGinContext pulls the *gin.Context back out of the request context.
// VERIFY this matches how your server actually injects it (check your
// gqlgen HTTP handler setup / whatever middleware puts it on ctx under this
// key) — adjust the key string if yours differs.
func GetGinContext(ctx context.Context) *gin.Context {
	gc, _ := ctx.Value("ginContext").(*gin.Context)
	return gc
}

// ExtractBearerToken pulls the raw token out of the Authorization header.
func ExtractBearerToken(gc *gin.Context) string {
	authHeader := gc.GetHeader("Authorization")
	if len(authHeader) > 7 && authHeader[:7] == "Bearer " {
		return authHeader[7:]
	}
	return ""
}

// CreateRestaurantSessionAndCookie stores the session in Redis and sets the
// HttpOnly refresh cookie on the response, in one call. Takes plain
// id/email rather than the graph/model.RestaurantOwner type so this package
// never has to import graph/model (would risk an import cycle since
// resolvers import utils, not the other way around).
func CreateRestaurantSessionAndCookie(ctx context.Context, redisClient *redis.Client, ownerID string, ownerEmail string) (string, error) {
	cached := middleware.CachedUser{ID: ownerID, Email: ownerEmail}

	accessToken, err := CreateRestaurantSession(ctx, redisClient, cached, RestaurantSessionTTL)
	if err != nil {
		log.Printf("🔴 FAILED TO CREATE RESTAURANT SESSION: %v", err)
		return "", err
	}

	if gc := GetGinContext(ctx); gc != nil {
		// NOTE: reusing the access token as the refresh cookie value is a
		// simplification. If your diner-side refresh flow uses a distinct
		// rotating refresh token, mirror that here instead so both auth
		// systems behave the same way.
		gc.SetCookie(RestaurantRefreshCookieName, accessToken, int(RestaurantSessionTTL.Seconds()), "/", "", true, true)
	}

	return accessToken, nil
}
