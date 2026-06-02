# Frontend Integration Guide: User & Staff Accounts

This guide details the integration endpoints available in the **Basta Kape API** for managing employee profiles, staff logs, and role updates.

---

## Access Control & Authorization

All endpoints in this module require JWT authentication via the `Authorization: Bearer <token>` header. Access is restricted using Role-Based Access Control (RBAC) under the **Users Management** module (`USERS_MANAGEMENT`).

---

## Endpoints Description

### 1. `GET /users/list`
*   **Description**: Retrieves a paginated, filterable, and searchable directory of staff accounts.
*   **RBAC Permission Required**: `read` (module: `USERS_MANAGEMENT`)
*   **Query Parameters**:
    *   `page` (number, optional, default: `1`): Current page of the paginated list.
    *   `limit` (number, optional, default: `10`, max: `100`): Items per page.
    *   `search` (string, optional): Matches on username, first name, last name, or email.
    *   `status` (enum: `"active" | "archive"`, optional): Filter active accounts or soft-deleted ones.
    *   `role` (string, optional): Filter users by their role name.
*   **Response (200 OK)**:
    ```json
    {
        "data": [
            {
                "id": "user-uuid-1",
                "email": "barista@bastakape.com",
                "username": "baristaOne",
                "firstName": "John",
                "middleName": null,
                "lastName": "Doe",
                "phoneNumber": "+639171234567",
                "profilePhoto": "https://api.bastakape.com/uploads/avatars/barista1.jpg",
                "createdAt": "2026-06-02T05:00:00.000Z",
                "updatedAt": "2026-06-02T05:00:00.000Z",
                "deletedAt": null,
                "userRoles": [
                    {
                        "role": {
                            "id": "role-uuid-1",
                            "name": "Barista"
                        }
                    }
                ]
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

### 2. `GET /users/:id`
*   **Description**: Retrieves detailed profile information for a specific staff member.
*   **RBAC Permission Required**: `read` (module: `USERS_MANAGEMENT`)
*   **Response (200 OK)**:
    ```json
    {
        "id": "user-uuid-1",
        "email": "barista@bastakape.com",
        "username": "baristaOne",
        "firstName": "John",
        "middleName": null,
        "lastName": "Doe",
        "phoneNumber": "+639171234567",
        "profilePhoto": "https://api.bastakape.com/uploads/avatars/barista1.jpg",
        "createdAt": "2026-06-02T05:00:00.000Z",
        "updatedAt": "2026-06-02T05:00:00.000Z",
        "deletedAt": null,
        "userRoles": [
            {
                "role": {
                    "id": "role-uuid-1",
                    "name": "Barista"
                }
            }
        ]
    }
    ```

### 3. `PUT /users/:id`
*   **Description**: Updates a staff member's profile details and re-assigns their system roles.
*   **RBAC Permission Required**: `update` (module: `USERS_MANAGEMENT`)
*   **Request Body**:
    *   `firstName` (string, optional, min 2)
    *   `lastName` (string, optional, min 2)
    *   `middleName` (string, optional, nullable)
    *   `phoneNumber` (string, optional, nullable)
    *   `roleIds` (array of strings, UUIDs, optional): Array of role IDs to associate with this user.
*   **Response (200 OK)**: Returns the fully updated user object.

### 4. `DELETE /users/:id`
*   **Description**: Soft-deletes a staff account. Deactivated staff will be blocked from logging into the POS or Admin control dashboard.
*   **RBAC Permission Required**: `delete` (module: `USERS_MANAGEMENT`)
*   **Response (200 OK)**:
    ```json
    {
        "message": "User soft-deleted successfully"
    }
    ```

### 5. `POST /users/:id/profile-picture`
*   **Description**: Uploads a profile picture for a specific user.
*   **Access Control**: Authenticated users can upload their own profile picture. Updating another user's profile picture requires the `update` permission under `USERS_MANAGEMENT`.
*   **Request Body**: Multi-part `multipart/form-data` containing a `file` field.
    *   `file` (binary, required): Image file (PNG, JPG, JPEG, max 5MB).
*   **Response (200 OK)**:
    ```json
    {
        "url": "https://api.bastakape.com/uploads/avatars/uploaded-profile-filename.jpg"
    }
    ```
