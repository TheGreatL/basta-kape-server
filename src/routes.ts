import { Router, Request, Response } from 'express';
import swaggerUi from 'swagger-ui-express';
import { generateOpenAPI, registry } from './docs/swagger';
import { z } from 'zod';

import moduleRouter from './feature/rbac/module/module.route';
import permissionRouter from './feature/rbac/permission/permission.route';
import roleRouter from './feature/rbac/role/role.route';

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

router.use('/rbac/modules', moduleRouter);
router.use('/rbac/permissions', permissionRouter);
router.use('/rbac/roles', roleRouter);

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

// API Documentation (Swagger)
// MUST be generated AFTER all routes are imported and registered above!
const swaggerDocument = generateOpenAPI();
router.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

export default router;
