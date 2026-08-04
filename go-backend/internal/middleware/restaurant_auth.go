package middleware

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
)

// CachedRestaurantUser is intentionally the same shape as CachedUser — no
// restaurant_id here. Which restaurant(s) this account can act on is looked
// up per-request against restaurant_staff (see utils.RequireRestaurantStaff),
// because one account can own/manage multiple restaurants.
type CachedRestaurantUser struct {
	ID    string `json:"id"`
	Email string `json:"email"`
}

// RestaurantAuthMiddleware is a parallel session system to AuthMiddleware —
// separate Redis key prefix ("restaurant_auth:") and separate context key
// ("currentRestaurantUser") so dashboard/owner sessions never collide with
// diner sessions, even if the same person is somehow logged into both.
func RestaurantAuthMiddleware(redisClient *redis.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")

		if authHeader == "" {
			c.Next()
			return
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.Next()
			return
		}
		accessToken := parts[1]

		redisKey := fmt.Sprintf("restaurant_auth:%s", accessToken)
		sessionJSON, err := redisClient.Get(c.Request.Context(), redisKey).Result()

		if err == nil {
			var restaurantUser CachedRestaurantUser
			if err := json.Unmarshal([]byte(sessionJSON), &restaurantUser); err == nil {
				ctx := context.WithValue(c.Request.Context(), "currentRestaurantUser", restaurantUser)
				c.Request = c.Request.WithContext(ctx)
			}
		}

		c.Next()
	}
}
