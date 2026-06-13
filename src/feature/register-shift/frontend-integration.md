# Frontend Integration Guide: Register Shift Management

This guide details the integration endpoints available in the **Basta Kape API** for managing cashier shifts and register balances.

---

## Access Control & Authorization

All endpoints in this module require JWT authentication via the `Authorization: Bearer <token>` header. Access is restricted using Role-Based Access Control (RBAC) under the **Point of Sale (POS)** module (`Point of Sale (POS)`).

---

## Endpoints Description

### 1. `GET /register-shifts`
*   **Description**: Retrieves all cashier register shifts chronologically (ordered by date opened descending). **Requires access scope `ALL`**.
*   **RBAC Permission Required**: `read` (module: `Point of Sale (POS)`)
*   **Query Parameters**:
    *   `page` (number, optional, default: 1): The page number.
    *   `limit` (number, optional, default: 10, max: 100): Number of items per page.
    *   `search` (string, optional): Searches cashier username, first name, or last name.
*   **Response (200 OK)**:
    ```json
    {
        "data": [
            {
                "id": "shift-uuid-1",
                "cashierId": "cashier-user-uuid",
                "openedAt": "2026-06-11T12:00:00.000Z",
                "closedAt": "2026-06-11T20:00:00.000Z",
                "startBalance": 5000.00,
                "endBalance": 8500.00,
                "actualBalance": 8500.00,
                "notes": "End of morning shift. Drawer was fully balanced.",
                "cashier": {
                    "id": "cashier-user-uuid",
                    "username": "cashier_john",
                    "firstName": "John",
                    "lastName": "Doe"
                }
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
*   **Error Responses**:
    *   **403 Forbidden**: If the user does not have an access scope of `'ALL'`.

### 2. `GET /register-shifts/my-shifts`
*   **Description**: Retrieves register shifts belonging only to the currently logged-in cashier.
*   **RBAC Permission Required**: `read` (module: `Point of Sale (POS)`)
*   **Query Parameters**:
    *   `page` (number, optional, default: 1): The page number.
    *   `limit` (number, optional, default: 10, max: 100): Number of items per page.
    *   `search` (string, optional): Searches cashier username, first name, or last name (within the cashier's own shifts).
*   **Response (200 OK)**:
    ```json
    {
        "data": [
            {
                "id": "shift-uuid-1",
                "cashierId": "cashier-user-uuid",
                "openedAt": "2026-06-11T12:00:00.000Z",
                "closedAt": "2026-06-11T20:00:00.000Z",
                "startBalance": 5000.00,
                "endBalance": 8500.00,
                "actualBalance": 8500.00,
                "notes": "End of morning shift. Drawer was fully balanced.",
                "cashier": {
                    "id": "cashier-user-uuid",
                    "username": "cashier_john",
                    "firstName": "John",
                    "lastName": "Doe"
                }
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

### 3. `GET /register-shifts/active`
*   **Description**: Retrieves the currently active register shift session for the logged-in cashier.
*   **RBAC Permission Required**: `read` (module: `Point of Sale (POS)`)
*   **Response (200 OK)**:
    ```json
    {
        "id": "shift-uuid-1",
        "cashierId": "cashier-user-uuid",
        "openedAt": "2026-06-11T12:00:00.000Z",
        "closedAt": null,
        "startBalance": 5000.00,
        "endBalance": null,
        "actualBalance": null,
        "notes": "Opening cashier drawer shift for morning schedule",
        "cashier": {
            "id": "cashier-user-uuid",
            "username": "cashier_john",
            "firstName": "John",
            "lastName": "Doe"
        }
    }
    ```
*   **Error Responses**:
    *   **404 Not Found**: If no active shift exists for the logged-in cashier:
        ```json
        {
            "statusCode": 404,
            "message": "No active register shift session found for this cashier."
        }
        ```

### 4. `POST /register-shifts/open`
*   **Description**: Opens a new register shift session. A cashier can only have one active shift session at a time.
*   **RBAC Permission Required**: `create` (module: `Point of Sale (POS)`)
*   **Request Body**:
    *   `startBalance` (number, required, >= 0): The initial cash amount placed in the drawer (e.g. PHP 5000.00).
    *   `notes` (string, optional, max 1000): General notes regarding the opening session.
*   **Response (201 Created)**:
    ```json
    {
        "id": "shift-uuid-1",
        "cashierId": "cashier-user-uuid",
        "openedAt": "2026-06-11T12:00:00.000Z",
        "closedAt": null,
        "startBalance": 5000.00,
        "endBalance": null,
        "actualBalance": null,
        "notes": "Opening cashier drawer shift for morning schedule",
        "cashier": {
            "id": "cashier-user-uuid",
            "username": "cashier_john",
            "firstName": "John",
            "lastName": "Doe"
        }
    }
    ```
*   **Error Responses**:
    *   **409 Conflict**: If the cashier already has an active register shift session:
        ```json
        {
            "statusCode": 409,
            "message": "You already have an active register shift. Please close it before opening a new one."
        }
        ```

### 5. `POST /register-shifts/close`
*   **Description**: Closes the active register shift session, records the physical cash count, and automatically computes the drawer discrepancies (over/short).
*   **Business Logic**:
*   The system aggregates all finalized cash sales during the shift: `cashSales = sum(Order.netTotal)` where `order.cashierSessionId = activeShift.id`, `order.status = 'COMPLETED'`, and order payment is `CASH`.
*   Expected ending balance: `endBalance = startBalance + cashSales`.
*   Discrepancy (difference): `difference = actualBalance - endBalance`.
*   **RBAC Permission Required**: `update` (module: `Point of Sale (POS)`)
*   **Request Body**:
    *   `actualBalance` (number, required, >= 0): The actual physical cash counted in the drawer at the end of the shift.
    *   `notes` (string, optional, max 1000): End-of-shift notes (e.g. explanations for discrepancies).
*   **Response (200 OK)**:
    ```json
    {
        "id": "shift-uuid-1",
        "cashierId": "cashier-user-uuid",
        "openedAt": "2026-06-11T12:00:00.000Z",
        "closedAt": "2026-06-11T20:00:00.000Z",
        "startBalance": 5000.00,
        "endBalance": 8500.00,
        "actualBalance": 8500.00,
        "notes": "End of morning shift. Drawer was fully balanced.",
        "cashier": {
            "id": "cashier-user-uuid",
            "username": "cashier_john",
            "firstName": "John",
            "lastName": "Doe"
        }
    }
    ```
*   **Error Responses**:
    *   **404 Not Found**: If no active shift exists to close:
        ```json
        {
            "statusCode": 404,
            "message": "No active register shift session found to close."
        }
        ```

---

## How to Use `cashierId` and Shift Drawer Sessions in the Frontend

### 1. Enforcing Shift Drawer Requirements
When a cashier logs into the POS application, the frontend should immediately verify if they have an active drawer session to proceed with sales:
1. Call `GET /register-shifts/active` on application startup.
2. **If 404 Not Found**: Block checkout operations and display a modal prompting the cashier to "Open Shift Drawer" by entering the initial `startBalance` (e.g. PHP 5,000.00). Submit this balance via `POST /register-shifts/open` to start the session.
3. **If 200 OK**: Cache the register shift details (including the shift `id` and `cashierId`) in the application state and unblock cashier checkout operations.

### 2. Session Ownership and Validation
* **Match Shift Owner**: The returned `cashierId` can be matched against the currently logged-in user's ID (decoded from the JWT token) on the frontend. If a different cashier attempts to use the same POS terminal while a shift is open under a different cashier, the frontend should warning-block transactions and request the previous cashier to close the shift or log back in.
* **Cashier Label on Receipts**: Use the `cashierId` or the auth state user details to print the cashier's name/ID on order labels and print receipts.

### 3. Manager/Auditor Dashboard
* In shift drawer history logs or auditor list dashboards, the `cashierId` is used to link/display who opened/closed the drawer. If the frontend needs to fetch user details (such as first name, last name, and username) for display, it can call `/users/:id` using this `cashierId`.
