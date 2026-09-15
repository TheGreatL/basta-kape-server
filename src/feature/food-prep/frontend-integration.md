# 🍪 Frontend Integration Guide: Prepared Food & Store Display Inventory

This guide details everything needed to integrate the **Food Preparation / Store Display Station**, **Shelf-Life Expiry Tracking**, and **FEFO POS Display Stock Integration** into the frontend application.

---

## 📌 1. Core Architecture & Workflow

1. **`MADE_TO_ORDER`**: Drinks and fresh cooked items (waffles, pasta). Raw recipe ingredients are deducted when a customer places an order.
2. **`PREPARED_DISPLAY`**: Items prepared or baked in advance in batches (cookies, pastries, display snacks, bottled items).
   - Raw recipe ingredients are deducted **when the kitchen records the batch** (`POST /api/food-prep/batches`).
   - Placed on display shelves with an **expiration timer** (`preparedAt`, `shelfLifeMinutes`, `expiresAt`).
   - When sold via POS, stock is deducted from the **earliest-expiring fresh batch (FEFO)** with **zero duplicate raw ingredient deduction**.
   - Expired or spoiled items can be disposed of with waste reason logging.

---

## 🔐 2. RBAC Permissions

- **Module Key**: `FOOD_PREPARATION`
- **Module Label**: `"Food Preparation"`

| Role | Allowed Actions | Recommended UI Access |
| :--- | :--- | :--- |
| **Owner / Administrator** | `create`, `read`, `update`, `delete` | Full access to Food Prep dashboard, batch history, expiry disposal, and reports. |
| **Barista / Kitchen Staff** | `create`, `read`, `update` | Kitchen Prep station to record new bakes/batches and mark spoilage/disposal. |
| **Cashier** | `read` | Read-only access to view current fresh display unit counts on POS. |

---

## 🏷️ 3. Product & Menu Model Changes

### A. Product Entity Updates (`/api/products` & `/api/menu`)
Every product now includes:
- **`preparationType`**: `"MADE_TO_ORDER"` (default) or `"PREPARED_DISPLAY"`.
- **`defaultShelfLife`**: `number | null` — Default validity duration in **minutes** (e.g. `1440` for 24 hours, `43200` for 30 days).

### B. POS Menu Stock Calculation (`GET /api/menu`)
For `PREPARED_DISPLAY` products, the `variant.maxProduceable` field returned by `/api/menu` automatically represents the **total fresh ready-to-serve display units on hand** (instead of raw ingredient calculations).

---

## 🌐 4. API Endpoints (`/api/food-prep/*`)

All requests require `Authorization: Bearer <jwt_token>`.

### 1️⃣ Real-Time Display Inventory Summary
* **Endpoint**: `GET /api/food-prep/summary`
* **RBAC Action**: `read`
* **Response (200 OK)**:
```json
{
  "totalFreshUnits": 72,
  "totalExpiringSoonUnits": 12,
  "totalExpiredUnits": 0,
  "items": [
    {
      "productVariantId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      "productId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "productName": "Biscoff Smore's",
      "sku": "BISCOFF-SMORE-S-REGULAR",
      "price": 85,
      "variantLabel": "Biscoff Smore's (Regular)",
      "totalFreshQuantity": 12,
      "totalNearExpiryQuantity": 2,
      "totalExpiredQuantity": 0,
      "earliestExpiry": "2026-08-30T10:00:00.000Z",
      "activeBatchesCount": 1
    }
  ]
}
```

---

### 2️⃣ Record New Food Preparation / Bake Batch
* **Endpoint**: `POST /api/food-prep/batches`
* **RBAC Action**: `create`
* **Request Body**:
```json
{
  "productVariantId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "quantity": 12,
  "shelfLifeMinutes": 1440,
  "notes": "Morning fresh bake batch #1"
}
```
* **Response (201 Created)**:
```json
{
  "id": "batch-uuid-1234",
  "batchNumber": "PREP-BISCOFF-20260829-001",
  "productVariantId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "quantityPrepared": 12,
  "currentQuantity": 12,
  "preparedAt": "2026-08-29T22:00:00.000Z",
  "shelfLifeMinutes": 1440,
  "expiresAt": "2026-08-30T22:00:00.000Z",
  "status": "FRESH",
  "notes": "Morning fresh bake batch #1"
}
```

---

### 3️⃣ List Prepared Batches with Filters
* **Endpoint**: `GET /api/food-prep/batches`
* **RBAC Action**: `read`
* **Query Parameters**:
  - `page` (number, default: `1`)
  - `limit` (number, default: `10`)
  - `status` (`"FRESH"` | `"NEAR_EXPIRY"` | `"EXPIRED"` | `"DEPLETED"` | `"DISPOSED"`)
  - `productVariantId` (UUID string)
  - `expiringWithinMinutes` (number, e.g. `120` to view batches expiring in the next 2 hours)
* **Response (200 OK)**: Paginated structure with `data` array and `meta`.

---

### 4️⃣ Dispose / Write-Off Spoilage or Expired Units
* **Endpoint**: `POST /api/food-prep/batches/:id/dispose`
* **RBAC Action**: `update`
* **Request Body**:
```json
{
  "quantity": 2,
  "reason": "EXPIRED",
  "notes": "Unsold display items past 24-hour validity"
}
```
* **Allowed `reason` values**: `"EXPIRED"`, `"SPOILED"`, `"WASTE"`, `"SAMPLING"`, `"DISPOSED"`, `"CORRECTION"`.

---

## 💻 5. TypeScript Interfaces for Frontend

```typescript
export type PreparationType = 'MADE_TO_ORDER' | 'PREPARED_DISPLAY';

export type PreparedBatchStatus = 
  | 'FRESH'
  | 'NEAR_EXPIRY'
  | 'EXPIRED'
  | 'DEPLETED'
  | 'DISPOSED';

export type PreparedAdjustmentType =
  | 'SALE'
  | 'EXPIRED'
  | 'SPOILED'
  | 'WASTE'
  | 'SAMPLING'
  | 'DISPOSED'
  | 'CORRECTION';

export interface IDisplayStockItemSummary {
  productVariantId: string;
  productId: string;
  productName: string;
  sku: string | null;
  price: number;
  variantLabel: string;
  totalFreshQuantity: number;
  totalNearExpiryQuantity: number;
  totalExpiredQuantity: number;
  earliestExpiry: string | null;
  activeBatchesCount: number;
}

export interface IDisplayStockSummaryResponse {
  totalFreshUnits: number;
  totalExpiringSoonUnits: number;
  totalExpiredUnits: number;
  items: IDisplayStockItemSummary[];
}

export interface ICreatePreparedBatchRequest {
  productVariantId: string;
  quantity: number;
  shelfLifeMinutes?: number;
  notes?: string | null;
}

export interface IDisposePreparedBatchRequest {
  quantity: number;
  reason: 'EXPIRED' | 'SPOILED' | 'WASTE' | 'SAMPLING' | 'DISPOSED' | 'CORRECTION';
  notes?: string | null;
}

export interface IPreparedItemBatch {
  id: string;
  batchNumber: string;
  productVariantId: string;
  productId: string;
  quantityPrepared: number;
  currentQuantity: number;
  preparedAt: string;
  shelfLifeMinutes: number;
  expiresAt: string;
  status: PreparedBatchStatus;
  notes: string | null;
  product?: {
    id: string;
    name: string;
    photo: string | null;
  };
  variant?: {
    id: string;
    sku: string | null;
    price: number;
  };
}
```
