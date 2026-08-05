package middleware

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"log"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
)

// VapiSignatureMiddleware verifies the HMAC-SHA256 signature Vapi attaches to
// every webhook request. Vapi signs the raw request body with your webhook
// secret and sends the hex-encoded digest in the "x-vapi-signature" header.
//
// This is the official Vapi webhook auth mechanism — no token headers, no
// second layer. Fail-closed: if VAPI_WEBHOOK_SECRET is unset (e.g. the
// placeholder in .env), every request is rejected so the missing config can't
// be missed in production.
func VapiSignatureMiddleware() gin.HandlerFunc {
	secret := os.Getenv("VAPI_WEBHOOK_SECRET")

	return func(c *gin.Context) {
		if secret == "" {
			log.Println("🔴 VAPI_WEBHOOK_SECRET is not set — rejecting webhook requests (fail closed)")
			c.AbortWithStatusJSON(http.StatusServiceUnavailable, gin.H{"error": "webhook not configured"})
			return
		}

		signature := c.GetHeader("x-vapi-signature")
		if signature == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing x-vapi-signature"})
			return
		}

		body, err := c.GetRawData()
		if err != nil {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "cannot read request body"})
			return
		}

		mac := hmac.New(sha256.New, []byte(secret))
		mac.Write(body)
		expected := hex.EncodeToString(mac.Sum(nil))

		if !hmac.Equal([]byte(signature), []byte(expected)) {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid webhook signature"})
			return
		}

		// NOTE: Gin's GetRawData caches the body and re-seats c.Request.Body
		// with a fresh reader, so the handler can read it again (it calls
		// GetRawData too and gets the cached bytes).
		c.Next()
	}
}
