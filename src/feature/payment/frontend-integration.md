# Frontend Integration Guide: Digital & Cash Payments (`OrderPayment`)

This guide details the integration endpoints available in the **Basta Kape API** for recording and processing cash and digital payments (GCash, PayMaya, Credit Card) for orders.

---

## Access Control & Authorization

All endpoints in this module require JWT authentication via the `Authorization: Bearer <token>` header. Access is restricted using Role-Based Access Control (RBAC):
- **Process Payment**: Requires `create` permission under the **Point of Sale (POS)** module (`Point of Sale (POS)`).
- **Retrieve Payments**: Requires `read` permission under the **Orders Management** module (`Orders Management`).

---

## Endpoints Description

### 1. `POST /orders/:orderId/payments`
*   **Description**: Processes and records a payment for a specific order. If successful and the order status is `PENDING`, the order status will transition to `PREPARING`.
*   **RBAC Permission Required**: `create` (module: `Point of Sale (POS)`)
*   **Request Body**:
    *   This endpoint accepts a payload matching one of the following payment methods:
    
    #### Cash Payment:
    *   `paymentMethod` (string, literal: `"CASH"`): Must be `"CASH"`.
    *   `amountTendered` (number, required, >= 0): The total cash amount handed over by the customer. Must be greater than or equal to the order's `netTotal`.
    
    ```json
    {
        "paymentMethod": "CASH",
        "amountTendered": 200.00
    }
    ```

    #### GCash / Digital Payment:
    *   `paymentMethod` (string, literal: `"GCASH"`, `"PAYMAYA"`, or `"CREDIT_CARD"`): The payment method name.
    *   `gcashReferenceNumber` (string, required, min 5 chars): The digital receipt reference number printed or shown on screens.
    *   `paymentProofPhoto` (string, optional): A URL or image file path of the transaction screenshot.
    
    ```json
    {
        "paymentMethod": "GCASH",
        "gcashReferenceNumber": "9012345678901",
        "paymentProofPhoto": "/uploads/proofs/gcash-screenshot.jpg"
    }
    ```

*   **Response (201 Created)**:
    ```json
    {
        "id": "payment-uuid-1",
        "orderId": "order-uuid-abc",
        "paymentMethod": "CASH",
        "paymentStatus": "PAID",
        "amount": 134.40,
        "gcashReferenceNumber": null,
        "paymentProofPhoto": null,
        "amountTendered": 200.00,
        "amountChange": 15.60,
        "createdAt": "2026-06-12T10:48:00.000Z",
        "updatedAt": "2026-06-12T10:48:00.000Z"
    }
    ```
*   **Error Responses**:
    *   **400 Bad Request**: If `amountTendered` is less than `netTotal`, reference number is missing, or the cashier has no active register shift.
        ```json
        {
            "statusCode": 400,
            "message": "Amount tendered (PHP 100.00) must be greater than or equal to the net total (PHP 134.40)."
        }
        ```
    *   **404 Not Found**: If the order ID does not exist:
        ```json
        {
            "statusCode": 404,
            "message": "Order not found"
        }
        ```
    *   **409 Conflict**: If the order has already been paid:
        ```json
        {
            "statusCode": 409,
            "message": "Order has already been paid."
        }
        ```

---

### 2. `GET /orders/:orderId/payments`
*   **Description**: Retrieves a list of all payments recorded for a specific order.
*   **RBAC Permission Required**: `read` (module: `Orders Management`)
*   **Response (200 OK)**:
    ```json
    [
        {
            "id": "payment-uuid-1",
            "orderId": "order-uuid-abc",
            "paymentMethod": "CASH",
            "paymentStatus": "PAID",
            "amount": 134.40,
            "gcashReferenceNumber": null,
            "paymentProofPhoto": null,
            "amountTendered": 200.00,
            "amountChange": 15.60,
            "createdAt": "2026-06-12T10:48:00.000Z",
            "updatedAt": "2026-06-12T10:48:00.000Z"
        }
    ]
    ```
*   **Error Responses**:
    *   **404 Not Found**: If the order ID does not exist:
        ```json
        {
            "statusCode": 404,
            "message": "Order not found"
        }
        ```

---

## POS Integration Tips

1. **Active Register Drawer session**: Check that `GET /register-shifts/active` is successful before showing the Cash payment dialog. If no shift is open, prevent payment processing and display the "Open Cash Drawer" modal.
2. **Cash Change Math**: Calculate the change due live in the UI (`amountTendered - netTotal`) to give visual feedback to the cashier as they type.
3. **Receipt Validation**: For digital payments like GCash, validate reference number formatting (minimum length check) on client-side before sending the request.
