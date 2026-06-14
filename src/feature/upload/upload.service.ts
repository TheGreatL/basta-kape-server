import { LocalStorageService } from '@/lib/storage/local-storage.service';
import { R2StorageService } from '@/lib/storage/r2-storage.service';
import { IStorageService } from '@/lib/storage/storage.interface';
import { BadRequestException } from '@/exceptions';
import { env } from '@/env';

export class UploadService {
    private storageService: IStorageService;

    constructor(storageService?: IStorageService) {
        if (storageService) {
            this.storageService = storageService;
        } else {
            this.storageService = env.STORAGE_PROVIDER === 'r2' ? new R2StorageService() : new LocalStorageService();
        }
    }

    /**
     * Upload an image file. Validates that it is an image and <= 5MB.
     */
    async uploadImage(file: Express.Multer.File): Promise<{ url: string }> {
        if (!file) {
            throw new BadRequestException('No file provided');
        }

        // Validate MIME type
        if (!file.mimetype.startsWith('image/')) {
            throw new BadRequestException('Only image files are allowed');
        }

        // Validate size (5MB = 5 * 1024 * 1024)
        if (file.size > 5 * 1024 * 1024) {
            throw new BadRequestException('Image size must be less than 5MB');
        }

        const url = await this.storageService.uploadFile(file, 'images');
        return { url };
    }

    /**
     * Upload a generic document/file. Validates size <= 5MB.
     */
    async uploadDocument(file: Express.Multer.File): Promise<{ url: string }> {
        if (!file) {
            throw new BadRequestException('No file provided');
        }

        // Validate size (5MB = 5 * 1024 * 1024)
        if (file.size > 5 * 1024 * 1024) {
            throw new BadRequestException('File size must be less than 5MB');
        }

        const url = await this.storageService.uploadFile(file, 'documents');
        return { url };
    }
}
