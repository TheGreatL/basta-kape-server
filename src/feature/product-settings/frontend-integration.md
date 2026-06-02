# Frontend Integration Guide: Product Settings

This guide details the integration endpoints available in the **Basta Kape API** for managing product configurations: categories, product types, and size/modifier attributes.

---

## Endpoints Description

### 1. Product Categories (`/product-settings/categories`)
Used to categorize items (e.g. Espresso Drinks, Pastries, Non-Coffee).

*   **`GET /product-settings/categories`**: Retrieves a paginated and searchable list of categories. Supports `status=active` (default) or `status=archive` filters.
*   **`GET /product-settings/categories/:id`**: Retrieves a specific category profile.
*   **`POST /product-settings/categories`**: Creates a new product category (requires `name` and optional `description`).
*   **`PUT /product-settings/categories/:id`**: Updates category fields.
*   **`DELETE /product-settings/categories/:id`**: Soft-deletes a category.

---

### 2. Product Types (`/product-settings/types`)
Used to declare item types (e.g. Hot Beverage, Iced Beverage, Baked Goods).

*   **`GET /product-settings/types`**: Paginated and searchable list of product types.
*   **`GET /product-settings/types/:id`**: Specific product type details.
*   **`POST /product-settings/types`**: Creates a new product type (requires `name` and optional `description`).
*   **`PUT /product-settings/types/:id`**: Updates type properties.
*   **`DELETE /product-settings/types/:id`**: Soft-deletes a product type.

---

### 3. Product Attributes (`/product-settings/attributes`)
Used to define customizing options (e.g. "Size", "Milk Option").

*   **`GET /product-settings/attributes`**: Paginated and searchable list of attributes.
*   **`GET /product-settings/attributes/:id`**: Specific attribute details.
*   **`POST /product-settings/attributes`**: Creates a new attribute (requires `name` and optional `description`).
*   **`PUT /product-settings/attributes/:id`**: Updates attribute properties.
*   **`DELETE /product-settings/attributes/:id`**: Soft-deletes an attribute (automatically cascades to soft-delete all its active child values).

---

### 4. Product Attribute Values (`/product-settings/attribute-values` & `/product-settings/attributes/:attributeId/values`)
Used to declare specific modifier values (e.g. Size values: "Small", "Large"; Milk values: "Oat Milk", "Almond Milk").

*   **`GET /product-settings/attributes/:attributeId/values`**: Paginated list of all active values matching a parent attribute.
*   **`GET /product-settings/attribute-values/:id`**: Specific attribute value details.
*   **`POST /product-settings/attribute-values`**: Creates a value mapping.
    *   *Body*: `productAttributeId` (UUID, required), `value` (string, required).
*   **`PUT /product-settings/attribute-values/:id`**: Updates value text (requires `value` string).
*   **`DELETE /product-settings/attribute-values/:id`**: Soft-deletes a specific attribute value.
