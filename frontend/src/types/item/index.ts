export interface Discount {
  percentage?: number;
  validUntil?: string;
}

export interface Item {
  id: string;
  name: string;
  price: number;
  description: string;
  category: string;
  subCategory?: string;
  stock: number;
  coverPhoto?: string;
  newCoverPhoto?: File;
  sku?: string;
  barcode?: string;
  weight?: number;
  unit?: string; // e.g., "pcs", "kg", "L"
  expiryDate?: string;
  supplier?: string;
  brand?: string;
  origin?: string;
  tags: string[];
  isActive: boolean;
  discount?: Discount;
  createdAt?: string;
  updatedAt?: string;
  shopId?: string; // Reference to the shop that owns this item
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
