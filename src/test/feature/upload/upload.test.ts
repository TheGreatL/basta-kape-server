import { vi, describe, it, expect, beforeAll } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

vi.mock('@/middleware/rbac.middleware', () => ({
    authenticate: vi.fn((req: Request, res: Response, next: NextFunction) => {
        req.user = {
            sub: 'test-upload-user-id',
            email: 'uploadtest@example.com',
            username: 'uploadtestuser',
            roles: ['Administrator']
        };
        next();
    }),
    requireAccess: vi.fn(() => (req: Request, res: Response, next: NextFunction) => {
        req.user = {
            sub: 'test-upload-user-id',
            email: 'uploadtest@example.com',
            username: 'uploadtestuser',
            roles: ['Administrator']
        };
        next();
    })
}));

// Mock storage service to avoid disk/cloud writes during tests
vi.mock('@/lib/storage/local-storage.service', () => ({
    LocalStorageService: class {
        uploadFile = vi.fn().mockResolvedValue('https://example.com/uploads/images/sample-test.png');
        deleteFile = vi.fn().mockResolvedValue(true);
    }
}));

import request from 'supertest';
import express from 'express';
import uploadRouter from '@/feature/upload/upload.route';
import { HttpException } from '@/exceptions/http.exception';

describe('Upload Feature Integration Tests', () => {
    let app: express.Application;

    beforeAll(() => {
        app = express();
        app.use(express.json());
        app.use('/upload', uploadRouter);

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        app.use((err: HttpException, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
            const status = err.statusCode || 500;
            res.status(status).json({ error: err.message });
        });
    });

    describe('POST /upload/image', () => {
        it('should successfully upload an image file', async () => {
            const fakeImageBuffer = Buffer.from('fake-png-content');

            const res = await request(app).post('/upload/image').attach('file', fakeImageBuffer, {
                filename: 'test-image.png',
                contentType: 'image/png'
            });

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('url');
            expect(typeof res.body.url).toBe('string');
        });

        it('should fail with 400 when no file is provided', async () => {
            const res = await request(app).post('/upload/image');

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('No file provided');
        });

        it('should fail with 400 when file is not an image', async () => {
            const fakeTextBuffer = Buffer.from('plain text content');

            const res = await request(app).post('/upload/image').attach('file', fakeTextBuffer, {
                filename: 'test.txt',
                contentType: 'text/plain'
            });

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('Only image files are allowed');
        });
    });

    describe('POST /upload/document', () => {
        it('should successfully upload a document file', async () => {
            const fakePdfBuffer = Buffer.from('%PDF-1.4 test document');

            const res = await request(app).post('/upload/document').attach('file', fakePdfBuffer, {
                filename: 'sample-doc.pdf',
                contentType: 'application/pdf'
            });

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('url');
            expect(typeof res.body.url).toBe('string');
        });

        it('should fail with 400 when no document is provided', async () => {
            const res = await request(app).post('/upload/document');

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('No file provided');
        });
    });
});
