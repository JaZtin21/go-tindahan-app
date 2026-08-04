package redis

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

// ConnectRedis initializes and validates the Redis client connection.
func ConnectRedis(addr string, password string, db int) (*redis.Client, error) {
	var opt *redis.Options
	var err error

	// 1. Check if the incoming address is an Upstash connection URL
	if strings.HasPrefix(addr, "redis://") || strings.HasPrefix(addr, "rediss://") {
		opt, err = redis.ParseURL(addr)
		if err != nil {
			return nil, fmt.Errorf("unable to parse cloud redis url: %w", err)
		}
	} else {
		// Fallback for standard local development configurations
		opt = &redis.Options{
			Addr:     addr,
			Password: password,
			DB:       db,
		}
	}

	// 2. Initialize the client using the processed configuration
	client := redis.NewClient(opt)

	// 3. Enforce a 3-second strict time passport for the network ping
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	// 4. Ping Redis live over the network using the semicolon short-assignment shortcut!
	if err := client.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("unable to connect to redis: %w", err)
	}

	fmt.Println("Successfully connected to Redis cache layer!")

	// 5. Return the active client memory pointer and a null placeholder error
	return client, nil
}
