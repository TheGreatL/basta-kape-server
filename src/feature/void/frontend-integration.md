# Frontend Integration - Order Void Logs & Audits

This documentation outlines the integration details for the **Order Void Logs & Audits (`OrderVoidLog`)** backend feature. Voids are restricted, high-privilege operations requiring a supervisor, manager, or administrator override for loss prevention.

---

## Endpoints

### 1. Void an Active Order
Voids a pending/active order, changes its status to `CANCELLED`, logs an audit history, and records the void override reason.

* **Path**: `/api/orders/:orderId/void`
* **Method**: `POST`
* **Access Scope**: Requires `Point of Sale (POS)` module access (`delete` permission).
* **Role Requirement**: The authenticated user performing the request (`actorId` from Bearer token) must have one of these roles: `Owner`, `Administrator`, `Manager`, or `Supervisor`.
* **Request Headers**:
  ```http
  Authorization: Bearer <token>
  Content-Type: application/json
  ```
* **Request Params**:
  * `orderId` (UUID string, required)
* **Request Body**:
  * `reason` (string, required): Minimum of 3 characters, maximum of 1000 characters.
  * *Example*:
    ```json
    {
      "reason": "Customer wanted to change the size but order was already printed; re-creating a new order."
    }
    ```

* **Success Response (200 OK)**:
  * Returns the created void log details.
  * *Example*:
    ```json
    {
      "id": "764953bf-e325-4c07-b30c-512c019bd1e9",
      "orderId": "6b98687a-360d-4001-92ab-257a070eb3e1",
      "reason": "Customer wanted to change the size but order was already printed; re-creating a new order.",
      "voidedById": "test-void-admin-id",
      "createdAt": "2026-06-12T11:06:59.000Z",
      "voidedBy": {
        "id": "test-void-admin-id",
        "username": "testvoidadmin",
        "firstName": "Test",
        "lastName": "Admin"
      },
      "order": {
        "id": "6b98687a-360d-4001-92ab-257a070eb3e1",
        "queueNumber": "#V01",
        "customerName": null,
        "netTotal": 168.0
      }
    }
    ```

* **Error Responses**:
  * **400 Bad Request**:
    * Reason: Zod validation failed (e.g. reason too short), or the order status is already `COMPLETED` or `CANCELLED`.
    * *Example*:
      ```json
      { "error": "Cannot void an order that is already completed or cancelled." }
      ```
  * **403 Forbidden**:
    * Reason: The user does not have `POINT_OF_SALE` `DELETE` access scope, OR the user does not possess one of the supervisor/manager/admin roles required for override.
    * *Example*:
      ```json
      { "error": "Insufficient permissions. Managers, supervisors, or administrators override required." }
      ```
  * **404 Not Found**:
    * Reason: Order ID could not be found.
    * *Example*:
      ```json
      { "error": "Order not found" }
      ```

---

### 2. Retrieve Void Logs & Audit Trails
Retrieve all void log records in the store, ordered by date descending.

* **Path**: `/api/orders/void-logs`
* **Method**: `GET`
* **Access Scope**: Requires `Orders Management` module access (`read` permission).
* **Request Headers**:
  ```http
  Authorization: Bearer <token>
  ```

* **Success Response (200 OK)**:
  * Returns an array of void logs.
  * *Example*:
    ```json
    [
      {
        "id": "764953bf-e325-4c07-b30c-512c019bd1e9",
        "orderId": "6b98687a-360d-4001-92ab-257a070eb3e1",
        "reason": "Customer changed their mind",
        "voidedById": "test-void-admin-id",
        "createdAt": "2026-06-12T11:06:59.000Z",
        "voidedBy": {
          "id": "test-void-admin-id",
          "username": "testvoidadmin",
          "firstName": "Test",
          "lastName": "Admin"
        },
        "order": {
          "id": "6b98687a-360d-4001-92ab-257a070eb3e1",
          "queueNumber": "#V01",
          "customerName": null,
          "netTotal": 168.0
        }
      }
    ]
    ```

---

## Recommended Frontend Implementation Pattern

1. **Manager Override Modal**:
   When a cashier clicks the **Void** button on an order:
   * Open a dialog prompting for a supervisor/manager/admin credentials (if the currently logged-in cashier does not have a supervisor role).
   * Submit the void POST request using the manager's authorization context (or current token if already authorized).
   * Prompt for the void **reason** before dispatching the request.
2. **Order Details Screen**:
   * If an order's status is `CANCELLED`, query the list of void logs or check status logs to display who cancelled/voided the order and the reason given.
3. **Audit Trail Page**:
   * Create an audit view under Settings or Reports showing the void logs list, displaying:
     - Date & Time
     - Order Number (Queue Code)
     - Order Amount
     - Operator/Manager Name who authorized the void
     - Stated reason
