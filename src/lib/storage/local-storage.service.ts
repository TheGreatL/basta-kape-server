import fs from 'fs';
import path from 'path';
import { IStorageService } from './storage.interface';
import { randomUUID } from 'crypto';

export class LocalStorageService implements IStorageService {
    private readonly uploadRoot: string;

    constructor() {
        // Points to the /uploads directory at the root of the project
        this.uploadRoot = path.resolve(process.cwd(), 'uploads');
        this.ensureDirectoryExists(this.uploadRoot);
    }

    private ensureDirectoryExists(dir: string) {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }

    async uploadFile(file: Express.Multer.File, folder: string): Promise<string> {
        const folderPath = path.join(this.uploadRoot, folder);
        this.ensureDirectoryExists(folderPath);

        const fileExtension = path.extname(file.originalname);
        const fileName = `${randomUUID()}${fileExtension}`;
        const targetPath = path.join(folderPath, fileName);

        // Write the file buffer to the local filesystem
        await fs.promises.writeFile(targetPath, file.buffer);

        // Return a relative path that can be used via the static server
        return `/uploads/${folder}/${fileName}`;
    }

    async deleteFile(filePath: string): Promise<void> {
        // Convert the URL/relative path back to an absolute local path
        // e.g., /uploads/images/abc.png -> C:/.../uploads/images/abc.png
        const normalizedPath = filePath.replace(/^\/uploads\//, '');
        const targetPath = path.join(this.uploadRoot, normalizedPath);

        if (fs.existsSync(targetPath)) {
            await fs.promises.unlink(targetPath);
        }
    }
}
