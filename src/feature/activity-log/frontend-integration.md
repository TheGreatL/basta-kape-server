# Frontend Integration Guide: Activity Logs

This guide details the integration endpoints available in the **Basta Kape API** for streaming operational audits, deactivations, and security logs.

---

## Endpoints Description

### 1. `GET /activity-logs`
*   **Description**: Retrieves a paginated list of all operational audit events, sorted in reverse chronological order (newest first). Used in the Owner Dashboard to audit system modifications.
*   **Query Parameters**:
    *   `page` (number, optional, default: 1): Current page.
    *   `limit` (number, optional, default: 10): Items per page.
    *   `search` (string, optional): Matches on audit title, details, or performer's username.
    *   `dateFrom` (string, optional): Filter logs starting from this ISO date/string.
    *   `dateTo` (string, optional): Filter logs up to this ISO date/string.
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
                    "username": "adminUser",
                    "firstName": "System",
                    "lastName": "Manager"
                }
            }
        ],
        "meta": {
            "total": 120,
            "pageCount": 12,
            "count": 10,
            "currentPage": 1,
            "hasMore": true
        }
    }
    ```
