# Recipe Management (Bill of Materials) Integration

This guide details the integration endpoints available in the **Basta Kape API** for managing recipes (Bill of Materials). Recipes map product variants (e.g. Medium Cappuccino) or custom modifier options (e.g. Oat Milk alternative) to raw stock ingredients (e.g. Coffee Beans, Fresh Milk) and their required preparation quantities.

---

## Access Control & Authorization

All endpoints in this module require JWT authentication via the `Authorization: Bearer <token>` header. Access is restricted using Role-Based Access Control (RBAC) under the **Products Management** module (`PRODUCTS_MANAGEMENT`).

---

## Recipe Model Fields

The recipe object contains the following attributes:
*   `id` (string, UUID): Recipe identity.
*   `name` (string): Descriptive recipe title.
*   `description` (string, optional): Preparation or brewing notes.
*   `productVariantId` (string, UUID, optional): If this recipe is configured for a standard product variant. Null if configured for a modifier option instead.
*   `modifierOptionId` (string, UUID, optional): If this recipe is configured for a custom product modifier option. Null if configured for a standard variant instead.
*   `ingredients` (array of objects): List of measurement units, quantities, and raw ingredient IDs.

---

## Endpoints Description

### 1. Variant Recipes (`/products/variants/:variantId/recipe`)

All endpoints in this section are nested under standard product variants.

#### `GET /products/variants/:variantId/recipe`
*   **Description**: Retrieves the active recipe and ingredients required to prepare a specific product variant.
*   **RBAC**: `read`
*   **Response (200 OK)**:
    ```json
    {
      "id": "recipe-uuid-1",
      "name": "Cappuccino Recipe",
      "description": "Original espresso and steamed milk ratio",
      "productVariantId": "variant-uuid-1",
      "modifierOptionId": null,
      "createdAt": "2026-06-07T14:00:00.000Z",
      "updatedAt": "2026-06-07T14:00:00.000Z",
      "deletedAt": null,
      "ingredients": [
        {
          "id": "recing-uuid-1",
          "recipeId": "recipe-uuid-1",
          "ingredientId": "ing-beans",
          "quantity": 18,
          "ingredientUnitId": "unit-grams",
          "createdAt": "2026-06-07T14:00:00.000Z",
          "updatedAt": "2026-06-07T14:00:00.000Z",
          "deletedAt": null,
          "ingredient": {
            "id": "ing-beans",
            "name": "Espresso Blend Beans"
          },
          "unit": {
            "id": "unit-grams",
            "name": "Grams",
            "abbreviation": "g"
          }
        }
      ]
    }
    ```

#### `POST /products/variants/:variantId/recipe`
*   **Description**: Creates a new recipe for a product variant.
*   **RBAC**: `create`
*   **Request Body**:
    *   `name` (string, required, min 2, max 100): Descriptive recipe name.
    *   `description` (string, optional): Notes on preparation.
    *   `ingredients` (array of objects, required, min 1):
        *   `ingredientId` (string, UUID, required): Raw ingredient profile.
        *   `quantity` (number, required, positive): Quantity needed.
        *   `ingredientUnitId` (string, UUID, required): Unit of measurement.
*   **Response (201 Created)**: Returns the newly constructed variant recipe object.

#### `PUT /products/variants/:variantId/recipe`
*   **Description**: Updates a recipe's profile and synchronizes its ingredients list.
*   **RBAC**: `update`
*   **Request Body**: Similar to `POST`, all fields optional. If `ingredients` is provided, it completely replaces previous ingredients.
*   **Response (200 OK)**: Returns the updated variant recipe object.

#### `DELETE /products/variants/:variantId/recipe`
*   **Description**: Soft-deletes a variant recipe and its ingredients list.
*   **RBAC**: `delete`
*   **Response (200 OK)**:
    ```json
    {
      "message": "Recipe soft-deleted successfully"
    }
    ```

---

### 2. Modifier Option Recipes (`/modifiers/options/:optionId/recipe`)

All endpoints in this section are nested under modifier option choices. Please refer to the [Modifiers Integration Guide](file:///c:/Users/Christian%20Nicolas/Desktop/basta-kape/basta-kape-server/src/feature/modifier/frontend-integration.md) for full descriptions of option recipe endpoints:
*   `GET /modifiers/options/:optionId/recipe` — Retrieves the recipe for a modifier option.
*   `POST /modifiers/options/:optionId/recipe` — Configures a new recipe for a modifier option.
*   `PUT /modifiers/options/:optionId/recipe` — Updates and syncs the recipe ingredients list.
*   `DELETE /modifiers/options/:optionId/recipe` — Soft-deletes a modifier option recipe.
*   `PATCH /modifiers/options/:optionId/recipe/restore` — Restores a soft-deleted modifier option recipe.

