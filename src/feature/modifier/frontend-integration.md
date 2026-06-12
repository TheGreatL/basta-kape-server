# Frontend Integration Guide: Product Modifiers & Customizations

This guide details the integration endpoints available in the **Basta Kape API** for managing product customizations, including modifier groups, options, and recipes.

---

## Access Control & Authorization

All endpoints in this module require JWT authentication via the `Authorization: Bearer <token>` header. Access is restricted using Role-Based Access Control (RBAC) under the **Products Management** module (`Products Management`).

---

## Modifiers Configuration API

### 1. `GET /modifiers/groups`
*   **Description**: Retrieves a paginated list of modifier groups (e.g. "Sweetness Level", "Milk Alternatives").
*   **RBAC Permission Required**: `read` (module: `Products Management`)
*   **Query Parameters**:
    *   `page` (number, optional, default: `1`): Current page of the paginated list.
    *   `limit` (number, optional, default: `10`, max: `100`): Number of items per page.
    *   `search` (string, optional): Matches against the group's name.
    *   `productId` (string, optional, UUID): Filter groups connected to a specific product.
*   **Response (200 OK)**:
    ```json
    {
        "data": [
            {
                "id": "modg-milk-uuid",
                "name": "Milk Alternatives",
                "isRequired": false,
                "minSelect": 0,
                "maxSelect": 1,
                "createdAt": "2026-06-11T12:00:00.000Z",
                "updatedAt": "2026-06-11T12:00:00.000Z",
                "deletedAt": null,
                "options": [
                    {
                        "id": "modo-oat-milk-uuid",
                        "modifierGroupId": "modg-milk-uuid",
                        "name": "Oat Milk Add-on",
                        "price": 30.00,
                        "createdAt": "2026-06-11T12:00:00.000Z",
                        "updatedAt": "2026-06-11T12:00:00.000Z",
                        "deletedAt": null
                    }
                ],
                "products": [
                    {
                        "id": "prod-latte-uuid",
                        "name": "Café Latte"
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

### 2. `GET /modifiers/groups/:id`
*   **Description**: Retrieves a single modifier group details along with its options list and connected products.
*   **RBAC Permission Required**: `read` (module: `Products Management`)
*   **Response (200 OK)**: Same schema as single item inside data array above.

### 3. `POST /modifiers/groups`
*   **Description**: Creates a new modifier group configuration and optionally connects it to products.
*   **RBAC Permission Required**: `create` (module: `Products Management`)
*   **Request Body**:
    *   `name` (string, required): The modifier group name.
    *   `isRequired` (boolean, optional, default: `false`): If selections in this group are mandatory.
    *   `minSelect` (number, optional, default: `0`): Minimum options required.
    *   `maxSelect` (number, optional, default: `1`): Maximum options allowed.
    *   `productIds` (array of strings (UUID), optional): Array of product IDs to link to this group.
*   **Response (201 Created)**: Returns the newly created modifier group with connected products and options array.

### 4. `PUT /modifiers/groups/:id`
*   **Description**: Updates a modifier group and its connected product relations.
*   **RBAC Permission Required**: `update` (module: `Products Management`)
*   **Request Body**: Same schema as `POST /modifiers/groups`, all fields optional.
*   **Response (200 OK)**: Returns the fully updated modifier group object.

### 5. `DELETE /modifiers/groups/:id`
*   **Description**: Soft-deletes a modifier group configuration. This cascades and soft-deletes all options within the group.
*   **RBAC Permission Required**: `delete` (module: `Products Management`)
*   **Response (200 OK)**:
    ```json
    {
        "message": "Modifier group deleted successfully"
    }
    ```

---

## Modifier Options Choice API

### 6. `POST /modifiers/groups/:groupId/options`
*   **Description**: Creates and adds an option choice inside a modifier group (e.g. adding "Oat Milk Add-on" inside "Milk Alternatives").
*   **RBAC Permission Required**: `create` (module: `Products Management`)
*   **Request Body**:
    *   `name` (string, required): Option name.
    *   `price` (number, optional, default: `0`): Additional price adjustment for choosing this option.
*   **Response (201 Created)**: Returns the newly created modifier option object.

### 7. `PUT /modifiers/options/:id`
*   **Description**: Updates a modifier option's name or price.
*   **RBAC Permission Required**: `update` (module: `Products Management`)
*   **Request Body**: `name` (string, optional), `price` (number, optional).
*   **Response (200 OK)**: Returns the updated modifier option object.

### 8. `DELETE /modifiers/options/:id`
*   **Description**: Soft-deletes a modifier option choice.
*   **RBAC Permission Required**: `delete` (module: `Products Management`)
*   **Response (200 OK)**:
    ```json
    {
        "message": "Modifier option deleted successfully"
    }
    ```

---

## Modifier Option Recipe API

These endpoints allow linking modifier option selections directly to inventory deductions by associating them with a recipe list of ingredients (e.g. associating "Oat Milk Add-on" with "Barista Oat Milk - 220ml").

### 9. `GET /modifiers/options/:optionId/recipe`
*   **Description**: Retrieves the recipe associated with a modifier option.
*   **RBAC Permission Required**: `read` (module: `Products Management`)
*   **Response (200 OK)**:
    ```json
    {
        "id": "recipe-uuid-1",
        "name": "Oat Milk Modifier Recipe",
        "description": "220ml of oat milk for customization",
        "productVariantId": null,
        "modifierOptionId": "modo-oat-milk-uuid",
        "createdAt": "2026-06-11T12:00:00.000Z",
        "updatedAt": "2026-06-11T12:00:00.000Z",
        "deletedAt": null,
        "ingredients": [
            {
                "id": "recing-mod-oat-milk-0",
                "recipeId": "recipe-uuid-1",
                "ingredientId": "ing-oat-milk",
                "quantity": 220.0,
                "ingredientUnitId": "unit-milliliters",
                "createdAt": "2026-06-11T12:00:00.000Z",
                "updatedAt": "2026-06-11T12:00:00.000Z",
                "deletedAt": null,
                "ingredient": {
                    "id": "ing-oat-milk",
                    "name": "Barista Oat Milk"
                },
                "unit": {
                    "id": "unit-milliliters",
                    "name": "Milliliters",
                    "abbreviation": "ml"
                }
            }
        ]
    }
    ```

### 10. `POST /modifiers/options/:optionId/recipe`
*   **Description**: Configures a new recipe for a modifier option.
*   **RBAC Permission Required**: `create` (module: `Products Management`)
*   **Request Body**:
    *   `name` (string, required): Recipe name.
    *   `description` (string, optional): Recipe description.
    *   `ingredients` (array of objects, required):
        *   `ingredientId` (string (UUID), required): Ingredient ID.
        *   `quantity` (number, required, > 0): Amount required.
        *   `ingredientUnitId` (string (UUID), required): Ingredient unit ID.
*   **Response (201 Created)**: Returns the fully constructed recipe object with populated ingredients.

### 11. `PUT /modifiers/options/:optionId/recipe`
*   **Description**: Updates a recipe and completely syncs/re-seeds the recipe ingredients list.
*   **RBAC Permission Required**: `update` (module: `Products Management`)
*   **Request Body**: Same schema as `POST /modifiers/options/:optionId/recipe`, all fields optional.
*   **Response (200 OK)**: Returns the updated recipe object.

### 12. `DELETE /modifiers/options/:optionId/recipe`
*   **Description**: Soft-deletes a recipe for a modifier option.
*   **RBAC Permission Required**: `delete` (module: `Products Management`)
*   **Response (200 OK)**:
    ```json
    {
        "message": "Modifier option recipe soft-deleted successfully"
    }
    ```

### 13. `PATCH /modifiers/options/:optionId/recipe/restore`
*   **Description**: Restores a previously soft-deleted recipe for a modifier option.
*   **RBAC Permission Required**: `delete` (module: `Products Management`)
*   **Response (200 OK)**: Returns the restored recipe object.
