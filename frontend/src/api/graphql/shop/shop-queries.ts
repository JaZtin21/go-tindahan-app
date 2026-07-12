import { gql } from '@apollo/client';

// ==========================================
// Shop & Inventory GraphQL Operations
// ==========================================

/* --- SHOP MUTATIONS --- */

export const CREATE_SHOP_MUTATION = gql`
  mutation CreateShop($input: CreateShopInput!) {
    createShop(input: $input) {
      id
      ownerId
      shopName
      address
      coordinates{
        lat
        lng
      }
      description
      photo
      photos
      businessHours {
        openTime
        closeTime
        days
      }
      paymentMethods {
        cash
        gcash
        paymaya
        card
      }
      delivery {
        available
        radius
        fee
        minOrder
      }
      socialMedia {
        facebook
        instagram
      }
      contactDetails {
        phone
        email
        address
      }
    }
  }
`;

export const UPDATE_SHOP_MUTATION = gql`
  mutation UpdateShop($input: UpdateShopInput!) {
    updateShop(input: $input) {
      id
      ownerId
      shopName
      address
      coordinates{
        lat
        lng
      }
      description
      photo
      photos
      createdAt
      businessHours {
        openTime
        closeTime
        days
      }
      paymentMethods {
        cash
        gcash
        paymaya
        card
      }
      delivery {
        available
        radius
        fee
        minOrder
      }
      socialMedia {
        facebook
        instagram
      }
      contactDetails {
        phone
        email
        address
      }
    }
  }
`;


export const DELETE_SHOP_MUTATION = gql`
  mutation DeleteShop($shopId: ID!) {
    deleteShop(shopId: $shopId)
  }
`;

/* --- INVENTORY MUTATIONS --- */

export const ADD_INVENTORY_ITEM_MUTATION = gql`
  mutation AddInventoryItem($input: AddInventoryItemInput!) {
    addInventoryItem(input: $input) {
      id
      shopId
      itemName
      description
      barcode
      category
      unitOfMeasure
      photo
      costPrice
      sellingPrice
      stockQuantity
      reorderLevel
      updatedAt
    }
  }
`;

export const UPDATE_INVENTORY_ITEM_MUTATION = gql`
  mutation UpdateInventoryItem($input: UpdateInventoryItemInput!) {
    updateInventoryItem(input: $input) {
      id
      shopId
      itemName
      description
      barcode
      category
      unitOfMeasure
      photo
      costPrice
      sellingPrice
      stockQuantity
      reorderLevel
      updatedAt
    }
  }
`;

export const DELETE_INVENTORY_ITEM_MUTATION = gql`
  mutation DeleteInventoryItem($itemId: ID!) { 
    deleteInventoryItem(itemID: $itemId)       
  }
`;

export const INCREMENT_STOCK_MUTATION = gql`
  mutation IncrementStock($input: IncrementStockInput!) {
    incrementStock(input: $input) {
      id
      shopId
      itemName
      description
      barcode
      category
      unitOfMeasure
      photo
      costPrice
      sellingPrice
      stockQuantity
      reorderLevel
      updatedAt
    }
  }
`;

export const DECREMENT_STOCK_MUTATION = gql`
  mutation DecrementStock($input: DecrementStockInput!) {
    decrementStock(input: $input) {
      id
      shopId
      itemName
      description
      barcode
      category
      unitOfMeasure
      photo
      costPrice
      sellingPrice
      stockQuantity
      reorderLevel
      updatedAt
    }
  }
`;

/* --- QUERIES --- */

export const GET_MY_SHOPS_QUERY = gql`
  query GetMyShops($limit: Int!, $offset: Int!) {
    getMyShops(limit: $limit, offset: $offset) {
      totalCount
      hasNextPage
      shops {
        id
        ownerId
        shopName
        address
        description
        photo
        photos
        createdAt
        businessHours {
          openTime
          closeTime
          days
        }
        paymentMethods {
          cash
          gcash
          paymaya
          card
        }
        delivery {
          available
          radius
          fee
          minOrder
        }
        socialMedia {
          facebook
          instagram
        }
        contactDetails {
          phone
          email
          address
        }
      }
    }
  }
`;
export const GET_SHOP_BY_ID_QUERY = gql`
  query GetShopById($shopId: ID!) {
    getShopById(shopId: $shopId) {
      id
      ownerId
      shopName
      address
      description
      photo
      photos
      createdAt
      coordinates {
        lat
        lng
      }
      businessHours {
        openTime
        closeTime
        days
      }
      paymentMethods {
        cash
        gcash
        paymaya
        card
      }
      delivery {
        available
        radius
        fee
        minOrder
      }
      socialMedia {
        facebook
        instagram
      }
      contactDetails {
        phone
        email
        address
      }
      status {
        isActive
      }
      verification {
        isVerified
      }
    }
  }
`;
export const GET_SHOP_INVENTORY_QUERY = gql`
  query GetShopInventory($shopId: ID!, $limit: Int!, $offset: Int!) { # 👈 FIXED: Changed from String! to ID!
    getShopInventory(shopId: $shopId, limit: $limit, offset: $offset) {
      items {
        id
        shopId
        itemName
        description
        barcode
        category
        unitOfMeasure
        photo
        costPrice
        sellingPrice
        stockQuantity
        reorderLevel
        updatedAt
      }
      totalCount
      hasNextPage
    }
  }
`;

export const SEARCH_SHOP_QUERY = gql`
  query SearchShop($query: String!, $limit: Int!, $offset: Int!) {
    searchShop(query: $query, limit: $limit, offset: $offset) {
      totalCount
      hasNextPage
      shops {
        id
        shopName
        address
        description
        photo
        photos
        createdAt
        reviews {
          id
          rating
          comment
          createdAt
        }
      }
    }
  }
`;

export const SEARCH_PRODUCT_QUERY = gql`
  query SearchProduct($query: String!, $limit: Int!, $offset: Int!) {
    searchProduct(query: $query, limit: $limit, offset: $offset) {
      totalCount
      hasNextPage
      products {
        id
        shopId
        itemName
        description
        category
        unitOfMeasure
        photo
        sellingPrice
        stockQuantity
      }
    }
  }
`;
