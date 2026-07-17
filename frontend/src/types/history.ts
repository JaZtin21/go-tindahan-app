export interface CheckoutHistoryItem {
  id: string;
  inventoryItemId: string;
  itemName: string;
  quantity: number;
  costPrice: number;
  sellingPrice: number;
  lineCostTotal: number;
  lineSaleTotal: number;
}

export interface CheckoutHistoryBatch {
  id: string;
  shopId: string;
  soldAt: string;
  totalItems: number;
  totalCost: number;
  grossSale: number;
  grossProfit: number;
  items: CheckoutHistoryItem[];
}

export interface ItemActionHistoryRecord {
  id: string;
  shopId: string;
  inventoryItemId?: string;
  itemName: string;
  action: string;
  quantity?: number;
  date: string;
}
