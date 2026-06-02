# Frontend Integration Guide: Products & Variants

This guide details the integration endpoints available in the **Basta Kape API** for managing product catalog profiles, pricing, and dynamic attribute-linked product variants.

---

## Access Control & Authorization

All endpoints in this module require JWT authentication via the `Authorization: Bearer <token>` header. Access is restricted using Role-Based Access Control (RBAC) under the **Products Management** module (`PRODUCTS_MANAGEMENT`).

---

## Endpoints Description

### 1. Products Management (`/products`)

#### `GET /products`
*   **Description**: Retrieves a paginated list of products for admin and management catalogs. Supports search terms and parent filtering.
*   **RBAC**: `read`
*   **Query Parameters**:
    *   `page` (number, optional, default: `1`): Current page.
    *   `limit` (number, optional, default: `10`, max: `100`): Items per page.
    *   `search` (string, optional): Matches on product name or description.
    *   `productCategoryId` (string, UUID, optional): Filter by category.
    *   `productTypeId` (string, UUID, optional): Filter by product type.
    *   `status` (enum: `"active" | "archive"`, optional, default: `"active"`): Filter soft-deleted items.
*   **Response (200 OK)**: Paginated structure containing `data` (list of products, including categories, types, and active variant listings) and `meta`.

#### `GET /products/:id`
*   **Description**: Retrieves a specific product, complete with its assigned category, product type, and list of all active pricing variants.
*   **RBAC**: `read`

#### `POST /products`
*   **Description**: Creates a new product profile.
*   **RBAC**: `create`
*   **Request Body**:
    *   `name` (string, required, min 2, max 100): Unique name of the drink/product (e.g. "Caramel Macchiato").
    *   `photo` (string, optional): URL link of the uploaded product photo image.
    *   `description` (string, optional, max 1000): Brief descriptive notes.
    *   `productCategoryId` (string, UUID, optional): Link to category.
    *   `productTypeId` (string, UUID, optional): Link to product type.
*   **Response (201 Created)**: The newly created Product object.

#### `PUT /products/:id`
*   **Description**: Updates product details.
*   **RBAC**: `update`
*   **Request Body**: Similar to `POST`, but all fields are optional.

#### `DELETE /products/:id`
*   **Description**: Soft-deletes a parent product, automatically cascading to soft-delete all child product variants and active variant attribute mapping join records inside a transaction.
*   **RBAC**: `delete`
*   **Response (200 OK)**:
    ```json
    {
        "message": "Product soft-deleted successfully"
    }
    ```

---

### 2. Product Variants Management (`/products/variants`)
Handles size, milk type, and price modifications.

#### `GET /products/variants/:id`
*   **Description**: Retrieves detailed configurations of a specific variant, including its dynamic attribute value mappings (e.g. Size: Large) and parent product.
*   **RBAC**: `read`

#### `POST /products/:productId/variants`
*   **Description**: Creates a variant under a product, linking it to dynamic attributes (sizes, milk options, etc.) inside an atomic transaction.
*   **RBAC**: `create`
*   **Request Body**:
    *   `sku` (string, optional, min 2, max 50): Unique stock keeping unit code (e.g., "LAT-LRG-OAT").
    *   `price` (number, required, min 0, default: `0`): Price of this specific variant configuration.
    *   `attributeValueIds` (array of strings, UUIDs, optional, default: `[]`): Link to specific active attribute values (e.g., UUID of "Large", UUID of "Oat Milk").
*   **Response (201 Created)**: Returns the created Variant object with its attributes array.

#### `PUT /products/variants/:id`
*   **Description**: Updates variant properties and completely re-syncs all its attribute value mappings inside a safe transaction.
*   **RBAC**: `update`
*   **Request Body**: Similar to `POST`, but all fields are optional. Providing `attributeValueIds` will completely replace all previous attribute mappings for this variant.

#### `DELETE /products/variants/:id`
*   **Description**: Soft-deletes a single variant and its attribute mappings.
*   **RBAC**: `delete`
*   **Response (200 OK)**:
    ```json
    {
        "message": "Product variant soft-deleted successfully"
    }
    ```
