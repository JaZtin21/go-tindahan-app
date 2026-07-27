package utils

import (
	"context"
	"log"
	"regexp"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

var nonAlphaNumericRegex = regexp.MustCompile(`[^\p{L}\p{N}\s]+`)
var multiSpaceRegex = regexp.MustCompile(`\s+`)

// NormalizeSearchText strips punctuation/emoji/symbols and collapses
// whitespace, so OCR garbage characters (e.g. stray unicode glyphs picked up
// off packaging, like the "🟩" that showed up in "TOMI 🟩 SUPER Sweel Corn")
// don't dilute trigram similarity scores against a clean, human-typed
// inventory name. Safe to call on both the incoming scan text and (if you
// ever want to pre-clean stored names) item_name itself.
func NormalizeSearchText(input string) string {
	cleaned := nonAlphaNumericRegex.ReplaceAllString(input, " ")
	cleaned = multiSpaceRegex.ReplaceAllString(cleaned, " ")
	return strings.TrimSpace(cleaned)
}

// ItemScanEventInput mirrors the shape of item_scan_events. Every field
// besides ShopID and MatchType is optional — fill in whatever you have at
// the call site.
type ItemScanEventInput struct {
	ShopID             string
	InventoryItemID    *string
	TopVisualCandidate *string
	VisualDistance     *float64
	OcrText            *string
	ResolvedName       *string
	MatchType          string // "visual_key" | "trgm_fallback" | "no_match" | "manual_correction"
}

// RecordItemScanEvent is a best-effort telemetry insert for the retraining /
// drift queue — failures are logged, never surfaced to the caller, same
// tolerance RecordItemActionHistory already uses elsewhere in this codebase.
//
// NOTE: this assumes r.Resolver.DB is a *pgxpool.Pool (matches how it's used
// everywhere else in the resolvers — .QueryRow / .Query / .Exec / .Begin).
// If your Resolver.DB field is actually a custom wrapper type, change the
// parameter type below to match it; the method calls are identical either way.
func RecordItemScanEvent(ctx context.Context, db *pgxpool.Pool, input ItemScanEventInput) error {
	_, err := db.Exec(ctx, `
		INSERT INTO item_scan_events (
			shop_id, inventory_item_id, top_visual_candidate, visual_distance,
			ocr_text, resolved_name, match_type
		) VALUES ($1, $2, $3, $4, $5, $6, $7)
	`, input.ShopID, input.InventoryItemID, input.TopVisualCandidate, input.VisualDistance,
		input.OcrText, input.ResolvedName, input.MatchType)
	if err != nil {
		log.Printf("⚠️ Failed to record item scan event: %v", err)
	}
	return err
}
