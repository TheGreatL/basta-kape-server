# Frontend Integration Guide: Roles & Permissions (RBAC)

This guide details the integration endpoints available in the **Basta Kape API** for managing RBAC (Role-Based Access Control) modules, permissions, and custom role assignments.

---

## Access Control & Authorization

All endpoints in this module require JWT authentication via the `Authorization: Bearer <token>` header. Access is restricted using Role-Based Access Control (RBAC) under the **Roles and Permissions** module (`ROLES_AND_PERMISSIONS`).

---

## Endpoints Description

### 1. RBAC Roles Management (`/rbac/roles`)

#### `GET /rbac/roles/modules-permissions`
*   **Description**: Retrieves the dynamic selection tree of all available modules, their nested permissions (create, read, update, delete), and the specific `modulePermissionId` UUIDs for each scope level. Used to render the checkbox tree form when creating or editing a role.
*   **RBAC Permission Required**: `create` (module: `ROLES_AND_PERMISSIONS`)
*   **Response (200 OK)**:
    ```json
    [
        {
            "moduleId": "module-uuid-1",
            "moduleName": "Users Management",
            "permissions": [
                {
                    "permissionId": "perm-uuid-1",
                    "permissionName": "create",
                    "modulePermissions": [
                        {
                            "modulePermissionId": "mp-uuid-1",
                            "scope": "ALL"
                        },
                        {
                            "modulePermissionId": "mp-uuid-2",
                            "scope": "STORE"
                        },
                        {
                            "modulePermissionId": "mp-uuid-3",
                            "scope": "OWN"
                        }
                    ]
                }
            ]
        }
    ]
    ```

#### `GET /rbac/roles/list`
*   **Description**: Retrieves a paginated list of all configured roles. Can be filtered by a search term or status.
*   **RBAC Permission Required**: `read` (module: `ROLES_AND_PERMISSIONS`)
*   **Query Parameters**:
    *   `page` (number, optional): Current page.
    *   `limit` (number, optional, max: `50`): Items per page.
    *   `search` (string, optional): Matches on role name or description.
    *   `status` (enum: `"active" | "archive"`, optional): Filter active or soft-deleted roles.
*   **Response (200 OK)**: Paginated structure containing `data` (list of roles with `id`, `name`, `description`, `isSystem`, timestamps) and `meta`.

#### `GET /rbac/roles/:name`
*   **Description**: Retrieves detailed permissions configuration for a specific role, looked up by its **name** (not ID).
*   **RBAC Permission Required**: `read` (module: `ROLES_AND_PERMISSIONS`)
*   **Response (200 OK)**:
    ```json
    {
        "id": "role-uuid",
        "name": "Cashier",
        "description": "Point of sale operator",
        "isSystem": true,
        "createdAt": "2026-06-02T05:00:00.000Z",
        "updatedAt": "2026-06-02T05:00:00.000Z",
        "deletedAt": null,
        "rolePermissions": [
            {
                "modulePermission": {
                    "id": "mp-uuid-1",
                    "accessScope": "STORE",
                    "module": {
                        "id": "module-uuid-1",
                        "name": "Point of Sale (POS)"
                    },
                    "permission": {
                        "id": "perm-uuid-1",
                        "name": "create"
                    }
                }
            }
        ]
    }
    ```

#### `POST /rbac/roles`
*   **Description**: Creates a new custom role with associated permission mapping scopes.
*   **RBAC Permission Required**: `create` (module: `ROLES_AND_PERMISSIONS`)
*   **Request Body**:
    *   `name` (string, required, min 2): Unique name of the role (e.g., "Shift Lead").
    *   `description` (string, optional): Detailed purpose of this role.
    *   `permissions` (array of objects, optional, default: `[]`): Mapping nodes from the selection tree.
        *   `modulePermissionId` (string, UUID): The specific module-permission-scope combination ID from the selection tree.
        *   `scope` (enum: `"ALL" | "STORE" | "OWN"`): Access scope level.
*   **Response (201 Created)**: The newly created Role object.

#### `PUT /rbac/roles/:id`
*   **Description**: Updates a custom role's details and completely overwrites/re-syncs its permission mapping scopes. Cannot modify system generated roles.
*   **RBAC Permission Required**: `update` (module: `ROLES_AND_PERMISSIONS`)
*   **Request Body**: Similar to `POST`, but all fields are optional. Providing `permissions` will completely replace all previous permission mappings for this role.
*   **Response (200 OK)**: The updated Role object.
*   **Error Responses**:
    *   `403 Forbidden`: System generated roles cannot be modified.
    *   `404 Not Found`: Role not found.

#### `DELETE /rbac/roles/:id`
*   **Description**: Soft-deletes a non-system role. System roles (Owner, Administrator, Cashier, Barista, Customer) cannot be deleted.
*   **RBAC Permission Required**: `delete` (module: `ROLES_AND_PERMISSIONS`)
*   **Response (200 OK)**: The soft-deleted Role object.
*   **Error Responses**:
    *   `403 Forbidden`: System generated roles cannot be deleted.
    *   `404 Not Found`: Role not found.

---

### 2. System Permissions (`/rbac/permissions`)

#### `GET /rbac/permissions/list`
*   **Description**: Retrieves a paginated list of the four baseline action nodes (`create`, `read`, `update`, `delete`). Used when assembling role configuration forms.
*   **RBAC Permission Required**: `read` (module: `ROLES_AND_PERMISSIONS`)
*   **Query Parameters**:
    *   `page` (number, optional): Current page.
    *   `limit` (number, optional, max: `50`): Items per page.
    *   `search` (string, optional): Matches on permission name or description.
*   **Response (200 OK)**: Paginated structure containing `data` (list of permissions with `id`, `name`, `description`, `createdAt`) and `meta`.

---

### 3. System Modules (`/rbac/modules`)

#### `GET /rbac/modules/list`
*   **Description**: Retrieves a paginated list of all system modules (POS, Menu, Inventory, Staff, Sales, etc.) to choose from during role setup.
*   **RBAC Permission Required**: `read` (module: `ROLES_AND_PERMISSIONS`)
*   **Query Parameters**:
    *   `page` (number, optional): Current page.
    *   `limit` (number, optional, max: `50`): Items per page.
    *   `search` (string, optional): Matches on module name or description.
*   **Response (200 OK)**: Paginated structure containing `data` (list of modules) and `meta`.
