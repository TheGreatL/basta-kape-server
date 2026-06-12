import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { registry } from '@/docs/swagger';
import { PaymentService } from './payment.service';
import { requireAccess } from '@/middleware/rbac.middleware';
import { appModules, appPermissions } from '@/constant';
import { CreatePaymentSchema, OrderPaymentResponseSchema } from './payment.types';

const router = Router();
const service = new PaymentService();

// ============================================================================
// PAYMENT ENDPOINTS (mounted at /orders)
// ============================================================================

// POST /orders/{orderId}/payments
registry.registerPath({
    method: 'post',
    path: '/orders/{orderId}/payments',
    tags: ['Payments'],
    summary: 'Process digital or cash payment for an order',
    security: [{ bearerAuth: [] }],
    request: {
        params: z.object({
            orderId: z.string().uuid()
        }),
        body: {
            content: {
                'application/json': {
                    schema: CreatePaymentSchema
                }
            }
        }
    },
    responses: {
        201: {
            description: 'Payment processed successfully',
            content: { 'application/json': { schema: OrderPaymentResponseSchema } }
        }
    }
});

router.post(
    '/:orderId/payments',
    requireAccess(appModules.POINT_OF_SALE, appPermissions.CREATE),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const body = CreatePaymentSchema.parse(req.body);
            const result = await service.processPayment(req.params.orderId as string, body, req.user!.sub);
            res.status(201).json(result);
        } catch (error) {
            next(error);
        }
    }
);

// GET /orders/{orderId}/payments
registry.registerPath({
    method: 'get',
    path: '/orders/{orderId}/payments',
    tags: ['Payments'],
    summary: 'Retrieve all payments recorded for a specific order',
    security: [{ bearerAuth: [] }],
    request: {
        params: z.object({
            orderId: z.string().uuid()
        })
    },
    responses: {
        200: {
            description: 'Payments retrieved successfully',
            content: {
                'application/json': {
                    schema: z.array(OrderPaymentResponseSchema)
                }
            }
        }
    }
});

router.get(
    '/:orderId/payments',
    requireAccess(appModules.ORDERS_MANAGEMENT, appPermissions.READ),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await service.getPaymentsByOrderId(req.params.orderId as string);
            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

export default router;
