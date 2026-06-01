export interface IStorageService {
    /**
     * Uploads a file to the storage provider.
     * @param file The file buffer or stream to upload.
     * @param folder The target folder (e.g., 'images', 'documents').
     * @param originalName The original name of the file.
     * @returns The public URL or path of the uploaded file.
     */
    uploadFile(file: Express.Multer.File, folder: string): Promise<string>;

    /**
     * Deletes a file from the storage provider.
     * @param path The path or URL of the file to delete.
     */
    deleteFile(path: string): Promise<void>;
}
