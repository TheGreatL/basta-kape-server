# Frontend Integration Guide: Customers & Cart Management

This guide details the integration endpoints available in the **Basta Kape API** for managing customer profiles and their shopping cart items.

---

## Access Control & Authorization

All endpoints in this module require JWT authentication via the `Authorization: Bearer <token>` header. Access is restricted using Role-Based Access Control (RBAC) under the **Customers Management** module (`Customers Management`).

---

## Endpoints Description

### 1. `GET /customers`
*   **Description**: Retrieves a paginated, searchable list of customers.
*   **RBAC Permission Required**: `read` (module: `Customers Management`)
*   **Query Parameters**:
    *   `page` (number, optional, default: `1`): Current page of the paginated list.
    *   `limit` (number, optional, default: `10`, max: `100`): Number of customers per page.
    *   `search` (string, optional): Matches against the customer's email, username, first name, last name, or phone number.
    *   `status` (enum: `"active" | "archive"`, optional, default: `"active"`): Filter for active customers or soft-deleted (archived) ones.
*   **Response (200 OK)**:
    ```json
    {
        "data": [
            {
                "id": "customer-uuid-1",
                "userId": "user-uuid-1",
                "createdAt": "2026-06-07T02:00:00.000Z",
                "updatedAt": "2026-06-07T02:00:00.000Z",
                "deletedAt": null,
                "user": {
                    "id": "user-uuid-1",
                    "email": "customer@bastakape.com",
                    "username": "customerUser",
                    "firstName": "Charlie",
                    "middleName": null,
                    "lastName": "Customer",
                    "phoneNumber": "+639170000000",
                    "profilePhoto": null,
                    "createdAt": "2026-06-07T02:00:00.000Z",
                    "updatedAt": "2026-06-07T02:00:00.000Z",
                    "deletedAt": null
                }
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

### 2. `GET /customers/:id`
*   **Description**: Retrieves the details of a single customer profile by its unique ID.
*   **RBAC Permission Required**: `read` (module: `Customers Management`)
*   **Response (200 OK)**:
    ```json
    {
        "id": "customer-uuid-1",
        "userId": "user-uuid-1",
        "createdAt": "2026-06-07T02:00:00.000Z",
        "updatedAt": "2026-06-07T02:00:00.000Z",
        "deletedAt": null,
        "user": {
            "id": "user-uuid-1",
            "email": "customer@bastakape.com",
            "username": "customerUser",
            "firstName": "Charlie",
            "middleName": null,
            "lastName": "Customer",
            "phoneNumber": "+639170000000",
            "profilePhoto": null,
            "createdAt": "2026-06-07T02:00:00.000Z",
            "updatedAt": "2026-06-07T02:00:00.000Z",
            "deletedAt": null
        }
    }
    ```

### 3. `POST /customers`
*   **Description**: Creates a new customer account and customer profile.
*   **RBAC Permission Required**: `create` (module: `Customers Management`)
*   **Request Body**:
    *   `email` (string, required): Unique email address of the customer.
    *   `username` (string, required, min 3, max 50): Unique username.
    *   `password` (string, optional, min 8, must contain at least 1 uppercase letter and 1 number): Account password. Defaults to a standard secure placeholder (`WelcomeCustomer123!`) if not provided.
    *   `firstName` (string, required, min 2): Customer's first name.
    *   `lastName` (string, required, min 2): Customer's last name.
    *   `middleName` (string, optional): Customer's middle name.
    *   `phoneNumber` (string, optional): Contact phone number.
*   **Response (201 Created)**: Returns the newly created customer profile object.

### 4. `PUT /customers/:id`
*   **Description**: Updates an existing customer's account/profile details.
*   **RBAC Permission Required**: `update` (module: `Customers Management`)
*   **Request Body**: Similar to `POST /customers` body, but all fields are optional.
*   **Response (200 OK)**: Returns the fully updated customer profile object.

### 5. `DELETE /customers/:id`
*   **Description**: Soft-deletes a customer profile and their associated user account.
*   **RBAC Permission Required**: `delete` (module: `Customers Management`)
*   **Response (200 OK)**:
    ```json
    {
        "message": "Customer soft-deleted successfully"
    }
    ```

---

## Cart Operations (Sub-Resource)

These endpoints allow the customer to manage items in their shopping cart. All cart paths are prefixed with `/customers/:id/cart`.

### 6. `GET /customers/:id/cart`
*   **Description**: Retrieves all active items in the customer's cart along with the computed cart total.
*   **RBAC Permission Required**: `read` (module: `Customers Management`)
*   **Response (200 OK)**:
    ```json
    {
        "items": [
            {
                "id": "cart-item-uuid-1",
                "customerId": "customer-uuid-1",
                "quantity": 2,
                "unitPrice": 120.0,
                "productVariantId": "variant-uuid-1",
                "createdAt": "2026-06-07T02:05:00.000Z",
                "updatedAt": "2026-06-07T02:05:00.000Z",
                "deletedAt": null,
                "productVariant": {
                    "id": "variant-uuid-1",
                    "sku": "VAR-LATTE-LRG",
                    "price": 120.0,
                    "product": {
                        "id": "product-uuid-1",
                        "name": "Cafe Latte",
                        "photo": "http://example.com/photo.jpg",
                        "description": "Rich espresso with steamed milk and foam",
                        "category": {
                            "id": "category-uuid-1",
                            "name": "Hot Coffee"
                        },
                        "type": {
                            "id": "type-uuid-1",
                            "name": "Beverage"
                        }
                    },
                    "attributes": [
                        {
                            "id": "variant-attr-uuid-1",
                            "attributeValue": {
                                "id": "attr-val-uuid-1",
                                "value": "Large",
                                "attribute": {
                                    "id": "attr-uuid-1",
                                    "name": "Size"
                                }
                            }
                        }
                    ]
                }
            }
        ],
        "totalAmount": 240.0
    }
    ```

### 7. `POST /customers/:id/cart`
*   **Description**: Adds a product variant to the customer's cart. If the variant is already present in the cart, it increments the existing quantity. If the item was previously removed (soft-deleted), it restores the item.
*   **RBAC Permission Required**: `update` (module: `Customers Management`)
*   **Request Body**:
    *   `productVariantId` (string, required, UUID): The product variant ID to add.
    *   `quantity` (number, required, integer, min 1): Quantity of the item to add.
*   **Response (201 Created)**: Returns the added/updated cart item object with populated details.

### 8. `PUT /customers/:id/cart/:cartItemId`
*   **Description**: Updates the quantity of a specific item in the customer's cart.
*   **RBAC Permission Required**: `update` (module: `Customers Management`)
*   **Request Body**:
    *   `quantity` (number, required, integer, min 1): New absolute quantity.
*   **Response (200 OK)**: Returns the fully updated cart item object.

### 9. `DELETE /customers/:id/cart/:cartItemId`
*   **Description**: Removes a specific item from the customer's cart (soft-deletes the item).
*   **RBAC Permission Required**: `update` (module: `Customers Management`)
*   **Response (200 OK)**:
    ```json
    {
        "message": "Cart item removed successfully"
    }
    ```

### 10. `DELETE /customers/:id/cart`
*   **Description**: Clears all items from the customer's cart (soft-deletes all items).
*   **RBAC Permission Required**: `update` (module: `Customers Management`)
*   **Response (200 OK)**:
    ```json
    {
        "message": "Cart cleared successfully"
    }
    ```
