package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"time"

	"go-backend/internal/config"
	"go-backend/internal/database"
	"go-backend/internal/redis"

	"os"
	"strings"

	"github.com/joho/godotenv"

	"go-backend/internal/graph"

	resolver "go-backend/internal/graph/resolvers"

	"go-backend/internal/middleware"
	"go-backend/internal/vapi"

	"github.com/vektah/gqlparser/v2/gqlerror"

	"github.com/99designs/gqlgen/graphql"
	"github.com/99designs/gqlgen/graphql/handler"
	"github.com/gin-gonic/gin"
)

func ginCORSConfig() gin.HandlerFunc {
	return func(c *gin.Context) {
		originEnv := os.Getenv("ALLOWED_ORIGINS")
		allowedOrigins := strings.Split(originEnv, ",")
		requestOrigin := c.Request.Header.Get("Origin")

		for _, origin := range allowedOrigins {
			cleanOrigin := strings.TrimSpace(origin)
			if requestOrigin == cleanOrigin {
				c.Writer.Header().Set("Access-Control-Allow-Origin", requestOrigin)
				break
			}
		}

		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")

		// Intercept preflight OPTIONS checks instantly
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusOK)
			return
		}

		c.Next()
	}
}

func main() {
	// 1. Auto-load local environment variables
	if err := godotenv.Load(); err != nil {
		log.Println("Notice: No .env file found, relying on default configuration fallbacks.")
	}

	cfg := config.LoadConfig()
	fmt.Printf("Starting Gin application server on port %s...\n", cfg.Port)

	// 2. Initialize database structures
	dbPool, err := database.ConnectPostgres(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Critical Failure: PostgreSQL could not connect: %v", err)
	}
	defer dbPool.Close()

	redisClient, err := redis.ConnectRedis(cfg.RedisAddr, "", 0)
	if err != nil {
		log.Fatalf("Critical Failure: Redis could not connect: %v", err)
	}
	defer redisClient.Close()

	// 3. Set Gin mode based on your environment profile
	if os.Getenv("GO_ENV") == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	// 4. Initialize Gin router with default logger and recovery middleware
	r := gin.Default()

	// Apply your custom CORS configuration
	r.Use(ginCORSConfig())

	// 5. Port over your health check endpoint
	r.GET("/health", func(c *gin.Context) {
		c.String(http.StatusOK, "Your infrastructure layers are completely alive and online!")
	})

	// 6. Initialize GraphQL Engine Engine
	gqlConfig := graph.Config{
		Resolvers: &resolver.Resolver{
			DB:    dbPool,
			Redis: redisClient,
		},
	}

	// B. Attach your custom directive bouncer directly onto that configuration layout
	gqlConfig.Directives.IsAuthenticated = func(ctx context.Context, obj interface{}, next graphql.Resolver) (res interface{}, err error) {
		// Check if the global middleware flagged the token as expired
		if isExpired, ok := ctx.Value("tokenExpired").(bool); ok && isExpired {
			return nil, &gqlerror.Error{
				Message: "session expired: please refresh your access token",
				Extensions: map[string]interface{}{
					"code": "TOKEN_EXPIRED",
				},
			}
		}

		// Check if the user is missing entirely (passed no token or a bad token)
		currentUser, ok := ctx.Value("currentUser").(middleware.CachedUser)
		if !ok || currentUser.ID == "" {
			return nil, &gqlerror.Error{
				Message: "unauthorized: authentication required for this action",
				Extensions: map[string]interface{}{
					"code": "UNAUTHENTICATED",
				},
			}
		}

		// Success! Pass control over to the actual GraphQL Resolver function code.
		return next(ctx)
	}

	// C. Finally, pass the completed configuration blueprint into your Server Engine
	srv := handler.NewDefaultServer(graph.NewExecutableSchema(gqlConfig))

	// 7. Bind GraphQL and inject both Context layers (Gin + Redis Auth User)
	r.POST("/query", middleware.AuthMiddleware(redisClient), func(c *gin.Context) {
		// Pass the Gin Context for things like cookies (needed by your login flow)
		ctx := context.WithValue(c.Request.Context(), "ginContext", c)
		c.Request = c.Request.WithContext(ctx)

		srv.ServeHTTP(c.Writer, c.Request)
	})

	// 7b. Vapi voice-agent webhook — HMAC-signed, standalone (no GraphQL).
	// Vapi tool calls arrive here; the dispatcher reuses the same booking
	// logic as the public GraphQL resolvers via internal/utils.
	vapiHandler := vapi.NewHandler(dbPool)
	r.POST("/vapi/webhook", middleware.VapiSignatureMiddleware(), vapiHandler.Handle)

	// 8. Configure server network performance timeouts
	server := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      r, // Gin engine handles all routing requests now
		WriteTimeout: 15 * time.Second,
		ReadTimeout:  15 * time.Second,
	}

	log.Printf("GraphQL engine actively listening on: http://localhost:%s/query", cfg.Port)
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("Server network connection broken: %v", err)
	}
}
