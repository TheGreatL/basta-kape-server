# Frontend Integration Guide: Customer Menu

This guide details the integration endpoints available in the **Basta Kape API** for rendering the customer-facing menu or point-of-sale catalog. It includes active categories, drink types, and detailed product variants with associated ingredient requirements (recipes).

---

## Access Control & Authorization

All endpoints in this module require JWT authentication via the `Authorization: Bearer <token>` header. Access is secured using Role-Based Access Control (RBAC) under the **Menu** module (`MENU`).

---

## Endpoints Description

### 1. `GET /menu`

- **Description**: Retrieves a paginated catalog list of all active products for the customer menu, complete with categories, product types, and available pricing variants.
- **RBAC Permission Required**: `read` (module: `MENU`)
- **Query Parameters**:
    - `page` (number, optional, default: `1`): Current catalog page.
    - `limit` (number, optional, default: `10`, max: `100`): Items per page.
    - `search` (string, optional): Matches on product name or description.
    - `productCategoryId` (string, UUID, optional): Filter products by category.
    - `productTypeId` (string, UUID, optional): Filter products by product type (Food/Beverage).
- **Response (200 OK)**:
    ```json
    {
        "data": [
            {
                "id": "product-uuid-1",
                "name": "Spanish Latte",
                "photo": "https://api.bastakape.com/uploads/spanish-latte.jpg",
                "description": "Espresso with sweetened condensed milk and fresh milk.",
                "productCategoryId": "category-uuid-1",
                "productTypeId": "type-uuid-1",
                "category": {
                    "id": "category-uuid-1",
                    "name": "Espresso",
                    "description": "Classic and flavored espresso-based coffee drinks."
                },
                "type": {
                    "id": "type-uuid-1",
                    "name": "Beverage",
                    "description": "Drink products served to customers."
                },
                "variants": [
                    {
                        "id": "variant-uuid-1",
                        "productId": "product-uuid-1",
                        "sku": "SPANISH-LATTE-HOT-12OZ",
                        "price": 130.0,
                        "maxProduceable": 50,
                        "attributes": [
                            {
                                "id": "variant-attribute-uuid-1",
                                "productAttributeValueId": "attr-val-uuid-1",
                                "attributeValue": {
                                    "id": "attr-val-uuid-1",
                                    "productAttributeId": "attr-parent-uuid-1",
                                    "value": "Hot",
                                    "attribute": {
                                        "id": "attr-parent-uuid-1",
                                        "name": "Temperature"
                                    }
                                }
                            }
                        ]
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

- **Description**: Retrieves the complete details of a single product on the menu using its Product ID, containing badges, category, type, and detailed active variants with recipe ingredient requirements.
- **RBAC Permission Required**: `read` (module: `MENU`)

### 3. `GET /menu/categories`

- **Description**: Retrieves an unpaginated list of all active product categories. Supports optional filtering by `productTypeId`.
- **RBAC Permission Required**: `read` (module: `MENU`)
- **Query Parameters**:
    - `productTypeId` (string, UUID, optional): Filter categories belonging to a specific product type (e.g. only Food categories).
- **Response (200 OK)**:
    ```json
    [
        {
            "id": "category-uuid-1",
            "name": "Espresso",
            "description": "Classic and flavored espresso-based coffee drinks.",
            "productTypeId": "type-beverage-uuid",
            "type": {
                "id": "type-beverage-uuid",
                "name": "Beverage"
            }
        },
        {
            "id": "category-uuid-2",
            "name": "Waffles",
            "description": "Freshly baked golden waffle creations.",
            "productTypeId": "type-food-uuid",
            "type": {
                "id": "type-food-uuid",
                "name": "Food"
            }
        }
    ]
    ```

### 4. `GET /menu/types`

- **Description**: Retrieves an unpaginated list of all active product types (`Beverage`, `Food`), complete with nested active child **`categories`** for fast multi-level navigation rendering.
- **RBAC Permission Required**: `read` (module: `MENU`)
- **Response (200 OK)**:
    ```json
    [
        {
            "id": "type-beverage-uuid",
            "name": "Beverage",
            "description": "Drink products served to customers.",
            "categories": [
                { "id": "cat-1", "name": "Espresso", "description": "Espresso-based drinks" },
                { "id": "cat-2", "name": "Creamy Coffee", "description": "Creamy specialty drinks" },
                { "id": "cat-3", "name": "Oat Based", "description": "Oatmilk beverages" },
                { "id": "cat-4", "name": "Matcha Series", "description": "Japanese green tea matcha" },
                { "id": "cat-5", "name": "Non-Coffee", "description": "Milk, tsokolate, sodas" },
                { "id": "cat-6", "name": "Blended Coffee Drinks", "description": "Ice blended coffee" },
                { "id": "cat-7", "name": "Blended Non-Coffee Drinks", "description": "Ice blended cream" }
            ]
        },
        {
            "id": "type-food-uuid",
            "name": "Food",
            "description": "Food, snacks, and pastry items served to customers.",
            "categories": [
                { "id": "cat-8", "name": "Waffles", "description": "Waffle creations" },
                { "id": "cat-9", "name": "Pasta", "description": "Savory pasta dishes" },
                { "id": "cat-10", "name": "Snacks", "description": "Finger foods and snack platters" },
                { "id": "cat-11", "name": "Cookies", "description": "Artisanal baked cookies" }
            ]
        }
    ]
    ```
