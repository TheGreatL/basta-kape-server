import { Router, Request, Response, NextFunction } from 'express';
import { registry } from '@/docs/swagger';
import { SupplierService } from './supplier.service';
import { requireAccess } from '@/middleware/rbac.middleware';
import { appModules, appPermissions } from '@/constant';
import {
    GetSupplierListQuerySchema,
    CreateSupplierSchema,
    UpdateSupplierSchema,
    SupplierResponseSchema,
    PaginatedSupplierResponseSchema
} from './supplier.types';

const router = Router();
const service = new SupplierService();

// ============================================================================
// SUPPLIERS ENDPOINTS
// ============================================================================

// GET /suppliers
registry.registerPath({
    method: 'get',
    path: '/suppliers',
    tags: ['Suppliers'],
    summary: 'Get paginated list of suppliers',
    security: [{ bearerAuth: [] }],
    request: {
        query: GetSupplierListQuerySchema
    },
    responses: {
        200: {
            description: 'Suppliers list retrieved successfully',
            content: { 'application/json': { schema: PaginatedSupplierResponseSchema } }
        }
    }
});

router.get('/', requireAccess(appModules.SUPPLIERS_MANAGEMENT, appPermissions.READ), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const query = GetSupplierListQuerySchema.parse(req.query);
        const result = await service.getSupplierList(query);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

// GET /suppliers/:id
registry.registerPath({
    method: 'get',
    path: '/suppliers/{id}',
    tags: ['Suppliers'],
    summary: 'Get supplier by ID',
    security: [{ bearerAuth: [] }],
    responses: {
        200: {
            description: 'Supplier retrieved successfully',
            content: { 'application/json': { schema: SupplierResponseSchema } }
        }
    }
});

router.get('/:id', requireAccess(appModules.SUPPLIERS_MANAGEMENT, appPermissions.READ), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await service.getSupplierById(req.params.id as string);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

// POST /suppliers
registry.registerPath({
    method: 'post',
    path: '/suppliers',
    tags: ['Suppliers'],
    summary: 'Create a new supplier',
    security: [{ bearerAuth: [] }],
    request: {
        body: {
            content: {
                'application/json': {
                    schema: CreateSupplierSchema
                }
            }
        }
    },
    responses: {
        201: {
            description: 'Supplier created successfully',
            content: { 'application/json': { schema: SupplierResponseSchema } }
        }
    }
});

router.post('/', requireAccess(appModules.SUPPLIERS_MANAGEMENT, appPermissions.CREATE), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const body = CreateSupplierSchema.parse(req.body);
        const result = await service.createSupplier(body, req.user!.sub);
        res.status(201).json(result);
    } catch (error) {
        next(error);
    }
});

// PUT /suppliers/:id
registry.registerPath({
    method: 'put',
    path: '/suppliers/{id}',
    tags: ['Suppliers'],
    summary: 'Update a supplier',
    security: [{ bearerAuth: [] }],
    request: {
        body: {
            content: {
                'application/json': {
                    schema: UpdateSupplierSchema
                }
            }
        }
    },
    responses: {
        200: {
            description: 'Supplier updated successfully',
            content: { 'application/json': { schema: SupplierResponseSchema } }
        }
    }
});

router.put('/:id', requireAccess(appModules.SUPPLIERS_MANAGEMENT, appPermissions.UPDATE), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const body = UpdateSupplierSchema.parse(req.body);
        const result = await service.updateSupplier(req.params.id as string, body, req.user!.sub);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

// DELETE /suppliers/:id
registry.registerPath({
    method: 'delete',
    path: '/suppliers/{id}',
    tags: ['Suppliers'],
    summary: 'Soft-delete a supplier',
    security: [{ bearerAuth: [] }],
    responses: {
        200: {
            description: 'Supplier soft-deleted successfully'
        }
    }
});

router.delete(
    '/:id',
    requireAccess(appModules.SUPPLIERS_MANAGEMENT, appPermissions.DELETE),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            await service.deleteSupplier(req.params.id as string, req.user!.sub);
            res.json({ message: 'Supplier soft-deleted successfully' });
        } catch (error) {
            next(error);
        }
    }
);

// ==========================================
// PATCH /suppliers/:id/restore
// ==========================================
registry.registerPath({
    method: 'patch',
    path: '/suppliers/{id}/restore',
    tags: ['Suppliers'],
    summary: 'Restore soft-deleted supplier by ID',
    security: [{ bearerAuth: [] }],
    responses: {
        200: {
            description: 'Supplier restored successfully',
            content: { 'application/json': { schema: SupplierResponseSchema } }
        }
    }
});

router.patch(
    '/:id/restore',
    requireAccess(appModules.SUPPLIERS_MANAGEMENT, appPermissions.DELETE),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await service.restoreSupplier(req.params.id as string, req.user!.sub);
            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

export default router;
