import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { registry } from '@/docs/swagger';
import { VoidService } from './void.service';
import { requireAccess } from '@/middleware/rbac.middleware';
import { appModules, appPermissions } from '@/constant';
import { VoidOrderSchema, OrderVoidLogResponseSchema } from './void.types';

export const voidRouter = Router();
const service = new VoidService();

// ============================================================================
// ORDER VOID ENDPOINTS (mounted at /orders)
// ============================================================================

// POST /orders/{orderId}/void
registry.registerPath({
    method: 'post',
    path: '/orders/{orderId}/void',
    tags: ['Order Voids'],
    summary: 'Void an active order (requires Manager/Supervisor/Admin override)',
    security: [{ bearerAuth: [] }],
    request: {
        params: z.object({
            orderId: z.string().uuid()
        }),
        body: {
            content: {
                'application/json': {
                    schema: VoidOrderSchema
                }
            }
        }
    },
    responses: {
        200: {
            description: 'Order voided successfully',
            content: { 'application/json': { schema: OrderVoidLogResponseSchema } }
        }
    }
});

voidRouter.post(
    '/:orderId/void',
    requireAccess(appModules.POINT_OF_SALE, appPermissions.DELETE),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const body = VoidOrderSchema.parse(req.body);
            const result = await service.voidOrder(req.params.orderId as string, body.reason, req.user!.sub);
            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

// GET /orders/void-logs
registry.registerPath({
    method: 'get',
    path: '/orders/void-logs',
    tags: ['Order Voids'],
    summary: 'Retrieve all order void audit logs',
    security: [{ bearerAuth: [] }],
    responses: {
        200: {
            description: 'Void logs retrieved successfully',
            content: {
                'application/json': {
                    schema: z.array(OrderVoidLogResponseSchema)
                }
            }
        }
    }
});

voidRouter.get(
    '/void-logs',
    requireAccess(appModules.ORDERS_MANAGEMENT, appPermissions.READ),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await service.getVoidLogs();
            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);
