import { Router, Request, Response } from 'express';
import { registry } from './docs/swagger';
import { z } from 'zod';

const router = Router();

registry.registerPath({
    method: 'get',
    path: '/health',
    summary: 'Health check',
    description: 'Returns the health status of the server',
    responses: {
        200: {
            description: 'Server is healthy',
            content: {
                'text/plain': {
                    schema: z.string()
                }
            }
        }
    }
});
router.get('/health', (req: Request, res: Response) => {
    res.send('Server is healthy');
});

// router.use('/rbac');

registry.registerPath({
    method: 'get',
    path: '/',
    summary: 'Root endpoint',
    description: 'Returns a basic running message',
    responses: {
        200: {
            description: 'Server is running',
            content: {
                'text/plain': {
                    schema: z.string()
                }
            }
        }
    }
});
router.get('/', (req: Request, res: Response) => {
    res.send('Express + TypeScript Server is running');
});

export default router;
