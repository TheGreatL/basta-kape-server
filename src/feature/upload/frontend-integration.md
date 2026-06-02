# Frontend Integration Guide: File Uploads

This guide details the integration endpoints available in the **Basta Kape API** for uploading file attachments, product photos, and staff avatars.

---

## Access Control & Authorization

All endpoints in this module require JWT authentication via the `Authorization: Bearer <token>` header. Any authenticated user can upload files.

---

## Endpoints Description

### 1. `POST /upload/image`
*   **Description**: Receives a raw image payload via multi-part form upload, validates that the file type is an image and does not exceed 5MB, saves it to a persistent local repository, and returns a public URL link to access the asset.
*   **Request Content Type**: `multipart/form-data`
*   **Form Parameters**:
    *   `file` (binary, required): The target image file (e.g. jpeg, png, webp, gif) to be uploaded. Max size 5MB.
*   **Response (200 OK)**:
    ```json
    {
        "url": "http://localhost:5000/uploads/images/file-1717329600000.png"
    }
    ```
*   **Integration Tip**: When creating or updating a Product (using product photos) or a User (using avatars), invoke this upload endpoint first. Capture the returned `url` string and feed it as the value of the `photo` or `profilePhoto` fields in subsequent request payloads.

### 2. `POST /upload/document`
*   **Description**: Receives a generic file/document payload via multi-part form upload, validates that the file size does not exceed 5MB, saves it to a persistent local repository, and returns a public URL link to access the asset.
*   **Request Content Type**: `multipart/form-data`
*   **Form Parameters**:
    *   `file` (binary, required): The target document file (e.g. pdf, csv, docx) to be uploaded. Max size 5MB.
*   **Response (200 OK)**:
    ```json
    {
        "url": "http://localhost:5000/uploads/documents/file-1717329600000.pdf"
    }
    ```
