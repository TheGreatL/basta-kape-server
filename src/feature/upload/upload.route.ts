import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { registry } from '@/docs/swagger';
import { UploadService } from './upload.service';
import { authenticate } from '@/middleware/rbac.middleware';

const router = Router();
const uploadService = new UploadService();

// We use memory storage so the file buffer is available in `req.file` for the service to handle.
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB max total, but our service enforces 5MB strictly.
    }
});

// ==========================================
// POST /upload/image
// ==========================================
registry.registerPath({
    method: 'post',
    path: '/upload/image',
    tags: ['Uploads'],
    summary: 'Upload an image file (Max 5MB)',
    security: [{ bearerAuth: [] }],
    request: {
        body: {
            content: {
                'multipart/form-data': {
                    schema: {
                        type: 'object',
                        properties: {
                            file: { type: 'string', format: 'binary' }
                        }
                    }
                }
            }
        }
    },
    responses: {
        200: {
            description: 'Image uploaded successfully',
            content: { 'application/json': { schema: { type: 'object', properties: { url: { type: 'string' } } } } }
        }
    }
});

router.post('/image', authenticate, upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await uploadService.uploadImage(req.file as Express.Multer.File);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

// ==========================================
// POST /upload/document
// ==========================================
registry.registerPath({
    method: 'post',
    path: '/upload/document',
    tags: ['Uploads'],
    summary: 'Upload a document/file (Max 5MB)',
    security: [{ bearerAuth: [] }],
    request: {
        body: {
            content: {
                'multipart/form-data': {
                    schema: {
                        type: 'object',
                        properties: {
                            file: { type: 'string', format: 'binary' }
                        }
                    }
                }
            }
        }
    },
    responses: {
        200: {
            description: 'Document uploaded successfully',
            content: { 'application/json': { schema: { type: 'object', properties: { url: { type: 'string' } } } } }
        }
    }
});

router.post('/document', authenticate, upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await uploadService.uploadDocument(req.file as Express.Multer.File);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

export default router;
