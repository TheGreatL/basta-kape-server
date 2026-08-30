# 🗑️ Frontend Integration Guide: Unified Waste & Disposal Log

This guide provides endpoints and data structures for building the **Centralized Waste, Spoilage & Disposal Log** screen in the Basta Kape management application.

---

## 📌 1. Overview

The Unified Disposal module merges two operational loss streams into a single audit log:

1. **`PREPARED_FOOD`**: Prepared display items (cookies, pastries, bottled drinks) that expired on shelf or were damaged/sampled.
2. **`RAW_INGREDIENT`**: Kitchen ingredients and packaging materials (beans, milk, cups, syrups) wasted, spilled, or spoiled.

---

## 🔐 2. Access Control & RBAC

Requires JWT Authentication (`Authorization: Bearer <token>`).
Allowed roles: Any user holding `read` permission on:

- `INVENTORY_MANAGEMENT`
- `FOOD_PREPARATION`
- `REPORTS_MANAGEMENT`

(i.e. **Owner**, **Administrator**, **Barista**, and **Cashier**).

---

## 🌐 3. API Endpoints

### 1️⃣ Consolidated Loss Summary & KPI Metrics

- **Endpoint**: `GET /api/disposals/summary`
- **Query Parameters**:
    - `category` (enum: `"ALL" | "PREPARED_FOOD" | "RAW_INGREDIENT"`, optional)
    - `reason` (enum: `"ALL" | "EXPIRED" | "SPOILED" | "WASTE" | "SAMPLING" | "THEFT" | "PROMOTIONAL_USE" | "DISPOSED" | "PHYSICAL_COUNT_CORRECTION"`, optional)
    - `search` (string, optional)
    - `startDate` (ISO string, optional)
    - `endDate` (ISO string, optional)
- **Response (200 OK)**:

```json
{
    "totalWastedItemsCount": 18,
    "totalFinancialLoss": 1240.5,
    "preparedFoodLoss": 850.0,
    "rawIngredientLoss": 390.5,
    "preparedFoodWastedCount": 10,
    "rawIngredientWastedCount": 8,
    "reasonBreakdown": {
        "EXPIRED": 12,
        "WASTE": 4,
        "SPOILED": 2
    },
    "topWastedItems": [
        {
            "itemName": "Biscoff Smore's",
            "category": "PREPARED_FOOD",
            "totalQuantity": 6,
            "unit": "pcs",
            "totalCostLoss": 510.0
        },
        {
            "itemName": "Fresh Milk",
            "category": "RAW_INGREDIENT",
            "totalQuantity": 4,
            "unit": "L",
            "totalCostLoss": 340.0
        }
    ]
}
```

---

### 2️⃣ Paginated Unified Disposal & Waste Audit Log

- **Endpoint**: `GET /api/disposals`
- **Query Parameters**:
    - `page` (number, default: `1`)
    - `limit` (number, default: `10`)
    - `category` (enum: `"ALL" | "PREPARED_FOOD" | "RAW_INGREDIENT"`, default: `"ALL"`)
    - `reason` (enum: `"ALL" | "EXPIRED" | "SPOILED" | "WASTE" | "SAMPLING" | "THEFT" | "PROMOTIONAL_USE" | "DISPOSED" | "PHYSICAL_COUNT_CORRECTION"`, default: `"ALL"`)
    - `search` (string, optional - searches by item name, batch number, or reason)
    - `startDate` (ISO string, optional)
    - `endDate` (ISO string, optional)
- **Response (200 OK)**:

```json
{
    "data": [
        {
            "id": "trx-uuid-1",
            "category": "PREPARED_FOOD",
            "itemId": "variant-uuid-1",
            "itemName": "Matcha Smore's",
            "variantLabel": "Matcha Smore's (Regular)",
            "batchNumber": "PREP-MATCHA-20260829-001",
            "quantity": 2,
            "unit": "pcs",
            "estimatedCostLoss": 170.0,
            "reason": "EXPIRED",
            "notes": "Unsold display cookies past 24h validity",
            "disposedAt": "2026-08-30T10:00:00.000Z",
            "disposedBy": {
                "id": "user-uuid-1",
                "name": "Jane Barista",
                "username": "jane"
            }
        },
        {
            "id": "trx-uuid-2",
            "category": "RAW_INGREDIENT",
            "itemId": "ingredient-uuid-2",
            "itemName": "Fresh Milk",
            "variantLabel": null,
            "batchNumber": "BATCH-MILK-20260815",
            "quantity": 500,
            "unit": "ml",
            "estimatedCostLoss": 45.0,
            "reason": "WASTE",
            "notes": "Accidental spill during morning prep",
            "disposedAt": "2026-08-30T08:30:00.000Z",
            "disposedBy": {
                "id": "user-uuid-2",
                "name": "John Admin",
                "username": "admin"
            }
        }
    ],
    "meta": {
        "total": 2,
        "pageCount": 1,
        "count": 2,
        "currentPage": 1,
        "hasMore": false
    }
}
```

---

## 💻 4. TypeScript Interfaces for Frontend

```typescript
export type DisposalCategory = 'ALL' | 'PREPARED_FOOD' | 'RAW_INGREDIENT';

export type DisposalReason =
    | 'ALL'
    | 'EXPIRED'
    | 'SPOILED'
    | 'WASTE'
    | 'SAMPLING'
    | 'THEFT'
    | 'PROMOTIONAL_USE'
    | 'DISPOSED'
    | 'PHYSICAL_COUNT_CORRECTION';

export interface IDisposalItem {
    id: string;
    category: 'PREPARED_FOOD' | 'RAW_INGREDIENT';
    itemId: string;
    itemName: string;
    variantLabel?: string | null;
    batchNumber: string;
    quantity: number;
    unit: string;
    estimatedCostLoss: number;
    reason: string;
    notes?: string | null;
    disposedAt: string;
    disposedBy?: {
        id: string;
        name: string;
        username: string;
    } | null;
}

export interface ITopWastedItem {
    itemName: string;
    category: 'PREPARED_FOOD' | 'RAW_INGREDIENT';
    totalQuantity: number;
    unit: string;
    totalCostLoss: number;
}

export interface IDisposalSummary {
    totalWastedItemsCount: number;
    totalFinancialLoss: number;
    preparedFoodLoss: number;
    rawIngredientLoss: number;
    preparedFoodWastedCount: number;
    rawIngredientWastedCount: number;
    reasonBreakdown: Record<string, number>;
    topWastedItems: ITopWastedItem[];
}
```
