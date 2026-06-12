# Frontend Integration Guide: Discounts & Philippine BIR Compliance (`Discount`, `OrderDiscount`)

This guide details the integration endpoints available in the **Basta Kape API** for managing discounts configurations and applying them to pending orders in accordance with Philippine BIR Senior Citizen (SC) and Person with Disability (PWD) compliance rules.

---

## Access Control & Authorization

All endpoints in this module require JWT authentication via the `Authorization: Bearer <token>` header. Access is restricted using Role-Based Access Control (RBAC):
- **Discounts Configuration (CRUD)**: Requires permissions under the **Store Settings** module (`Store Settings`).
- **Applying / Removing Order Discounts**: Requires permissions under the **Point of Sale (POS)** module (`Point of Sale (POS)`).

---

## Config Endpoints Description

### 1. `POST /discounts`
*   **Description**: Creates a new discount configuration (percentage or fixed amount).
*   **RBAC Permission Required**: `create` (module: `Store Settings`)
*   **Request Body**:
    *   `name` (string, required, max 100): E.g. `"Senior Citizen"`, `"Soft Launch 10% Off"`.
    *   `type` (enum: `"PERCENTAGE" | "FIXED_AMOUNT"`, optional, default: `"PERCENTAGE"`)
    *   `value` (number, required, >= 0): E.g., `20.00` for percentage or `50.00` for fixed.
    *   `code` (string, optional, max 50): Optional discount promo code (e.g. `"WELCOME10"`).
*   **Response (201 Created)**:
    ```json
    {
        "id": "discount-uuid-1",
        "name": "Senior Citizen",
        "type": "PERCENTAGE",
        "value": 20.00,
        "code": "SC20",
        "isActive": true,
        "createdAt": "2026-06-12T11:00:00.000Z",
        "updatedAt": "2026-06-12T11:00:00.000Z",
        "deletedAt": null
    }
    ```

### 2. `GET /discounts`
*   **Description**: Retrieves a list of all active discount configurations.
*   **RBAC Permission Required**: `read` (module: `Store Settings`)
*   **Response (200 OK)**: Returns an array of discount configuration objects.

### 3. `PUT /discounts/:id`
*   **Description**: Updates a discount configuration by ID.
*   **RBAC Permission Required**: `update` (module: `Store Settings`)

### 4. `DELETE /discounts/:id`
*   **Description**: Soft-deletes a discount configuration by ID.
*   **RBAC Permission Required**: `delete` (module: `Store Settings`)

---

## Order Discount Endpoints Description

### 5. `POST /orders/:orderId/discounts`
*   **Description**: Applies a discount configuration to a pending order.
*   **No Double Discounting Rule**: Applying a new discount replaces any existing discount on the order.
*   **BIR Compliance (SC/PWD)**: If the discount name or code includes `"senior"`, `"sc"`, or `"pwd"` (case-insensitive):
    *   The request **must** provide `referenceId` and `referenceName`.
    *   The math automatically strips VAT (`taxAmount = 0.00`) and applies a 20% discount on the VAT-exclusive subtotal.
*   **RBAC Permission Required**: `create` (module: `Point of Sale (POS)`)
*   **Request Body**:
    *   `discountId` (string, required, UUID)
    *   `referenceId` (string, optional): Required for Senior Citizen/PWD cards (e.g. `"SC-12345"`).
    *   `referenceName` (string, optional): Required for Senior Citizen/PWD cardholder name (e.g. `"Maria Santos"`).
*   **Response (201 Created)**:
    ```json
    {
        "id": "order-discount-uuid",
        "orderId": "order-uuid-abc",
        "discountId": "discount-uuid-1",
        "amount": 20.00,
        "referenceId": "SC-12345",
        "referenceName": "Maria Santos",
        "createdAt": "2026-06-12T11:01:00.000Z",
        "discount": {
            "id": "discount-uuid-1",
            "name": "Senior Citizen",
            "type": "PERCENTAGE",
            "value": 20.00
        }
    }
    ```
*   **Error Responses**:
    *   **400 Bad Request**: If the order is not in `PENDING` status, or if required card details are missing for SC/PWD discounts.
    *   **409 Conflict**: If the order has already been paid.

### 6. `DELETE /orders/:orderId/discounts`
*   **Description**: Removes all applied discounts from a pending order and restores its full original VAT and net total amounts.
*   **RBAC Permission Required**: `delete` (module: `Point of Sale (POS)`)
*   **Response (200 OK)**:
    ```json
    {
        "success": true,
        "message": "Discount removed from order successfully"
    }
    ```

---

## BIR Recalculation Calculations Reference

The backend computes totals as follows:

| Customer Group | VAT Rate | Discount Amount | Tax Amount (VAT 12%) | Net Total |
| :--- | :--- | :--- | :--- | :--- |
| **Regular** | `12%` | `0` | `subtotal * 0.12` | `subtotal + taxAmount` |
| **Standard Promo (10% Off)** | `12%` | `subtotal * 0.10` | `(subtotal - discountAmount) * 0.12` | `subtotal - discountAmount + taxAmount` |
| **Senior Citizen / PWD** | **`0%` (Exempt)** | `subtotal * 0.20` | **`0.00`** | `subtotal - discountAmount` |
