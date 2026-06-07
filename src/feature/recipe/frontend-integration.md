# Frontend Integration Guide: Recipe Management (Bill of Materials)

This guide details the integration endpoints available in the **Basta Kape API** for managing recipes (Bill of Materials). Recipes map product variants (e.g. Medium Cappuccino) to raw stock ingredients (e.g. Coffee Beans, Fresh Milk) and their required prep quantities.

---

## Access Control & Authorization

All endpoints in this module require JWT authentication via the `Authorization: Bearer <token>` header. Access is restricted using Role-Based Access Control (RBAC) under the **Products Management** module (`PRODUCTS_MANAGEMENT`).

---

## Endpoints Description

### Recipe Management (`/products/variants/:variantId/recipe`)

All endpoints in this section are nested under product variants.

#### `GET /products/variants/:variantId/recipe`
*   **Description**: Retrieves the active recipe and ingredients required to prepare a specific product variant.
*   **RBAC**: `read`
*   **Response (200 OK)**:
    ```json
    {
      "id": "string (UUID)",
      "name": "string",
      "description": "string | null",
      "productVariantId": "string (UUID)",
      "ingredients": [
        {
          "id": "string (UUID)",
          "recipeId": "string (UUID)",
          "ingredientId": "string (UUID)",
          "quantity": "number",
          "ingredientUnitId": "string (UUID)",
          "ingredient": {
            "id": "string (UUID)",
            "name": "string"
          },
          "unit": {
            "id": "string (UUID)",
            "name": "string",
            "abbreviation": "string | null"
          },
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
      "id": "e956bcab-3176-46b0-ad1c-7cb0d0e12df1",
      "name": "Cappuccino Recipe",
      "description": "Original espresso and steamed milk ratio",
      "productVariantId": "v1a2r3i4-a5b6-7c8d-9e0f-1a2b3c4d5e6f",
      "ingredients": [
        {
          "id": "ri56b1ab-a5b6-7c8d-9e0f-1a2b3c4d5e6f",
          "recipeId": "e956bcab-3176-46b0-ad1c-7cb0d0e12df1",
          "ingredientId": "ing1b2c3-d4e5-6f7a-8b9c-0d1e2f3a4b5c",
          "quantity": 15,
          "ingredientUnitId": "u1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
          "ingredient": {
            "id": "ing1b2c3-d4e5-6f7a-8b9c-0d1e2f3a4b5c",
            "name": "Espresso Beans"
          },
          "unit": {
            "id": "u1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
            "name": "Grams",
            "abbreviation": "g"
          },
          "createdAt": "2026-06-07T14:00:00.000Z",
          "updatedAt": "2026-06-07T14:00:00.000Z",
          "deletedAt": null
        }
      ],
      "createdAt": "2026-06-07T14:00:00.000Z",
      "updatedAt": "2026-06-07T14:00:00.000Z",
      "deletedAt": null
    }
    ```

#### `POST /products/variants/:variantId/recipe`
*   **Description**: Creates a new recipe for a product variant, defining raw material ingredients and prep quantities.
*   **RBAC**: `create`
*   **Request Body**:
    *   `name` (string, required, min 2, max 100): Descriptive name of the recipe (e.g. "Latte Standard Recipe").
    *   `description` (string, optional): Notes on preparation.
    *   `ingredients` (array of objects, required, min 1):
        *   `ingredientId` (string, UUID, required): Raw ingredient profile.
        *   `quantity` (number, required, positive): Quantity needed.
        *   `ingredientUnitId` (string, UUID, required): Unit of measurement.
*   **Response (211 Created)**: Returns the fully populated recipe object with its ingredients array (similar to `GET`).

#### `PUT /products/variants/:variantId/recipe`
*   **Description**: Updates a recipe's profile and synchronizes (re-assigns/updates) its ingredients list inside a safe database transaction.
*   **RBAC**: `update`
*   **Request Body**:
    *   `name` (string, optional, min 2, max 100)
    *   `description` (string, optional)
    *   `ingredients` (array of objects, optional, min 1): If provided, it will completely replace all previous recipe ingredients with the new set.
*   **Response (200 OK)**: Returns the updated recipe object with its synchronized ingredients list.

#### `DELETE /products/variants/:variantId/recipe`
*   **Description**: Soft-deletes a recipe and all of its associated recipe ingredients.
*   **RBAC**: `delete`
*   **Response (200 OK)**:
    ```json
    {
      "message": "Recipe soft-deleted successfully"
    }
    ```
