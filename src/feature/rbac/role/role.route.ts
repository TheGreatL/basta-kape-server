import { Router, type Request, type Response, type NextFunction } from 'express';
import { registry } from '@/docs/swagger';
import { RoleService } from './role.service';
import {
    GetRoleListQuerySchema,
    PaginatedRoleResponseSchema,
    CreateRoleSchema,
    UpdateRoleSchema,
    RoleResponseSchema,
    RoleDetailResponseSchema,
    SelectionTreeResponseSchema
} from './role.types';
import { z } from 'zod';
import { ActivityLogService } from '@/feature/activity-log/activity-log.service';
import { requireAccess } from '@/middleware/rbac.middleware';
import { appModules, appPermissions } from '@/constant';

const router = Router();
const roleService = new RoleService();
const activityLogService = new ActivityLogService();

// ==========================================
// 1. GET Selection Tree
// ==========================================
registry.registerPath({
    method: 'get',
    path: '/rbac/roles/modules-permissions',
    tags: ['RBAC Roles'],
    summary: 'Get dynamic selection tree of modules and permissions',
    description: 'Retrieves all available modules, nested permissions, and their specific scoped ModulePermission IDs for the UI checkbox tree.',
    responses: {
        200: {
            description: 'Successful response',
            content: { 'application/json': { schema: SelectionTreeResponseSchema } }
        }
    }
});

router.get(
    '/modules-permissions',
    requireAccess(appModules.ROLES_AND_PERMISSIONS, appPermissions.CREATE),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const data = await roleService.getSelectionTree();
            res.json(data);
        } catch (error) {
            next(error);
        }
    }
);

// ==========================================
// 2. GET Role List
// ==========================================
registry.registerPath({
    method: 'get',
    path: '/rbac/roles/list',
    tags: ['RBAC Roles'],
    summary: 'Get a paginated list of roles',
    request: { query: GetRoleListQuerySchema },
    responses: {
        200: {
            description: 'Successful response',
            content: { 'application/json': { schema: PaginatedRoleResponseSchema } }
        }
    }
});

router.get('/list', requireAccess(appModules.ROLES_AND_PERMISSIONS, appPermissions.READ), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const queryParams = GetRoleListQuerySchema.parse(req.query);
        const data = await roleService.getList(queryParams);
        res.json(data);
    } catch (error) {
        next(error);
    }
});

// ==========================================
// 3. GET Single Role (by Name)
// ==========================================
registry.registerPath({
    method: 'get',
    path: '/rbac/roles/{name}',
    tags: ['RBAC Roles'],
    summary: 'Get a single role by name',
    request: {
        params: z.object({ name: z.string() })
    },
    responses: {
        200: {
            description: 'Successful response',
            content: { 'application/json': { schema: RoleDetailResponseSchema } }
        },
        404: { description: 'Role not found' }
    }
});

router.get(
    '/:name',
    requireAccess(appModules.ROLES_AND_PERMISSIONS, appPermissions.READ),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const name = z.string().parse(req.params.name);
            const data = await roleService.getRoleByName(name);
            res.json(data);
        } catch (error) {
            next(error);
        }
    }
);

// ==========================================
// 4. POST Create Role
// ==========================================
registry.registerPath({
    method: 'post',
    path: '/rbac/roles',
    tags: ['RBAC Roles'],
    summary: 'Create a new role',
    request: {
        body: {
            content: { 'application/json': { schema: CreateRoleSchema } }
        }
    },
    responses: {
        201: {
            description: 'Role created',
            content: { 'application/json': { schema: RoleResponseSchema } }
        }
    }
});

router.post('/', requireAccess(appModules.ROLES_AND_PERMISSIONS, appPermissions.CREATE), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const body = CreateRoleSchema.parse(req.body);
        const data = await roleService.createRole(body);

        await activityLogService.logActivity({
            actorId: req.user?.sub,
            title: 'Create Role',
            details: `Created role: ${data.name}`
        });

        res.status(201).json(data);
    } catch (error) {
        next(error);
    }
});

// ==========================================
// 5. PUT Update Role
// ==========================================
registry.registerPath({
    method: 'put',
    path: '/rbac/roles/{id}',
    tags: ['RBAC Roles'],
    summary: 'Update an existing role',
    description: 'Updates role details and completely replaces its module permissions if provided. Cannot modify the Customer role.',
    request: {
        params: z.object({ id: z.string() }),
        body: {
            content: { 'application/json': { schema: UpdateRoleSchema } }
        }
    },
    responses: {
        200: {
            description: 'Role updated',
            content: { 'application/json': { schema: RoleResponseSchema } }
        },
        403: { description: 'Forbidden: The Customer role cannot be modified' },
        404: { description: 'Role not found' }
    }
});

router.put(
    '/:id',
    requireAccess(appModules.ROLES_AND_PERMISSIONS, appPermissions.UPDATE),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const id = z.string().parse(req.params.id);
            const body = UpdateRoleSchema.parse(req.body);
            const data = await roleService.updateRole(id, body);

            await activityLogService.logActivity({
                actorId: req.user?.sub,
                title: 'Update Role',
                details: `Updated role: ${data.name}`
            });

            res.json(data);
        } catch (error) {
            next(error);
        }
    }
);

// ==========================================
// 6. DELETE Role
// ==========================================
registry.registerPath({
    method: 'delete',
    path: '/rbac/roles/{id}',
    tags: ['RBAC Roles'],
    summary: 'Delete a role',
    description: 'Soft deletes a role. Cannot delete the Customer role.',
    request: {
        params: z.object({ id: z.string() })
    },
    responses: {
        200: {
            description: 'Role soft-deleted',
            content: { 'application/json': { schema: RoleResponseSchema } }
        },
        403: { description: 'Forbidden: The Customer role cannot be deleted' },
        404: { description: 'Role not found' }
    }
});

router.delete(
    '/:id',
    requireAccess(appModules.ROLES_AND_PERMISSIONS, appPermissions.DELETE),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const id = z.string().parse(req.params.id);
            const data = await roleService.deleteRole(id);

            await activityLogService.logActivity({
                actorId: req.user?.sub,
                title: 'Delete Role',
                details: `Deleted role: ${data.name}`
            });

            res.json(data);
        } catch (error) {
            next(error);
        }
    }
);

// ==========================================
// PATCH /rbac/roles/:id/restore
// ==========================================
registry.registerPath({
    method: 'patch',
    path: '/rbac/roles/{id}/restore',
    tags: ['RBAC Roles'],
    summary: 'Restore soft-deleted role by ID',
    security: [{ bearerAuth: [] }],
    request: {
        params: z.object({ id: z.string() })
    },
    responses: {
        200: {
            description: 'Role restored successfully',
            content: { 'application/json': { schema: RoleResponseSchema } }
        },
        403: { description: 'Forbidden: The Customer role cannot be restored' },
        404: { description: 'Role not found' }
    }
});

router.patch(
    '/:id/restore',
    requireAccess(appModules.ROLES_AND_PERMISSIONS, appPermissions.DELETE),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const id = z.string().parse(req.params.id);
            const data = await roleService.restoreRole(id);

            await activityLogService.logActivity({
                actorId: req.user?.sub,
                title: 'Restore Role',
                details: `Restored role: ${data.name}`
            });

            res.json(data);
        } catch (error) {
            next(error);
        }
    }
);

export default router;
