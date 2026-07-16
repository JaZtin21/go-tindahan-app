export interface Discount {
  percentage?: number;
  validUntil?: string;
}

export interface Item {
  id: string;
  shopId: string;
  itemName: string;
  description?: string;
  barcode?: string;
  category?: string;
  unitOfMeasure?: string;
  photo?: string;
  sellingPrice: number;
  stockQuantity: number;
  costPrice: number;
  reorderLevel: number;
  updatedAt: string;
}

export interface CartItem {
  id: string;
  itemName: string;
  sellingPrice: number;
  stockQuantity: number;
  quantity: number;
  unitOfMeasure?: string;
  photo?: string;
}

export interface Product {
  id: string;
  shopId: string;
  itemName: string;
  description?: string;
  category?: string;
  unitOfMeasure?: string;
  photo?: string;
  sellingPrice: number;
  stockQuantity: number;
}
