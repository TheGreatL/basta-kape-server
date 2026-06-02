# Frontend Integration Guide: Product Settings

This guide details the integration endpoints available in the **Basta Kape API** for managing product configurations: categories, product types, and size/modifier attributes.

---

## Access Control & Authorization

All endpoints in this module require JWT authentication via the `Authorization: Bearer <token>` header. Access is restricted using Role-Based Access Control (RBAC) under the **Product Settings Management** module (`PRODUCT_SETTINGS_MANAGEMENT`).

---

## Common Query Parameters

All list (`GET`) endpoints in this module support the following query parameters:
*   `page` (number, optional, default: `1`): Current page.
*   `limit` (number, optional, default: `10`, max: `100`): Items per page.
*   `search` (string, optional): Matches on name or description.
*   `status` (enum: `"active" | "archive"`, optional, default: `"active"`): Filter active or soft-deleted items.

---

## Endpoints Description

### 1. Product Categories (`/product-settings/categories`)
Used to categorize items (e.g. Espresso Drinks, Pastries, Non-Coffee).

*   **`GET /product-settings/categories`**: Paginated and searchable list of categories.
    *   **RBAC**: `read`
*   **`GET /product-settings/categories/:id`**: Retrieves a specific category profile.
    *   **RBAC**: `read`
*   **`POST /product-settings/categories`**: Creates a new product category.
    *   **Body**: `name` (string, required, min 2, max 100), `description` (string, optional, max 500).
    *   **RBAC**: `create`
*   **`PUT /product-settings/categories/:id`**: Updates category fields.
    *   **Body**: `name` (optional), `description` (optional).
    *   **RBAC**: `update`
*   **`DELETE /product-settings/categories/:id`**: Soft-deletes a category.
    *   **RBAC**: `delete`

---

### 2. Product Types (`/product-settings/types`)
Used to declare item types (e.g. Hot Beverage, Iced Beverage, Baked Goods).

*   **`GET /product-settings/types`**: Paginated and searchable list of product types.
    *   **RBAC**: `read`
*   **`GET /product-settings/types/:id`**: Specific product type details.
    *   **RBAC**: `read`
*   **`POST /product-settings/types`**: Creates a new product type.
    *   **Body**: `name` (string, required, min 2, max 100), `description` (string, optional, max 500).
    *   **RBAC**: `create`
*   **`PUT /product-settings/types/:id`**: Updates type properties.
    *   **Body**: `name` (optional), `description` (optional).
    *   **RBAC**: `update`
*   **`DELETE /product-settings/types/:id`**: Soft-deletes a product type.
    *   **RBAC**: `delete`

---

### 3. Product Attributes (`/product-settings/attributes`)
Used to define customizing options (e.g. "Size", "Milk Option").

*   **`GET /product-settings/attributes`**: Paginated and searchable list of attributes.
    *   **RBAC**: `read`
*   **`GET /product-settings/attributes/:id`**: Specific attribute details.
    *   **RBAC**: `read`
*   **`POST /product-settings/attributes`**: Creates a new attribute.
    *   **Body**: `name` (string, required, min 2, max 100), `description` (string, optional, max 500).
    *   **RBAC**: `create`
*   **`PUT /product-settings/attributes/:id`**: Updates attribute properties.
    *   **Body**: `name` (optional), `description` (optional).
    *   **RBAC**: `update`
*   **`DELETE /product-settings/attributes/:id`**: Soft-deletes an attribute (automatically cascades to soft-delete all its active child values).
    *   **RBAC**: `delete`

---

### 4. Product Attribute Values (`/product-settings/attribute-values` & `/product-settings/attributes/:attributeId/values`)
Used to declare specific modifier values (e.g. Size values: "Small", "Large"; Milk values: "Oat Milk", "Almond Milk").

*   **`GET /product-settings/attributes/:attributeId/values`**: Paginated list of all active values matching a parent attribute.
    *   **RBAC**: `read`
*   **`GET /product-settings/attribute-values/:id`**: Specific attribute value details.
    *   **RBAC**: `read`
*   **`POST /product-settings/attribute-values`**: Creates a value mapping.
    *   **Body**: `productAttributeId` (UUID, required), `value` (string, required, min 1, max 100).
    *   **RBAC**: `create`
*   **`PUT /product-settings/attribute-values/:id`**: Updates value text.
    *   **Body**: `value` (string, required, min 1, max 100).
    *   **RBAC**: `update`
*   **`DELETE /product-settings/attribute-values/:id`**: Soft-deletes a specific attribute value.
    *   **RBAC**: `delete`
