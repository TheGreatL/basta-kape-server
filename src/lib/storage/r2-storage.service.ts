import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { IStorageService } from './storage.interface';
import { env } from '@/env';
import { randomUUID } from 'crypto';
import path from 'path';

export class R2StorageService implements IStorageService {
    private s3Client: S3Client;
    private bucketName: string;
    private publicUrl: string;

    constructor() {
        this.bucketName = env.R2_BUCKET_NAME!;
        // Remove trailing slash if present
        this.publicUrl = env.R2_PUBLIC_URL!.replace(/\/$/, '');

        this.s3Client = new S3Client({
            region: 'auto',
            endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
            credentials: {
                accessKeyId: env.R2_ACCESS_KEY_ID!,
                secretAccessKey: env.R2_SECRET_ACCESS_KEY!
            }
        });
    }

    async uploadFile(file: Express.Multer.File, folder: string): Promise<string> {
        const fileExtension = path.extname(file.originalname);
        const fileName = `${randomUUID()}${fileExtension}`;
        const key = `${folder}/${fileName}`;

        await this.s3Client.send(
            new PutObjectCommand({
                Bucket: this.bucketName,
                Key: key,
                Body: file.buffer,
                ContentType: file.mimetype
            })
        );

        return `${key}`;
    }

    async deleteFile(fileUrl: string): Promise<void> {
        // Only attempt deletion if the URL belongs to our R2 bucket
        if (!fileUrl.startsWith(this.publicUrl)) {
            return;
        }

        const key = fileUrl.replace(`${this.publicUrl}/`, '');

        await this.s3Client.send(
            new DeleteObjectCommand({
                Bucket: this.bucketName,
                Key: key
            })
        );
    }
}
