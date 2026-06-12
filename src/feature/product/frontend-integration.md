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
*   **Response (200 OK)**:
    ```json
    {
      "id": "string (UUID)",
      "name": "string",
      "photo": "string (URL) | null",
      "description": "string | null",
      "productCategoryId": "string (UUID) | null",
      "productTypeId": "string (UUID) | null",
      "category": {
        "id": "string (UUID)",
        "name": "string"
      } | null,
      "type": {
        "id": "string (UUID)",
        "name": "string"
      } | null,
      "variants": [
        {
          "id": "string (UUID)",
          "productId": "string (UUID)",
          "sku": "string | null",
          "price": "number",
          "recipe": {
            "id": "string (UUID)",
            "name": "string"
          } | null,
          "attributes": [
            {
              "id": "string (UUID)",
              "productVariantId": "string (UUID)",
              "productAttributeValueId": "string (UUID)",
              "attributeValue": {
                "id": "string (UUID)",
                "productAttributeId": "string (UUID)",
                "value": "string",
                "attribute": {
                  "id": "string (UUID)",
                  "name": "string"
                }
              }
            }
          ],
          "createdAt": "string (ISO Date)",
          "updatedAt": "string (ISO Date)",
          "deletedAt": "string (ISO Date) | null"
        }
      ],
      "createdAt": "string (ISO Date)",
      "updatedAt": "string (ISO Date)",
      "deletedAt": "string (ISO Date) | null"
    }
    ```

    ##### Response Example:
    ```json
    {
      "id": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
      "name": "Caramel Macchiato",
      "photo": "https://example.com/photos/caramel-macchiato.jpg",
      "description": "Espresso with steamed milk, vanilla syrup, and caramel drizzle.",
      "productCategoryId": "c1d2e3f4-a5b6-7c8d-9e0f-1a2b3c4d5e6f",
      "productTypeId": "t1y2p3e4-a5b6-7c8d-9e0f-1a2b3c4d5e6f",
      "category": {
        "id": "c1d2e3f4-a5b6-7c8d-9e0f-1a2b3c4d5e6f",
        "name": "Coffee"
      },
      "type": {
        "id": "t1y2p3e4-a5b6-7c8d-9e0f-1a2b3c4d5e6f",
        "name": "Espresso Drink"
      },
      "variants": [
        {
          "id": "v1a2r3i4-a5b6-7c8d-9e0f-1a2b3c4d5e6f",
          "productId": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
          "sku": "MAC-LRG-OAT",
          "price": 180,
          "recipe": {
            "id": "r1e2c3i4-p5e6-7c8d-9e0f-1a2b3c4d5e6f",
            "name": "Caramel Macchiato Large Oatmeal Recipe"
          },
          "attributes": [
            {
              "id": "pva1b2c3-d4e5-6f7a-8b9c-0d1e2f3a4b5c",
              "productVariantId": "v1a2r3i4-a5b6-7c8d-9e0f-1a2b3c4d5e6f",
              "productAttributeValueId": "pav1b2c3-d4e5-6f7a-8b9c-0d1e2f3a4b5c",
              "attributeValue": {
                "id": "pav1b2c3-d4e5-6f7a-8b9c-0d1e2f3a4b5c",
                "productAttributeId": "pa1b2c3d-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
                "value": "Large",
                "attribute": {
                  "id": "pa1b2c3d-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
                  "name": "Size"
                }
              }
            }
          ],
          "createdAt": "2026-06-06T14:23:10.000Z",
          "updatedAt": "2026-06-06T14:23:10.000Z",
          "deletedAt": null
        }
      ],
      "createdAt": "2026-06-06T14:23:10.000Z",
      "updatedAt": "2026-06-06T14:23:10.000Z",
      "deletedAt": null
    }
    ```



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
