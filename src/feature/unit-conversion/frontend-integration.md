# Frontend Integration Guide: Unit Conversion & Multi-Unit Inventory

This document explains the Unit Conversion system introduced to support kitchen/recipe-friendly units (e.g. `tb`, `tsp`, `pump`, `shot`, `scoop`, `kg`, `L`) alongside standard base inventory units (`ml`, `g`, `pcs`).

---

## 1. Overview & Formula

Conversions define the ratio from one unit to another:
$$1 \text{ fromUnit} = \text{factor} \times \text{toUnit}$$

Example:

- $1 \text{ Tablespoon (tb)} = 4 \text{ Milliliters (ml)}$:
    - When a recipe asks for $5\text{ tb}$, it deducts $5 \times 4 = 20\text{ ml}$ from inventory stock.
    - When inventory has $1000\text{ ml}$, the stock level displays both $1000\text{ ml}$ and $250\text{ tb}$.

### Scopes:

- **Global**: `ingredientId: null` — applies anywhere these units are converted (e.g., $1\text{ L} = 1000\text{ ml}$, $1\text{ kg} = 1000\text{ g}$, $1\text{ tb} = 4\text{ ml}$).
- **Ingredient-Specific**: `ingredientId: "<id>"` — overrides global rules for a specific ingredient where density/volume differs (e.g. $1\text{ scoop Matcha Powder} = 15\text{ g}$, whereas $1\text{ scoop Protein} = 30\text{ g}$).

---

## 2. API Endpoints (`/api/unit-conversions`)

All endpoints require JWT Bearer token and permissions under module `Inventory Management`.

### 2.1 Get Paginated List of Conversions

- **Method**: `GET /api/unit-conversions`
- **Query Params**:
    - `page`: number (default: 1)
    - `limit`: number (default: 10)
    - `fromUnitId`: string (optional)
    - `toUnitId`: string (optional)
    - `ingredientId`: string (optional) — pass an ingredient ID, or `"global"` / `"null"` for global only, or omit for all
    - `search`: string (optional)
- **Response**:
    ```json
    {
        "data": [
            {
                "id": "conv-uuid",
                "fromUnitId": "unit-tb-uuid",
                "fromUnit": {
                    "id": "unit-tb-uuid",
                    "name": "Tablespoon",
                    "abbreviation": "tb"
                },
                "toUnitId": "unit-ml-uuid",
                "toUnit": {
                    "id": "unit-ml-uuid",
                    "name": "Milliliters",
                    "abbreviation": "ml"
                },
                "factor": 4.0,
                "ingredientId": null,
                "ingredient": null,
                "createdAt": "2026-09-20T13:00:00.000Z",
                "updatedAt": "2026-09-20T13:00:00.000Z"
            }
        ],
        "meta": {
            "total": 6,
            "pageCount": 1,
            "count": 6,
            "currentPage": 1,
            "hasMore": false
        }
    }
    ```

### 2.2 Calculate Conversion (`GET /api/unit-conversions/convert`)

Interactive calculator endpoint for POS, Recipe modal, or Inventory UI:

- **Method**: `GET /api/unit-conversions/convert`
- **Query Params**:
    - `fromUnitId`: string (required)
    - `toUnitId`: string (required)
    - `quantity`: number (required, > 0)
    - `ingredientId`: string (optional)
- **Response**:
    ```json
    {
        "fromUnitId": "unit-tb-uuid",
        "fromUnitName": "Tablespoon",
        "toUnitId": "unit-ml-uuid",
        "toUnitName": "Milliliters",
        "originalQuantity": 5,
        "convertedQuantity": 20,
        "factor": 4,
        "ingredientId": null,
        "ingredientName": null
    }
    ```

### 2.3 Create Unit Conversion (`POST /api/unit-conversions`)

- **Method**: `POST /api/unit-conversions`
- **Body**:
    ```json
    {
        "fromUnitId": "unit-tb-uuid",
        "toUnitId": "unit-ml-uuid",
        "factor": 4,
        "ingredientId": null
    }
    ```
- **Rules**:
    - `fromUnitId` cannot equal `toUnitId`.
    - `factor` must be greater than 0.
    - Returns `409 Conflict` if a conversion already exists between these units for the given scope.

### 2.4 Update Conversion (`PUT /api/unit-conversions/:id`)

- **Method**: `PUT /api/unit-conversions/:id`
- **Body**:
    ```json
    {
        "factor": 5
    }
    ```

### 2.5 Delete Conversion (`DELETE /api/unit-conversions/:id`)

- **Method**: `DELETE /api/unit-conversions/:id`
- **Response**:
    ```json
    {
        "message": "Unit conversion deleted successfully"
    }
    ```

---

## 3. Stock Level Response Enhancement (`GET /api/inventory/levels`)

The inventory levels response (`GET /api/inventory/levels` and `GET /api/inventory/levels/ingredient/:id`) now includes `convertedQuantities` in each item!

### Response Example:

```json
{
    "id": "inv-uuid",
    "ingredientId": "ing-uuid",
    "currentQuantity": 1000,
    "status": "SAFE",
    "ingredient": {
        "id": "ing-uuid",
        "name": "Fresh Milk",
        "reorderPoint": 2000,
        "defaultUnit": {
            "id": "unit-ml-uuid",
            "name": "Milliliters",
            "abbreviation": "ml"
        }
    },
    "convertedQuantities": [
        {
            "unitId": "unit-tb-uuid",
            "unitName": "Tablespoon",
            "unitAbbreviation": "tb",
            "quantity": 250
        },
        {
            "unitId": "unit-l-uuid",
            "unitName": "Liters",
            "unitAbbreviation": "L",
            "quantity": 1
        }
    ]
}
```

### UI Suggestion for Stock Status Table:

You can display the primary inventory stock and a secondary subtitle/badge:

> **Fresh Milk**  
> `1,000 ml` (Safe)  
> _Equivalent to: 250 tb • 1 L_

---

## 4. Impact on Recipes, Orders, and Food Prep

1. **Creating Recipes (`POST /api/products/variants/:id/recipe`)**:
    - Chefs/Baristas can select **any unit** configured in the system for a recipe ingredient (e.g. `2 tb`, `1 scoop`, `2 pumps`).
2. **Order Placement & Stock Deduction (`POST /api/orders`)**:
    - The backend automatically converts recipe quantities to the ingredient's base unit.
    - For example, ordering 2 cups of Coffee calling for `2 tb` of Syrup (where $1\text{ tb} = 4\text{ ml}$) automatically deducts $2 \times 2 \times 4 = 16\text{ ml}$ of syrup inventory.
3. **Menu Max Produceable (`GET /api/menu`)**:
    - `variant.maxProduceable` correctly takes into account unit conversions when comparing recipe requirement against on-hand inventory.
4. **Food Preparation Batches (`POST /api/food-prep/batches`)**:
    - Deducts converted raw ingredient quantities accurately.
