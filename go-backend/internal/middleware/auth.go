package middleware

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
)

type CachedUser struct {
	ID    string `json:"id"`
	Email string `json:"email"`
}

func AuthMiddleware(redisClient *redis.Client) gin.HandlerFunc {
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
		var sessionJSON string
		var err error

		// 1. Check the regular session profile prefix first
		dinerKey := fmt.Sprintf("auth:%s", accessToken)
		sessionJSON, err = redisClient.Get(c.Request.Context(), dinerKey).Result()

		// 2. Fallback: If not found, check the restaurant session profile prefix second
		if err != nil {
			restaurantKey := fmt.Sprintf("restaurant_auth:%s", accessToken)
			sessionJSON, err = redisClient.Get(c.Request.Context(), restaurantKey).Result()
		}

		// 3. If either check succeeded, unmarshal into your clean, active user schema context
		if err == nil {
			var user CachedUser
			if err := json.Unmarshal([]byte(sessionJSON), &user); err == nil {
				ctx := context.WithValue(c.Request.Context(), "currentUser", user)
				c.Request = c.Request.WithContext(ctx)
			}
		}

		c.Next()
	}
}
