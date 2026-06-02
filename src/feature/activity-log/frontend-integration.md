# Frontend Integration Guide: Activity Logs

This guide details the integration endpoints available in the **Basta Kape API** for streaming operational audits, deactivations, and security logs.

---

## Access Control & Authorization

All endpoints in this module require JWT authentication via the `Authorization: Bearer <token>` header. Access is restricted using Role-Based Access Control (RBAC) under the **Activity Logs** module (`ACTIVITY_LOGS`).

---

## Endpoints Description

### 1. `GET /activity-logs`
*   **Description**: Retrieves a paginated list of all operational audit events, sorted in reverse chronological order (newest first). Used in the Owner Dashboard to audit system modifications.
*   **RBAC Permission Required**: `read` (module: `ACTIVITY_LOGS`)
*   **Query Parameters**:
    *   `page` (string, optional, default: `"1"`): Current page number.
    *   `limit` (string, optional, default: `"10"`): Items per page.
    *   `search` (string, optional): Matches on audit `title`, `details`, actor `firstName`, or actor `lastName`.
    *   `dateFrom` (string, optional): Filter logs created **on or after** this date/datetime string (e.g. `"2026-06-01"` or `"2026-06-01T00:00:00Z"`).
    *   `dateTo` (string, optional): Filter logs created **on or before** this date/datetime string.
*   **Response (200 OK)**:
    ```json
    {
        "data": [
            {
                "id": "log-uuid",
                "actorId": "user-uuid",
                "title": "Create Product",
                "details": "Successfully created product: Test Cappuccino (product-uuid).",
                "createdAt": "2026-06-02T12:00:00Z",
                "actor": {
                    "id": "user-uuid",
                    "firstName": "System",
                    "lastName": "Manager",
                    "email": "admin@bastakape.com"
                }
            }
        ],
        "meta": {
            "total": 120,
            "pageCount": 12,
            "count": 120,
            "currentPage": 1,
            "hasMore": true
        }
    }
    ```
