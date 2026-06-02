# Frontend Integration Guide: Authentication

This guide details the integration endpoints available in the **Basta Kape API** for managing user login sessions, token refresh, registration, and logout.

---

## Access Control & Authorization

*   `POST /auth/login` and `POST /auth/register` are **public** (no token required).
*   `POST /auth/login` is **rate-limited** to 5 attempts per 5 minutes per IP.
*   `POST /auth/refresh` and `POST /auth/logout` are **public** but require a valid `refreshToken` in the request body.

---

## Endpoints Description

### 1. `POST /auth/login`
*   **Description**: Authenticates a user (Cashier, Barista, Admin, Owner, or Customer) and issues a JWT access token and refresh token pair.
*   **Rate Limit**: 5 attempts per 5-minute window. Returns `429 Too Many Requests` when exceeded.
*   **Request Body**:
    *   `identifier` (string, required): The user's email or username.
    *   `password` (string, required): The user's password.
*   **Response (200 OK)**:
    ```json
    {
        "accessToken": "eyJhbGciOi...",
        "refreshToken": "eyJhbGciOi...",
        "user": {
            "id": "user-uuid",
            "email": "user@example.com",
            "username": "username",
            "firstName": "John",
            "lastName": "Doe",
            "roles": [
                {
                    "name": "Administrator",
                    "permissions": [
                        {
                            "module": "Users Management",
                            "permission": "create",
                            "scope": "ALL"
                        }
                    ]
                }
            ]
        }
    }
    ```
*   **Error Responses**:
    *   `401 Unauthorized`: Invalid credentials.
*   **Integration Tip**: Save both `accessToken` and `refreshToken` securely on the client (e.g. inside httpOnly cookies or secure state). Attach the `accessToken` as an `Authorization: Bearer <accessToken>` header for subsequent authenticated requests. Use the `refreshToken` to obtain a new access token when the current one expires.

### 2. `POST /auth/register`
*   **Description**: Registers a new customer user profile and immediately returns signed tokens so the user is logged in after registration.
*   **Request Body**:
    *   `email` (string, required): Valid email address.
    *   `username` (string, required): Unique username (min 3 chars).
    *   `password` (string, required): Password (min 8 chars, must contain at least one uppercase letter and one number).
    *   `firstName` (string, required): First name of the customer.
    *   `middleName` (string, optional): Middle name of the customer.
    *   `lastName` (string, required): Last name of the customer.
    *   `phoneNumber` (string, optional): Phone or mobile number.
*   **Response (201 Created)**: Returns `accessToken`, `refreshToken`, and the created user object (with the automatically assigned `Customer` role).
*   **Error Responses**:
    *   `409 Conflict`: Email or username already in use.

### 3. `POST /auth/refresh`
*   **Description**: Exchanges a valid refresh token for a new access token. Use this when the current access token has expired.
*   **Request Body**:
    *   `refreshToken` (string, required): The refresh token issued during login or registration.
*   **Response (200 OK)**:
    ```json
    {
        "accessToken": "eyJhbGciOi..."
    }
    ```
*   **Error Responses**:
    *   `401 Unauthorized`: Refresh token is invalid, expired, or has been revoked.

### 4. `POST /auth/logout`
*   **Description**: Revokes a refresh token to end the user session.
*   **Request Body**:
    *   `refreshToken` (string, required): The refresh token to revoke.
*   **Response (200 OK)**:
    ```json
    {
        "success": true
    }
    ```
*   **Integration Tip**: Clear both the saved access token and refresh token from the client's store and redirect the user back to the login page.
