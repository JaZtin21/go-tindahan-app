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
// every webhook request, using the secret in VAPI_WEBHOOK_SECRET.
//
// Header name: Vapi's default is "x-vapi-signature", but the HMAC credential
// in the dashboard lets you pick any name (e.g. "x-signature"). We accept
// both so the credential config and this code can't drift apart.
//
// Payload format: the credential has an "Include Timestamp" toggle and a
// "Payload Format" template. When timestamp is OFF, Vapi signs the raw body.
// When it's ON (with the default template "{timestamp}.{body}"), Vapi signs
// "<timestamp>.<body>" and sends the timestamp in the configured timestamp
// header. We try raw-body first, then timestamped — so either dashboard
// config verifies. Both paths require the same secret, so this is not a
// security hole.
//
// Fail-closed: if VAPI_WEBHOOK_SECRET is unset (e.g. the placeholder in
// .env), every request is rejected so the missing config can't be missed in
// production.
func VapiSignatureMiddleware() gin.HandlerFunc {
	secret := os.Getenv("VAPI_WEBHOOK_SECRET")

	return func(c *gin.Context) {
		remote := c.ClientIP()

		if secret == "" {
			log.Printf("🔴 VAPI WEBHOOK AUTH: rejected request from %s — VAPI_WEBHOOK_SECRET is not set (fail closed)", remote)
			c.AbortWithStatusJSON(http.StatusServiceUnavailable, gin.H{"error": "webhook not configured"})
			return
		}

		signature := c.GetHeader("x-vapi-signature")
		if signature == "" {
			signature = c.GetHeader("x-signature")
		}
		if signature == "" {
			log.Printf("🔴 VAPI WEBHOOK AUTH: rejected request from %s — no signature header (checked x-vapi-signature, x-signature)", remote)
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing signature header"})
			return
		}

		body, err := c.GetRawData()
		if err != nil {
			log.Printf("🔴 VAPI WEBHOOK AUTH: rejected request from %s — cannot read body: %v", remote, err)
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "cannot read request body"})
			return
		}

		if !verifySignature(secret, signature, body, c) {
			log.Printf("🔴 VAPI WEBHOOK AUTH: signature mismatch from %s — received=%s..., timestampHeader=%s. Check VAPI_WEBHOOK_SECRET matches the dashboard secret and Include Timestamp/Payload Format match",
				remote, truncate(signature, 12), c.GetHeader("x-timestamp"))

			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid webhook signature"})
			return
		}

		// NOTE: Gin's GetRawData caches the body and re-seats c.Request.Body
		// with a fresh reader, so the handler can read it again (it calls
		// GetRawData too and gets the cached bytes).
		c.Next()
	}
}

// verifySignature checks the signature against the raw body, and — when a
// timestamp header is present — against "<timestamp>.<body>" (Vapi's
// "{timestamp}.{body}" payload format).
func verifySignature(secret, signature string, body []byte, c *gin.Context) bool {
	// Path 1: Include Timestamp OFF — HMAC over the raw body.
	if hmacEqual(secret, signature, body) {
		return true
	}

	// Path 2: Include Timestamp ON — HMAC over "<timestamp>.<body>", with the
	// timestamp value taken from the timestamp header exactly as sent.
	timestamp := c.GetHeader("x-timestamp")
	if timestamp == "" {
		timestamp = c.GetHeader("x-vapi-timestamp")
	}
	if timestamp != "" {
		payload := make([]byte, 0, len(timestamp)+1+len(body))
		payload = append(payload, timestamp...)
		payload = append(payload, '.')
		payload = append(payload, body...)
		if hmacEqual(secret, signature, payload) {
			return true
		}
	}

	return false
}

func hmacEqual(secret, signature string, payload []byte) bool {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(payload)
	expected := hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(signature), []byte(expected))
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n]
}
