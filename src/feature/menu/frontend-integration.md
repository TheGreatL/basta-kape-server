# Frontend Integration Guide: Customer Menu

This guide details the integration endpoints available in the **Basta Kape API** for rendering the customer-facing menu or point-of-sale catalog. It includes active categories, drink types, and detailed product variants with associated ingredient requirements (recipes).

---

## Access Control & Authorization

All endpoints in this module require JWT authentication via the `Authorization: Bearer <token>` header. Access is secured using Role-Based Access Control (RBAC) under the **Menu** module (`MENU`).

---

## Endpoints Description

### 1. `GET /menu`
*   **Description**: Retrieves a paginated catalog list of all active products for the customer menu, complete with categories, product types, and available pricing variants.
*   **RBAC Permission Required**: `read` (module: `MENU`)
*   **Query Parameters**:
    *   `page` (number, optional, default: `1`): Current catalog page.
    *   `limit` (number, optional, default: `10`, max: `100`): Items per page.
    *   `search` (string, optional): Matches on product name or description.
    *   `productCategoryId` (string, UUID, optional): Filter products by category.
    *   `productTypeId` (string, UUID, optional): Filter products by product type.
*   **Response (200 OK)**:
    ```json
    {
        "data": [
            {
                "id": "product-uuid-1",
                "name": "Iced Caramel Macchiato",
                "photo": "https://api.bastakape.com/uploads/caramel-macchiato.jpg",
                "description": "Espresso with milk, vanilla syrup, and rich caramel drizzle.",
                "productCategoryId": "category-uuid-1",
                "productTypeId": "type-uuid-1",
                "category": {
                    "id": "category-uuid-1",
                    "name": "Espresso Drinks",
                    "description": "Classic and custom espresso-based creations."
                },
                "type": {
                    "id": "type-uuid-1",
                    "name": "Cold Drinks",
                    "description": "Iced and blended beverage catalog."
                },
                "variants": [
                    {
                        "id": "variant-uuid-1",
                        "productId": "product-uuid-1",
                        "sku": "MAC-ICE-LRG",
                        "price": 165.00,
                        "attributes": [
                            {
                                "id": "variant-attribute-uuid-1",
                                "productAttributeValueId": "attr-val-uuid-1",
                                "attributeValue": {
                                    "id": "attr-val-uuid-1",
                                    "productAttributeId": "attr-parent-uuid-1",
                                    "value": "Large",
                                    "attribute": {
                                        "id": "attr-parent-uuid-1",
                                        "name": "Size"
                                    }
                                }
                            }
                        ],
                        "recipe": {
                            "id": "recipe-uuid-1",
                            "name": "Large Iced Macchiato Recipe",
                            "description": "Standard build for 22oz iced caramel macchiato.",
                            "ingredients": [
                                {
                                    "id": "recipe-ing-uuid-1",
                                    "ingredientId": "ing-espresso-uuid",
                                    "quantity": 2.0,
                                    "ingredient": {
                                        "id": "ing-espresso-uuid",
                                        "name": "Espresso Shots"
                                    },
                                    "unit": {
                                        "id": "unit-shot-uuid",
                                        "name": "Shot",
                                        "abbreviation": "shot"
                                    }
                                }
                            ]
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

### 2. `GET /menu/:id`
*   **Description**: Retrieves the complete details of a single product on the menu using its Product ID, containing the full product, category, type, and detailed active variants with recipe ingredient requirements.
*   **RBAC Permission Required**: `read` (module: `MENU`)
*   **Response (200 OK)**:
    ```json
    {
        "id": "product-uuid-1",
        "name": "Iced Caramel Macchiato",
        "photo": "https://api.bastakape.com/uploads/caramel-macchiato.jpg",
        "description": "Espresso with milk, vanilla syrup, and rich caramel drizzle.",
        "productCategoryId": "category-uuid-1",
        "productTypeId": "type-uuid-1",
        "category": {
            "id": "category-uuid-1",
            "name": "Espresso Drinks",
            "description": "Classic and custom espresso-based creations."
        },
        "type": {
            "id": "type-uuid-1",
            "name": "Cold Drinks",
            "description": "Iced and blended beverage catalog."
        },
        "variants": [
            {
                "id": "variant-uuid-1",
                "productId": "product-uuid-1",
                "sku": "MAC-ICE-LRG",
                "price": 165.00,
                "attributes": [
                    {
                        "id": "variant-attribute-uuid-1",
                        "productAttributeValueId": "attr-val-uuid-1",
                        "attributeValue": {
                            "id": "attr-val-uuid-1",
                            "productAttributeId": "attr-parent-uuid-1",
                            "value": "Large",
                            "attribute": {
                                "id": "attr-parent-uuid-1",
                                "name": "Size"
                            }
                        }
                    }
                ],
                "recipe": {
                    "id": "recipe-uuid-1",
                    "name": "Large Iced Macchiato Recipe",
                    "description": "Standard build for 22oz iced caramel macchiato.",
                    "ingredients": [
                        {
                            "id": "recipe-ing-uuid-1",
                            "ingredientId": "ing-espresso-uuid",
                            "quantity": 2.0,
                            "ingredient": {
                                "id": "ing-espresso-uuid",
                                "name": "Espresso Shots"
                            },
                            "unit": {
                                "id": "unit-shot-uuid",
                                "name": "Shot",
                                "abbreviation": "shot"
                            }
                        }
                    ]
                }
            }
        ]
    }
    ```
*   **Error Responses**:
    *   `404 Not Found`: If the product does not exist, is soft-deleted, or has no active status.

### 3. `GET /menu/categories`
*   **Description**: Retrieves an unpaginated list of all active product categories. This is extremely useful for generating filter tabs or navigation categories in the menu dashboard.
*   **RBAC Permission Required**: `read` (module: `MENU`)
*   **Response (200 OK)**:
    ```json
    [
        {
            "id": "category-uuid-1",
            "name": "Espresso Drinks",
            "description": "Classic and custom espresso-based creations."
        },
        {
            "id": "category-uuid-2",
            "name": "Non-Coffee Beverages",
            "description": "Teas, matcha, chocolates, and refreshers."
        }
    ]
    ```

### 4. `GET /menu/types`
*   **Description**: Retrieves an unpaginated list of all active product types (e.g. Hot Drinks, Cold Drinks). Use this to render quick temperature or prep-type filters on the client.
*   **RBAC Permission Required**: `read` (module: `MENU`)
*   **Response (200 OK)**:
    ```json
    [
        {
            "id": "type-uuid-1",
            "name": "Cold Drinks",
            "description": "Iced and blended beverage catalog."
        },
        {
            "id": "type-uuid-2",
            "name": "Hot Drinks",
            "description": "Classic warm brewed options."
        }
    ]
    ```
