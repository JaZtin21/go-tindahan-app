package utils

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"go-backend/internal/graph/model"

	"github.com/99designs/gqlgen/graphql"
	pgx "github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/vektah/gqlparser/v2/gqlerror"
)

var (
	ErrShopNotFound         = errors.New("shop not found")
	ErrForbiddenShopAccess  = errors.New("forbidden shop access")
	ErrInvalidCheckoutCart  = errors.New("invalid checkout cart")
	ErrCheckoutItemNotFound = errors.New("checkout item not found")
	ErrInsufficientStock    = errors.New("insufficient stock")
)

type CheckoutInventoryRow struct {
	ID            string
	ItemName      string
	CostPrice     float64
	SellingPrice  float64
	StockQuantity int
}

type ItemActionHistoryInput struct {
	ShopID          string
	InventoryItemID string
	ItemName        string
	Action          string
	Quantity        *int
}

// AddHistoryGraphQLError maps internal/domain errors from history-related
// resolvers to the appropriate GraphQL error response. Lives here (not in
// the generated resolver files) so it survives gqlgen regeneration.
func AddHistoryGraphQLError(ctx context.Context, err error) {
	switch {
	case errors.Is(err, ErrShopNotFound):
		graphql.AddError(ctx, &gqlerror.Error{
			Message:    "not found: target shop resource does not exist",
			Extensions: map[string]interface{}{"code": "NOT_FOUND"},
		})
	case errors.Is(err, ErrForbiddenShopAccess):
		graphql.AddError(ctx, &gqlerror.Error{
			Message:    "forbidden: access denied to modify this shop",
			Extensions: map[string]interface{}{"code": "FORBIDDEN"},
		})
	case errors.Is(err, ErrInvalidCheckoutCart):
		graphql.AddError(ctx, &gqlerror.Error{
			Message:    "bad request: checkout cart payload is invalid",
			Extensions: map[string]interface{}{"code": "BAD_USER_INPUT"},
		})
	case errors.Is(err, ErrCheckoutItemNotFound):
		itemID := strings.TrimPrefix(err.Error(), ErrCheckoutItemNotFound.Error()+": ")
		graphql.AddError(ctx, &gqlerror.Error{
			Message:    fmt.Sprintf("not found: inventory item %s does not exist in this shop", itemID),
			Extensions: map[string]interface{}{"code": "NOT_FOUND"},
		})
	case errors.Is(err, ErrInsufficientStock):
		graphql.AddError(ctx, &gqlerror.Error{
			Message:    err.Error(),
			Extensions: map[string]interface{}{"code": "BAD_USER_INPUT"},
		})
	default:
		graphql.AddError(ctx, &gqlerror.Error{
			Message:    "internal server error",
			Extensions: map[string]interface{}{"code": "INTERNAL_SERVER_ERROR"},
		})
	}
}

func EnsureShopOwnership(ctx context.Context, db *pgxpool.Pool, shopID string, currentUserID string) error {
	var shopOwnerID string
	err := db.QueryRow(ctx, "SELECT owner_id FROM shops WHERE id = $1 LIMIT 1", shopID).Scan(&shopOwnerID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrShopNotFound
		}
		return err
	}

	if shopOwnerID != currentUserID {
		return ErrForbiddenShopAccess
	}

	return nil
}

func RecordItemActionHistory(ctx context.Context, db interface {
	Exec(context.Context, string, ...interface{}) (pgconn.CommandTag, error)
}, input ItemActionHistoryInput) error {
	_, err := db.Exec(ctx, `
		INSERT INTO item_action_history (shop_id, inventory_item_id, item_name, action, quantity, created_at)
		VALUES ($1, $2, $3, $4, $5, NOW())
	`, input.ShopID, input.InventoryItemID, input.ItemName, input.Action, input.Quantity)
	return err
}

