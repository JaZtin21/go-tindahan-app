// tinybase/store.ts
//
// TinyBase cells only hold string/number/boolean — nested objects/arrays on
// Shop (coordinates, businessHours, paymentMethods, delivery, socialMedia,
// verification, contactDetails, photos) are stored as JSON strings and
// packed/unpacked in shopHooks.ts. Item has no nested fields, so its table
// maps 1:1.

import { createStore, type Store } from 'tinybase';

export function createShopStore(): Store {
    return createStore().setTablesSchema({
        shops: {
            shopName: { type: 'string' },
            description: { type: 'string' },
            address: { type: 'string' },
            coordinatesJson: { type: 'string' },
            photo: { type: 'string' },
            photosJson: { type: 'string' },
            businessHoursJson: { type: 'string' },
            businessType: { type: 'string' },
            paymentMethodsJson: { type: 'string' },
            deliveryJson: { type: 'string' },
            socialMediaJson: { type: 'string' },
            verificationJson: { type: 'string' },
            contactDetailsJson: { type: 'string' },
            rating: { type: 'number' },
            createdAt: { type: 'string' },
            updatedAt: { type: 'string' },
            createdBy: { type: 'string' },
            status: { type: 'string' },
            _dirty: { type: 'boolean', default: false },
            _serverSynced: { type: 'boolean', default: false },
            _deleted: { type: 'boolean', default: false },
        },
        inventory: {
            shopId: { type: 'string' },
            itemName: { type: 'string' },
            description: { type: 'string' },
            barcode: { type: 'string' },
            category: { type: 'string' },
            unitOfMeasure: { type: 'string' },
            photo: { type: 'string' },
            sellingPrice: { type: 'number' },
            stockQuantity: { type: 'number' },
            costPrice: { type: 'number' },
            reorderLevel: { type: 'number' },
            // NEW: JSON-stringified string[] — TinyBase cells only hold
            // string/number/boolean, same reason coordinatesJson/photosJson
            // exist on the shops table. Packed/unpacked in toItemRow/fromItemRow.
            visualClassKeysJson: { type: 'string' },
            updatedAt: { type: 'string' },
            _dirty: { type: 'boolean', default: false },
            _serverSynced: { type: 'boolean', default: false },
            _deleted: { type: 'boolean', default: false },
        },
        checkoutHistory: {
            shopId: { type: 'string' },
            soldAt: { type: 'string' },
            totalItems: { type: 'number' },
            totalCost: { type: 'number' },
            grossSale: { type: 'number' },
            grossProfit: { type: 'number' },
            itemsJson: { type: 'string' },
            _dirty: { type: 'boolean', default: false },
            _serverSynced: { type: 'boolean', default: false },
            _deleted: { type: 'boolean', default: false },
        },
        itemActionHistory: {
            shopId: { type: 'string' },
            inventoryItemId: { type: 'string' },
            itemName: { type: 'string' },
            action: { type: 'string' },
            quantity: { type: 'number' },
            date: { type: 'string' },
            _dirty: { type: 'boolean', default: false },
            _serverSynced: { type: 'boolean', default: false },
        },
    });
}