import type { Item } from '../item';

export interface BusinessHours {
  openTime: string;
  closeTime: string;
  days: string[];
}

export interface PaymentMethods {
  cash: boolean;
  gcash: boolean;
  paymaya: boolean;
  card: boolean;
}

export interface DeliveryOptions {
  available: boolean;
  radius?: number; // in km
  fee?: number;
  minOrder?: number;
}

export interface SocialMedia {
  facebook?: string;
  instagram?: string;
}

export interface Verification {
  isVerified: boolean;
  verifiedDate?: string;
  verificationId?: string;
}

export interface Shop {
  id?: string;
  shopName: string;
  description?: string;
  address: string;
  coordinates: { lat: number; lng: number };
  photo: string | File | null;
  photos: string[];
  businessHours: BusinessHours;
  businessType?: 'SARI_SARI_STORE' | 'GROCERY' | 'CONVENIENCE_STORE' | 'MINI_MART' | 'Sari-Sari Store' | 'Grocery' | 'Convenience Store' | 'Mini-Mart';
  paymentMethods: PaymentMethods;
  delivery: DeliveryOptions;
  socialMedia: SocialMedia;
  verification?: Verification;
  contactDetails: {
    phone: string;
    email: string;
    address: string;
  };
  inventory?: Item[];
  rating?: number;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'active' | 'inactive' | 'suspended';
}


