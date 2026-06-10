import { Router, Request, Response, NextFunction } from 'express';
import { registry } from '@/docs/swagger';
import { StoreSettingsService } from './store-settings.service';
import { requireAccess } from '@/middleware/rbac.middleware';
import { appModules, appPermissions } from '@/constant';
import { CreateStoreSettingSchema, UpdateStoreSettingSchema, StoreSettingResponseSchema } from './store-settings.types';

const router = Router();
const service = new StoreSettingsService();

// ============================================================================
// STORE SETTINGS ENDPOINTS
// ============================================================================

// GET /store-settings
registry.registerPath({
    method: 'get',
    path: '/store-settings',
    tags: ['Store Settings'],
    summary: 'Get active store settings',
    security: [{ bearerAuth: [] }],
    responses: {
        200: {
            description: 'Store settings retrieved successfully',
            content: { 'application/json': { schema: StoreSettingResponseSchema } }
        }
    }
});

router.get('/', requireAccess(appModules.STORE_SETTINGS, appPermissions.READ), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await service.getActiveSettings();
        res.json(result);
    } catch (error) {
        next(error);
    }
});

// POST /store-settings
registry.registerPath({
    method: 'post',
    path: '/store-settings',
    tags: ['Store Settings'],
    summary: 'Create a new store settings record',
    security: [{ bearerAuth: [] }],
    request: {
        body: {
            content: {
                'application/json': {
                    schema: CreateStoreSettingSchema
                }
            }
        }
    },
    responses: {
        201: {
            description: 'Store settings created successfully',
            content: { 'application/json': { schema: StoreSettingResponseSchema } }
        }
    }
});

router.post('/', requireAccess(appModules.STORE_SETTINGS, appPermissions.CREATE), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const body = CreateStoreSettingSchema.parse(req.body);
        const result = await service.createSettings(body, req.user!.sub);
        res.status(201).json(result);
    } catch (error) {
        next(error);
    }
});

// PUT /store-settings/:id
registry.registerPath({
    method: 'put',
    path: '/store-settings/{id}',
    tags: ['Store Settings'],
    summary: 'Update store settings',
    security: [{ bearerAuth: [] }],
    request: {
        body: {
            content: {
                'application/json': {
                    schema: UpdateStoreSettingSchema
                }
            }
        }
    },
    responses: {
        200: {
            description: 'Store settings updated successfully',
            content: { 'application/json': { schema: StoreSettingResponseSchema } }
        }
    }
});

router.put('/:id', requireAccess(appModules.STORE_SETTINGS, appPermissions.UPDATE), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const body = UpdateStoreSettingSchema.parse(req.body);
        const result = await service.updateSettings(req.params.id as string, body, req.user!.sub);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

// DELETE /store-settings/:id
registry.registerPath({
    method: 'delete',
    path: '/store-settings/{id}',
    tags: ['Store Settings'],
    summary: 'Delete store settings record by ID',
    security: [{ bearerAuth: [] }],
    responses: {
        200: {
            description: 'Store settings deleted successfully'
        }
    }
});

router.delete('/:id', requireAccess(appModules.STORE_SETTINGS, appPermissions.DELETE), async (req: Request, res: Response, next: NextFunction) => {
    try {
        await service.deleteSettings(req.params.id as string, req.user!.sub);
        res.json({ message: 'Store settings deleted successfully' });
    } catch (error) {
        next(error);
    }
});

export default router;
