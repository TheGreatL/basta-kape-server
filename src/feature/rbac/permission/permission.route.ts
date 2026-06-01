import { Router, type Request, type Response, type NextFunction } from 'express';
import { registry } from '@/docs/swagger';
import { PermissionService } from './permission.service';
import { GetPermissionListQuerySchema, PaginatedPermissionResponseSchema } from './permission.types';
import { requireAccess } from '@/middleware/rbac.middleware';
import { appModules, appPermissions } from '@/constant';

const router = Router();
const permissionService = new PermissionService();

registry.registerPath({
    method: 'get',
    path: '/rbac/permissions/list',
    tags: ['RBAC Permissions'],
    summary: 'Get a paginated list of permissions',
    description: 'Retrieves all available permissions in the system. Supports pagination and search by name/description.',
    request: {
        query: GetPermissionListQuerySchema
    },
    responses: {
        200: {
            description: 'Successful response',
            content: {
                'application/json': {
                    schema: PaginatedPermissionResponseSchema
                }
            }
        }
    }
});

router.get('/list', requireAccess(appModules.ROLES_AND_PERMISSIONS, appPermissions.READ), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const queryParams = GetPermissionListQuerySchema.parse(req.query);
        const data = await permissionService.getList(queryParams);
        res.json(data);
    } catch (error) {
        next(error);
    }
});

export default router;
