# Frontend Integration Guide: Inventory Management

This guide details the integration endpoints available in the **Basta Kape API** for tracking units, raw ingredients, live stock levels, supplier deliveries, manual waste logs, and production forecasting.

---

## Access Control & Authorization

All endpoints in this module require JWT authentication via the `Authorization: Bearer <token>` header. Access is restricted using Role-Based Access Control (RBAC) under the **Inventory Management** module (`INVENTORY_MANAGEMENT`).

---

## Endpoints Description

### 1. Ingredient Units (`/inventory/units`)
Used to register measurement units (e.g. Grams - "g", Milliliters - "ml").

*   **`GET /inventory/units`**: Paginated list of units. Supports `search` and `status` (`active` | `archive`) filters.
    *   **RBAC**: `read`
*   **`GET /inventory/units/:id`**: Retrieves a specific unit by ID.
    *   **RBAC**: `read`
*   **`POST /inventory/units`**: Creates a unit.
    *   **Body**: `name` (string, required, min 2, max 100), `abbreviation` (string, optional, max 20).
    *   **RBAC**: `create`
*   **`PUT /inventory/units/:id`**: Updates unit fields.
    *   **Body**: `name` (optional), `abbreviation` (optional).
    *   **RBAC**: `update`
*   **`DELETE /inventory/units/:id`**: Soft-deletes a unit.
    *   **RBAC**: `delete`

---

### 2. Raw Ingredients (`/inventory/ingredients`)
Used to manage raw pantry materials (e.g. Espresso Beans, Fresh Milk).

*   **`GET /inventory/ingredients`**: Paginated list of ingredients. Supports `search` and `status` filters.
    *   **RBAC**: `read`
*   **`GET /inventory/ingredients/:id`**: Retrieves a specific ingredient by ID.
    *   **RBAC**: `read`
*   **`POST /inventory/ingredients`**: Registers a raw material.
    *   **Body**: `name` (string, required, min 2, max 100), `ingredientUnitId` (UUID, required), `reorderPoint` (number, optional, default: 0), `description` (string, optional, max 500).
    *   *Note*: Creating an ingredient automatically initializes a corresponding `IngredientInventory` record with a stock quantity of `0` and a status of `OUT_OF_STOCK`.
    *   **RBAC**: `create`
*   **`PUT /inventory/ingredients/:id`**: Updates properties.
    *   **Body**: `name` (optional), `description` (optional), `ingredientUnitId` (optional), `reorderPoint` (optional).
    *   **RBAC**: `update`
*   **`DELETE /inventory/ingredients/:id`**: Soft-deletes an ingredient (cascades to soft-delete its inventory record).
    *   **RBAC**: `delete`

---

### 3. Inventory Stock Levels & Counts (`/inventory/levels` & physical counts)

#### `GET /inventory/levels`
*   **Description**: Retrieves a paginated list of live ingredient inventories, alert statuses (`SAFE`, `CRITICAL`, `OUT_OF_STOCK`), and reorder points. Ranks `OUT_OF_STOCK` and `CRITICAL` items first.
*   **RBAC**: `read`
*   **Response (200 OK)**: Paginated data containing stock levels, status, and nested ingredient details (including `defaultUnit` with `name` and `abbreviation`).

#### `GET /inventory/levels/:ingredientId`
*   **Description**: Retrieves live stock level details for a specific raw material by its ingredient ID.
*   **RBAC**: `read`

#### `PUT /inventory/ingredients/:ingredientId/physical-count`
*   **Description**: Overwrites the current inventory level with an exact counted physical quantity (e.g. after store closure). Automatically recalculates the status alert.
*   **RBAC**: `update`
*   **Request Body**:
    *   `currentQuantity` (number, required, min 0).
*   **Response (200 OK)**: Updated inventory record with the `lastPhysicalCount` timestamp.

---

### 4. Supplier Deliveries Log (`/inventory/deliveries`)

#### `GET /inventory/deliveries`
*   **Description**: Retrieves a paginated list of ingredient delivery records. Supports `search` and `status` filters.
*   **RBAC**: `read`

#### `POST /inventory/deliveries`
*   **Description**: Logs a new delivery from a supplier, atomically incrementing the current stock level and updating the alert status inside a transaction.
*   **RBAC**: `create`
*   **Request Body**:
    *   `ingredientId` (string, UUID, required): Received ingredient.
    *   `supplierId` (string, UUID, optional): Supplier profile.
    *   `quantityReceived` (number, required, > 0): Received quantity.
    *   `unitCost` (number, required, >= 0): Unit price.
    *   `batchNumber` (string, optional, max 100): Lot batch code.
    *   `expiryDate` (string, ISO date/datetime, optional): Expiration date.
*   **Response (201 Created)**: Returns the logged delivery record (includes computed `totalCost` and `receivedAt` timestamp).

---

### 5. Waste & Stock Adjustments Log (`/inventory/adjustments`)

#### `GET /inventory/adjustments`
*   **Description**: Retrieves a paginated list of stock adjustment records. Supports `search` and `status` filters.
*   **RBAC**: `read`

#### `POST /inventory/adjustments`
*   **Description**: Logs manual stock reductions due to waste, spills, or theft, atomically modifying stock levels and updating alert statuses in a transaction.
*   **RBAC**: `create`
*   **Request Body**:
    *   `ingredientId` (string, UUID, required): Target ingredient.
    *   `quantity` (number, required): Quantity diff (negative for waste/spoilage, e.g. `-500`, or positive for physical count corrections).
    *   `type` (enum, required): `WASTE`, `SPOILED`, `EXPIRED`, `THEFT`, `PROMOTIONAL_USE`, or `PHYSICAL_COUNT_DISCREPANCY`.
    *   `reason` (string, optional, max 500): Narrative cause.
*   **Response (201 Created)**: Returns the logged adjustment record.

---

### 6. Production Forecasts & Projections (`/inventory/forecast`)

#### `GET /inventory/forecast`
*   **Description**: Computes real-time production predictions. Scans active products, recipes, required ingredients, and live inventories to determine:
    - **`maxProduceable`**: The maximum number of drink/pastry units we can prepare with the current pantry levels.
    - **`bottleneck`**: The limiting ingredient that is capping production (lowest produceable count).
*   **RBAC**: `read`
*   **Response (200 OK)**:
    ```json
    [
        {
            "variantId": "variant-uuid",
            "productId": "product-uuid",
            "name": "Espresso (Large)",
            "sku": "ESP-LRG",
            "price": 120,
            "hasRecipe": true,
            "maxProduceable": 12,
            "bottleneck": {
                "ingredientId": "ingredient-uuid",
                "name": "Espresso Beans",
                "currentQuantity": 180,
                "requiredQuantity": 15,
                "unit": "g"
            },
            "ingredients": [
                {
                    "ingredientId": "ingredient-uuid",
                    "name": "Espresso Beans",
                    "currentQuantity": 180,
                    "requiredQuantity": 15,
                    "unit": "g",
                    "canProduce": 12
                }
            ]
        }
    ]
    ```
