import { Router, type Request, type Response, type NextFunction } from 'express';
import { registry } from '@/docs/swagger';
import { ModuleService } from './module.service';
import { GetModuleListQuerySchema, PaginatedModuleResponseSchema } from './module.types';

const router = Router();
const moduleService = new ModuleService();

registry.registerPath({
    method: 'get',
    path: '/rbac/modules/list',
    tags: ['RBAC Modules'],
    summary: 'Get a paginated list of modules',
    description: 'Retrieves all available modules in the system. Supports pagination and search by name/description.',
    request: {
        query: GetModuleListQuerySchema
    },
    responses: {
        200: {
            description: 'Successful response',
            content: {
                'application/json': {
                    schema: PaginatedModuleResponseSchema
                }
            }
        }
    }
});

router.get('/list', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const queryParams = GetModuleListQuerySchema.parse(req.query);
        const data = await moduleService.getList(queryParams);
        res.json(data);
    } catch (error) {
        next(error);
    }
});

export default router;
