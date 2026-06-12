# Frontend Integration Guide: Orders Management & Queue Lifecycle

This guide details the integration endpoints available in the **Basta Kape API** for placing customer orders, managing the queue lifecycle, and updating order preparation statuses.

---

## Access Control & Authorization

All endpoints in this module require JWT authentication via the `Authorization: Bearer <token>` header. Access is restricted using Role-Based Access Control (RBAC) under the **Orders Management** module (`Orders Management`).

---

## Endpoints Description

### 1. `GET /orders`
*   **Description**: Retrieves a paginated list of orders in the system.
*   **RBAC Permission Required**: `read` (module: `Orders Management`)
*   **Query Parameters**:
    *   `page` (number, optional, default: `1`): Current page of the paginated list.
    *   `limit` (number, optional, default: `10`, max: `100`): Number of orders per page.
    *   `search` (string, optional): Matches against the order's queue number or customer name.
    *   `status` (enum: `"PENDING" | "PREPARING" | "READY" | "COMPLETED" | "CANCELLED"`, optional): Filter by order status.
    *   `orderType` (enum: `"DINE_IN" | "TAKE_OUT" | "DELIVERY"`, optional): Filter by order fulfillment type.
    *   `orderSource` (enum: `"POS" | "MOBILE_APP" | "WEBSITE" | "DELIVERY_PARTNER"`, optional): Filter by order channel.
*   **Response (200 OK)**:
    ```json
    {
        "data": [
            {
                "id": "order-uuid-1",
                "queueNumber": "#001",
                "buzzerId": null,
                "status": "PENDING",
                "orderType": "DINE_IN",
                "orderSource": "POS",
                "notes": "No ice please",
                "subtotal": 135.0,
                "taxAmount": 16.2,
                "discountAmount": 0.0,
                "netTotal": 151.2,
                "customerId": null,
                "customerName": "Walk-in Customer",
                "cashierSessionId": "shift-uuid-1",
                "createdAt": "2026-06-11T12:05:00.000Z",
                "updatedAt": "2026-06-11T12:05:00.000Z"
            }
        ],
        "meta": {
            "total": 1,
            "pageCount": 1,
            "count": 1,
            "currentPage": 1,
            "hasMore": false
        }
    }
    ```

### 2. `GET /orders/:id`
*   **Description**: Retrieves detailed order information by ID, including order items, connected variants, and selected modifiers.
*   **RBAC Permission Required**: `read` (module: `Orders Management`)
*   **Response (200 OK)**:
    ```json
    {
        "id": "order-uuid-1",
        "queueNumber": "#001",
        "buzzerId": null,
        "status": "PENDING",
        "orderType": "DINE_IN",
        "orderSource": "POS",
        "notes": "No ice please",
        "subtotal": 165.0,
        "taxAmount": 19.8,
        "discountAmount": 0.0,
        "netTotal": 184.8,
        "customerId": null,
        "customerName": "Walk-in Customer",
        "cashierSessionId": "shift-uuid-1",
        "createdAt": "2026-06-11T12:05:00.000Z",
        "updatedAt": "2026-06-11T12:05:00.000Z",
        "items": [
            {
                "id": "order-item-uuid-1",
                "productVariantId": "var-latte-12-whole",
                "quantity": 1,
                "unitPrice": 165.0,
                "totalPrice": 165.0,
                "notes": null,
                "modifiers": [
                    {
                        "id": "item-mod-uuid-1",
                        "modifierOptionId": "modo-oat-milk-uuid",
                        "price": 30.0,
                        "modifierOption": {
                            "name": "Oat Milk Add-on"
                        }
                    }
                ]
            }
        ]
    }
    ```

### 3. `POST /orders`
*   **Description**: Places a new cashier order. The order is automatically mapped to the cashier's currently active shift session (400 error if there is no active shift drawer).
*   **Pricing Calculations**:
    - Subtotal = Sum of (Item base price + selected modifiers prices) * Item quantity.
    - Tax amount = Computed automatically using the system VAT rate (e.g. 12% of subtotal).
    - Net total = Subtotal + Tax amount.
*   **RBAC Permission Required**: `create` (module: `Orders Management`)
*   **Request Body**:
    *   `orderType` (enum: `"DINE_IN" | "TAKE_OUT" | "DELIVERY"`, optional, default: `"DINE_IN"`): Fulfillment option.
    *   `orderSource` (enum: `"POS" | "MOBILE_APP" | "WEBSITE" | "DELIVERY_PARTNER"`, optional, default: `"POS"`): Order channel.
    *   `notes` (string, optional, max 1000): Overall order requests.
    *   `customerId` (string, optional, UUID): Registered customer ID.
    *   `customerName` (string, optional, max 100): Customer name (e.g. for walk-in custom cup label).
    *   `items` (array of objects, required, min 1):
        *   `productVariantId` (string, required, UUID): Product variant ID.
        *   `quantity` (number, required, positive integer): Count of items to prepare.
        *   `notes` (string, optional, max 500): Preparation requests (e.g., "extra hot").
        *   `modifierOptionIds` (array of strings (UUID), optional): Array of selected modifier options.
*   **Response (201 Created)**: Returns the newly created order object with calculated pricing fields, items details, and unique sequential day-based queue number (e.g. `#001`).

### 4. `PATCH /orders/:id/status`
*   **Description**: Updates an order's status and adds an audit trail status history log.
*   **Automatic Inventory Deductions**: 
    - When transitioning an order status from any other state to **`COMPLETED`**, the system automatically processes ingredient stock deductions.
    - It maps the recipe ingredients for both the main **product variant** and all selected **modifier options** connected to the items.
    - It adjusts quantities inside `IngredientInventory` and updates the alert status (e.g. triggering `CRITICAL` or `OUT_OF_STOCK` if counts fall below reorder points).
*   **RBAC Permission Required**: `update` (module: `Orders Management`)
*   **Request Body**:
    *   `status` (enum: `"PENDING" | "PREPARING" | "READY" | "COMPLETED" | "CANCELLED"`, required): Target status.
    *   `notes` (string, optional, max 1000): Reason or logs for status transition (e.g. "Completed pick-up").
*   **Response (200 OK)**: Returns the updated order object.
