# Frontend Integration Guide: Suppliers Management

This guide details the integration endpoints available in the **Basta Kape API** for managing supplier profiles and contact information.

---

## Access Control & Authorization

All endpoints in this module require JWT authentication via the `Authorization: Bearer <token>` header. Access is restricted using Role-Based Access Control (RBAC) under the **Suppliers Management** module (`SUPPLIERS_MANAGEMENT`).

---

## Endpoints Description

### 1. `GET /suppliers`
*   **Description**: Retrieves a paginated, searchable list of suppliers.
*   **RBAC Permission Required**: `read` (module: `SUPPLIERS_MANAGEMENT`)
*   **Query Parameters**:
    *   `page` (number, optional, default: `1`): Current page of the paginated list.
    *   `limit` (number, optional, default: `10`, max: `100`): Number of suppliers per page.
    *   `search` (string, optional): Matches against the supplier name or contact person.
    *   `status` (enum: `"active" | "archive"`, optional, default: `"active"`): Filter for active suppliers or soft-deleted (archived) ones.
*   **Response (200 OK)**:
    ```json
    {
        "data": [
            {
                "id": "supplier-uuid-1",
                "name": "Kape Beans Trading Co.",
                "address": "123 Coffee Lane, Manila",
                "contactPerson": "Juan Dela Cruz",
                "contactNumber": "+639171234567",
                "notes": "Primary supplier for Arabica and Robusta beans.",
                "createdAt": "2026-06-02T05:00:00.000Z",
                "updatedAt": "2026-06-02T05:00:00.000Z",
                "deletedAt": null
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

### 2. `GET /suppliers/:id`
*   **Description**: Retrieves the details of a single supplier profile by its unique ID.
*   **RBAC Permission Required**: `read` (module: `SUPPLIERS_MANAGEMENT`)
*   **Response (200 OK)**:
    ```json
    {
        "id": "supplier-uuid-1",
        "name": "Kape Beans Trading Co.",
        "address": "123 Coffee Lane, Manila",
        "contactPerson": "Juan Dela Cruz",
        "contactNumber": "+639171234567",
        "notes": "Primary supplier for Arabica and Robusta beans.",
        "createdAt": "2026-06-02T05:00:00.000Z",
        "updatedAt": "2026-06-02T05:00:00.000Z",
        "deletedAt": null
    }
    ```
*   **Error Responses**:
    *   `404 Not Found`: If the supplier ID does not exist or has been soft-deleted (unless fetching archived status explicitly).

### 3. `POST /suppliers`
*   **Description**: Creates a new supplier profile.
*   **RBAC Permission Required**: `create` (module: `SUPPLIERS_MANAGEMENT`)
*   **Request Body**:
    *   `name` (string, required, min 2, max 100): Unique business or brand name of the supplier.
    *   `address` (string, optional, max 500): Supplier physical address.
    *   `contactPerson` (string, optional, max 100): Main point of contact name.
    *   `contactNumber` (string, optional, max 50): Phone or mobile number of the contact person.
    *   `notes` (string, optional, max 1000): Additional custom notes or terms of trade.
*   **Response (210 Created)**: Returns the newly created supplier object.
    ```json
    {
        "id": "new-supplier-uuid",
        "name": "Premium Milk Distributors",
        "address": "456 Dairy Blvd, Quezon City",
        "contactPerson": "Maria Santos",
        "contactNumber": "+639189876543",
        "notes": "Provides fresh whole milk and oat milk alternatives.",
        "createdAt": "2026-06-02T05:15:00.000Z",
        "updatedAt": "2026-06-02T05:15:00.000Z",
        "deletedAt": null
    }
    ```

### 4. `PUT /suppliers/:id`
*   **Description**: Updates an existing supplier's details.
*   **RBAC Permission Required**: `update` (module: `SUPPLIERS_MANAGEMENT`)
*   **Request Body**: Similar to `POST /suppliers`, but all fields are optional.
    *   `name` (string, optional, min 2, max 100)
    *   `address` (string, optional, max 500)
    *   `contactPerson` (string, optional, max 100)
    *   `contactNumber` (string, optional, max 50)
    *   `notes` (string, optional, max 1000)
*   **Response (200 OK)**: Returns the fully updated supplier object.

### 5. `DELETE /suppliers/:id`
*   **Description**: Soft-deletes a supplier profile (marks their status as archived by setting the `deletedAt` timestamp).
*   **RBAC Permission Required**: `delete` (module: `SUPPLIERS_MANAGEMENT`)
*   **Response (200 OK)**:
    ```json
    {
        "message": "Supplier soft-deleted successfully"
    }
    ```