func BuildCheckoutBatch(ctx context.Context, tx pgx.Tx, input model.CheckoutCartInput) (*model.CheckoutBatch, error) {
	if len(input.Items) == 0 {
		return nil, ErrInvalidCheckoutCart
	}

	seen := map[string]struct{}{}
	inventoryByID := make(map[string]CheckoutInventoryRow, len(input.Items))
	for _, cartItem := range input.Items {
		if cartItem == nil || cartItem.ItemID == "" || cartItem.Quantity <= 0 {
			return nil, ErrInvalidCheckoutCart
		}
		if _, ok := seen[cartItem.ItemID]; ok {
			return nil, fmt.Errorf("%w: duplicate itemId %s", ErrInvalidCheckoutCart, cartItem.ItemID)
		}
		seen[cartItem.ItemID] = struct{}{}

		var row CheckoutInventoryRow
		err := tx.QueryRow(ctx, `
			SELECT id, item_name, cost_price, selling_price, stock_quantity
			FROM inventory_items
			WHERE id = $1 AND shop_id = $2
			FOR UPDATE
		`, cartItem.ItemID, input.ShopID).Scan(
			&row.ID,
			&row.ItemName,
			&row.CostPrice,
			&row.SellingPrice,
			&row.StockQuantity,
		)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return nil, fmt.Errorf("%w: %s", ErrCheckoutItemNotFound, cartItem.ItemID)
			}
			return nil, err
		}

		if row.StockQuantity < cartItem.Quantity {
			return nil, fmt.Errorf("%w: %s only has %d remaining", ErrInsufficientStock, row.ItemName, row.StockQuantity)
		}

		inventoryByID[cartItem.ItemID] = row
	}

	var totalItems int
	var totalCost float64
	var grossSale float64
	for _, cartItem := range input.Items {
		row := inventoryByID[cartItem.ItemID]
		totalItems += cartItem.Quantity
		totalCost += row.CostPrice * float64(cartItem.Quantity)
		grossSale += row.SellingPrice * float64(cartItem.Quantity)
	}
	grossProfit := grossSale - totalCost

	var batchID string
	var soldAt time.Time
	err := tx.QueryRow(ctx, `
		INSERT INTO checkout_batches (shop_id, sold_at, total_items, total_cost, gross_sale, gross_profit)
		VALUES ($1, NOW(), $2, $3, $4, $5)
		RETURNING id, sold_at
	`, input.ShopID, totalItems, totalCost, grossSale, grossProfit).Scan(&batchID, &soldAt)
	if err != nil {
		return nil, err
	}

	batchItems := make([]*model.CheckoutBatchItem, 0, len(input.Items))
	for _, cartItem := range input.Items {
		row := inventoryByID[cartItem.ItemID]
		lineCostTotal := row.CostPrice * float64(cartItem.Quantity)
		lineSaleTotal := row.SellingPrice * float64(cartItem.Quantity)

		var batchItemID string
		err = tx.QueryRow(ctx, `
			INSERT INTO checkout_batch_items (
				checkout_batch_id, inventory_item_id, item_name, quantity,
				cost_price, selling_price, line_cost_total, line_sale_total
			)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
			RETURNING id
		`, batchID, row.ID, row.ItemName, cartItem.Quantity, row.CostPrice, row.SellingPrice, lineCostTotal, lineSaleTotal).Scan(&batchItemID)
		if err != nil {
			return nil, err
		}

		_, err = tx.Exec(ctx, `
			UPDATE inventory_items
			SET stock_quantity = stock_quantity - $1, updated_at = NOW()
			WHERE id = $2
		`, cartItem.Quantity, row.ID)
		if err != nil {
			return nil, err
		}

		batchItems = append(batchItems, &model.CheckoutBatchItem{
			ID:              batchItemID,
			InventoryItemID: row.ID,
			ItemName:        row.ItemName,
			Quantity:        cartItem.Quantity,
			CostPrice:       row.CostPrice,
			SellingPrice:    row.SellingPrice,
			LineCostTotal:   lineCostTotal,
			LineSaleTotal:   lineSaleTotal,
		})
	}

	return &model.CheckoutBatch{
		ID:          batchID,
		ShopID:      input.ShopID,
		SoldAt:      soldAt.Format(time.RFC3339),
		TotalItems:  totalItems,
		TotalCost:   totalCost,
		GrossSale:   grossSale,
		GrossProfit: grossProfit,
		Items:       batchItems,
	}, nil
}
