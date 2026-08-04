package model

import "time"

// RestaurantOwner represents a dashboard login account. One account can be
// linked to many restaurants via RestaurantStaff (see restaurant_staff table),
// so this struct intentionally has no restaurant_id — ownership is looked up
// separately, not baked into the account row.
type RestaurantOwner struct {
	ID           string    `json:"id" db:"id"`
	FirstName    string    `json:"firstName" db:"first_name"`
	LastName     string    `json:"lastName" db:"last_name"`
	Email        string    `json:"email" db:"email"`
	PasswordHash string    `json:"-" db:"password_hash"` // never serialized to GraphQL
	CreatedAt    time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt    time.Time `json:"updatedAt" db:"updated_at"`
}

// RestaurantStaff is the join row linking an owner account to a specific
// restaurant with a role. This is what permission checks query against.
type RestaurantStaff struct {
	ID           string    `json:"id" db:"id"`
	RestaurantID string    `json:"restaurantId" db:"restaurant_id"`
	OwnerID      string    `json:"ownerId" db:"owner_id"`
	Role         string    `json:"role" db:"role"` // "owner" | "manager" | "staff"
	CreatedAt    time.Time `json:"createdAt" db:"created_at"`
}

// RestaurantLoginInput / RestaurantRegisterInput / RestaurantAuthResponse
// mirror your GoogleLoginInput / AuthResponse pattern, but for email+password
// since this is a business dashboard login, not a diner-facing Google login.

type RestaurantRegisterInput struct {
	FirstName string `json:"firstName"`
	LastName  string `json:"lastName"`
	Email     string `json:"email"`
	Password  string `json:"password"`
}

type RestaurantLoginInput struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type RestaurantAuthResponse struct {
	Owner       *RestaurantOwner `json:"owner"`
	AccessToken string           `json:"accessToken"`
}

type RestaurantRefreshResponse struct {
	AccessToken string           `json:"accessToken"`
	Owner       *RestaurantOwner `json:"owner"`
}

// InviteRestaurantStaffInput — used by an existing owner/manager to add
// another account to their restaurant with a given role.
type InviteRestaurantStaffInput struct {
	RestaurantID string `json:"restaurantId"`
	Email        string `json:"email"` // must belong to an existing restaurant_owners account
	Role         string `json:"role"`  // "manager" | "staff" (never "owner" via invite)
}
