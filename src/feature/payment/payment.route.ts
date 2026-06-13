import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { registry } from '@/docs/swagger';
import { PaymentService } from './payment.service';
import { requireAccess } from '@/middleware/rbac.middleware';
import { appModules, appPermissions } from '@/constant';
import { CreatePaymentSchema, OrderPaymentResponseSchema } from './payment.types';
import { PaymentMethod, PaymentStatus } from '@prisma/client';

const router = Router();
const service = new PaymentService();

// ============================================================================
// PAYMENT ENDPOINTS (mounted at /orders)
// ============================================================================

// ============================================================================
// TRANSACTION HISTORY & PAYMENTS LIST ENDPOINTS
// ============================================================================

// GET /orders/payments
registry.registerPath({
    method: 'get',
    path: '/orders/payments',
    tags: ['Payments'],
    summary: 'List payment transactions with filters and pagination',
    security: [{ bearerAuth: [] }],
    request: {
        query: z.object({
            page: z.coerce.number().min(1).default(1).optional(),
            limit: z.coerce.number().min(1).max(100).default(20).optional(),
            search: z.string().optional(),
            paymentMethod: z.enum(['CASH', 'GCASH', 'PAYMAYA', 'CREDIT_CARD']).optional(),
            paymentStatus: z.enum(['PENDING', 'PAID', 'FAILED', 'REFUNDED']).optional(),
            dateFrom: z.string().optional(),
            dateTo: z.string().optional()
        })
    },
    responses: {
        200: {
            description: 'List of payment transactions retrieved successfully'
        }
    }
});

router.get(
    '/payments',
    requireAccess(appModules.TRANSACTION_HISTORY, appPermissions.READ),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const page = Number(req.query.page) || 1;
            const limit = Number(req.query.limit) || 20;
            const search = req.query.search as string;
            const paymentMethod = req.query.paymentMethod as PaymentMethod;
            const paymentStatus = req.query.paymentStatus as PaymentStatus;
            const dateFrom = req.query.dateFrom as string;
            const dateTo = req.query.dateTo as string;

            const result = await service.getPaymentList({
                page,
                limit,
                search,
                paymentMethod,
                paymentStatus,
                dateFrom,
                dateTo
            });

            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

// PATCH /orders/payments/{paymentId}/receipt
registry.registerPath({
    method: 'patch',
    path: '/orders/payments/{paymentId}/receipt',
    tags: ['Payments'],
    summary: 'Upload digital proof of payment or reference number for a non-cash transaction',
    security: [{ bearerAuth: [] }],
    request: {
        params: z.object({
            paymentId: z.string().uuid()
        }),
        body: {
            content: {
                'application/json': {
                    schema: z.object({
                        paymentProofPhoto: z.string().optional(),
                        gcashReferenceNumber: z.string().optional()
                    })
                }
            }
        }
    },
    responses: {
        200: {
            description: 'Receipt details updated successfully'
        }
    }
});

router.patch(
    '/payments/:paymentId/receipt',
    requireAccess(appModules.TRANSACTION_HISTORY, appPermissions.UPDATE),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await service.updatePaymentReceipt(req.params.paymentId as string, req.body, req.user!.sub);
            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

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
