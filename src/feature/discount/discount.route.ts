import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { registry } from '@/docs/swagger';
import { DiscountService } from './discount.service';
import { requireAccess } from '@/middleware/rbac.middleware';
import { appModules, appPermissions } from '@/constant';
import {
    CreateDiscountSchema,
    UpdateDiscountSchema,
    ApplyDiscountSchema,
    DiscountResponseSchema,
    OrderDiscountResponseSchema
} from './discount.types';

export const discountConfigRouter = Router();
export const orderDiscountRouter = Router();
const service = new DiscountService();

// ============================================================================
// DISCOUNT CONFIGURATION ENDPOINTS (mounted at /discounts)
// ============================================================================

// POST /discounts
registry.registerPath({
    method: 'post',
    path: '/discounts',
    tags: ['Discounts Config'],
    summary: 'Create a new discount configuration',
    security: [{ bearerAuth: [] }],
    request: {
        body: {
            content: {
                'application/json': {
                    schema: CreateDiscountSchema
                }
            }
        }
    },
    responses: {
        201: {
            description: 'Discount configuration created successfully',
            content: { 'application/json': { schema: DiscountResponseSchema } }
        }
    }
});

discountConfigRouter.post(
    '/',
    requireAccess(appModules.STORE_SETTINGS, appPermissions.CREATE),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const body = CreateDiscountSchema.parse(req.body);
            const result = await service.createDiscount(body, req.user!.sub);
            res.status(201).json(result);
        } catch (error) {
            next(error);
        }
    }
);

// GET /discounts
registry.registerPath({
    method: 'get',
    path: '/discounts',
    tags: ['Discounts Config'],
    summary: 'List active discount configurations',
    security: [{ bearerAuth: [] }],
    responses: {
        200: {
            description: 'Discounts list retrieved successfully',
            content: {
                'application/json': {
                    schema: z.array(DiscountResponseSchema)
                }
            }
        }
    }
});

discountConfigRouter.get(
    '/',
    requireAccess(appModules.STORE_SETTINGS, appPermissions.READ),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await service.listDiscounts();
            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

// GET /discounts/{id}
registry.registerPath({
    method: 'get',
    path: '/discounts/{id}',
    tags: ['Discounts Config'],
    summary: 'Get details of a single discount configuration',
    security: [{ bearerAuth: [] }],
    request: {
        params: z.object({
            id: z.string().uuid()
        })
    },
    responses: {
        200: {
            description: 'Discount details retrieved successfully',
            content: { 'application/json': { schema: DiscountResponseSchema } }
        }
    }
});

discountConfigRouter.get(
    '/:id',
    requireAccess(appModules.STORE_SETTINGS, appPermissions.READ),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await service.getDiscountById(req.params.id as string);
            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

// PUT /discounts/{id}
registry.registerPath({
    method: 'put',
    path: '/discounts/{id}',
    tags: ['Discounts Config'],
    summary: 'Update an existing discount configuration',
    security: [{ bearerAuth: [] }],
    request: {
        params: z.object({
            id: z.string().uuid()
        }),
        body: {
            content: {
                'application/json': {
                    schema: UpdateDiscountSchema
                }
            }
        }
    },
    responses: {
        200: {
            description: 'Discount configuration updated successfully',
            content: { 'application/json': { schema: DiscountResponseSchema } }
        }
    }
});

discountConfigRouter.put(
    '/:id',
    requireAccess(appModules.STORE_SETTINGS, appPermissions.UPDATE),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const body = UpdateDiscountSchema.parse(req.body);
            const result = await service.updateDiscount(req.params.id as string, body, req.user!.sub);
            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

// DELETE /discounts/{id}
registry.registerPath({
    method: 'delete',
    path: '/discounts/{id}',
    tags: ['Discounts Config'],
    summary: 'Soft-delete a discount configuration',
    security: [{ bearerAuth: [] }],
    request: {
        params: z.object({
            id: z.string().uuid()
        })
    },
    responses: {
        200: {
            description: 'Discount configuration deleted successfully',
            content: { 'application/json': { schema: DiscountResponseSchema } }
        }
    }
});

discountConfigRouter.delete(
    '/:id',
    requireAccess(appModules.STORE_SETTINGS, appPermissions.DELETE),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await service.deleteDiscount(req.params.id as string, req.user!.sub);
            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

// ============================================================================
// ORDER DISCOUNTS TRANSACTIONS ENDPOINTS (mounted at /orders)
// ============================================================================

// POST /orders/{orderId}/discounts
registry.registerPath({
    method: 'post',
    path: '/orders/{orderId}/discounts',
    tags: ['Order Discounts'],
    summary: 'Apply a discount configuration to a pending order',
    security: [{ bearerAuth: [] }],
    request: {
        params: z.object({
            orderId: z.string().uuid()
        }),
        body: {
            content: {
                'application/json': {
                    schema: ApplyDiscountSchema
                }
            }
        }
    },
    responses: {
        201: {
            description: 'Discount applied to order successfully',
            content: { 'application/json': { schema: OrderDiscountResponseSchema } }
        }
    }
});

orderDiscountRouter.post(
    '/:orderId/discounts',
    requireAccess(appModules.POINT_OF_SALE, appPermissions.CREATE),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const body = ApplyDiscountSchema.parse(req.body);
            const result = await service.applyDiscountToOrder(req.params.orderId as string, body, req.user!.sub);
            res.status(201).json(result);
        } catch (error) {
            next(error);
        }
    }
);

// DELETE /orders/{orderId}/discounts
registry.registerPath({
    method: 'delete',
    path: '/orders/{orderId}/discounts',
    tags: ['Order Discounts'],
    summary: 'Remove all applied discounts from a pending order',
    security: [{ bearerAuth: [] }],
    request: {
        params: z.object({
            orderId: z.string().uuid()
        })
    },
    responses: {
        200: {
            description: 'Discounts removed and order totals recalculated successfully'
        }
    }
});

orderDiscountRouter.delete(
    '/:orderId/discounts',
    requireAccess(appModules.POINT_OF_SALE, appPermissions.DELETE),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            await service.removeDiscountFromOrder(req.params.orderId as string, req.user!.sub);
            res.json({ success: true, message: 'Discount removed from order successfully' });
        } catch (error) {
            next(error);
        }
    }
);
