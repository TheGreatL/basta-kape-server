import { Router, Request, Response, NextFunction } from 'express';
import { registry } from '@/docs/swagger';
import { PurchaseOrderService } from './purchase-order.service';
import { requireAccess } from '@/middleware/rbac.middleware';
import { appModules, appPermissions } from '@/constant';
import { CreatePurchaseOrderSchema, UpdatePurchaseOrderStatusSchema } from './purchase-order.types';
import { z } from 'zod';
import { PurchaseOrderStatus } from '@prisma/client';

const router = Router();
const service = new PurchaseOrderService();

// Schema documentation helpers
const PurchaseOrderResponseSchema = z.object({
    id: z.string().uuid(),
    poNumber: z.string(),
    status: z.nativeEnum(PurchaseOrderStatus),
    notes: z.string().nullable(),
    totalAmount: z.number(),
    supplierId: z.string().uuid(),
    createdById: z.string().uuid(),
    orderedAt: z.string().nullable(),
    receivedAt: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string()
});

// GET /purchase-orders
registry.registerPath({
    method: 'get',
    path: '/purchase-orders',
    tags: ['Purchase Orders'],
    summary: 'List purchase orders with filters and pagination',
    security: [{ bearerAuth: [] }],
    request: {
        query: z.object({
            page: z.coerce.number().min(1).default(1).optional(),
            limit: z.coerce.number().min(1).max(100).default(20).optional(),
            search: z.string().optional(),
            status: z.nativeEnum(PurchaseOrderStatus).optional(),
            supplierId: z.string().uuid().optional(),
            dateFrom: z.string().optional(),
            dateTo: z.string().optional()
        })
    },
    responses: {
        200: {
            description: 'List of purchase orders retrieved successfully'
        }
    }
});

router.get(
    '/',
    requireAccess(appModules.PURCHASE_ORDERS_MANAGEMENT, appPermissions.READ),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const page = Number(req.query.page) || 1;
            const limit = Number(req.query.limit) || 20;
            const search = req.query.search as string;
            const status = req.query.status as PurchaseOrderStatus;
            const supplierId = req.query.supplierId as string;
            const dateFrom = req.query.dateFrom as string;
            const dateTo = req.query.dateTo as string;

            const result = await service.getPurchaseOrderList({
                page,
                limit,
                search,
                status,
                supplierId,
                dateFrom,
                dateTo
            });

            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

// GET /purchase-orders/:id
registry.registerPath({
    method: 'get',
    path: '/purchase-orders/{id}',
    tags: ['Purchase Orders'],
    summary: 'Get purchase order details by ID',
    security: [{ bearerAuth: [] }],
    request: {
        params: z.object({
            id: z.string().uuid()
        })
    },
    responses: {
        200: {
            description: 'Purchase order details retrieved successfully',
            content: { 'application/json': { schema: PurchaseOrderResponseSchema } }
        }
    }
});

router.get(
    '/:id',
    requireAccess(appModules.PURCHASE_ORDERS_MANAGEMENT, appPermissions.READ),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await service.getPurchaseOrderById(req.params.id as string);
            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

// POST /purchase-orders
registry.registerPath({
    method: 'post',
    path: '/purchase-orders',
    tags: ['Purchase Orders'],
    summary: 'Create a new DRAFT purchase order',
    security: [{ bearerAuth: [] }],
    request: {
        body: {
            content: {
                'application/json': {
                    schema: CreatePurchaseOrderSchema
                }
            }
        }
    },
    responses: {
        201: {
            description: 'Purchase order created successfully'
        }
    }
});

router.post(
    '/',
    requireAccess(appModules.PURCHASE_ORDERS_MANAGEMENT, appPermissions.CREATE),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const body = CreatePurchaseOrderSchema.parse(req.body);
            const result = await service.createPurchaseOrder(body, req.user!.sub);
            res.status(201).json(result);
        } catch (error) {
            next(error);
        }
    }
);

// PATCH /purchase-orders/:id/status
registry.registerPath({
    method: 'patch',
    path: '/purchase-orders/{id}/status',
    tags: ['Purchase Orders'],
    summary: 'Update purchase order status',
    security: [{ bearerAuth: [] }],
    request: {
        params: z.object({
            id: z.string().uuid()
        }),
        body: {
            content: {
                'application/json': {
                    schema: UpdatePurchaseOrderStatusSchema
                }
            }
        }
    },
    responses: {
        200: {
            description: 'Purchase order status updated successfully'
        }
    }
});

router.patch(
    '/:id/status',
    requireAccess(appModules.PURCHASE_ORDERS_MANAGEMENT, appPermissions.UPDATE),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const body = UpdatePurchaseOrderStatusSchema.parse(req.body);
            const result = await service.updatePurchaseOrderStatus(req.params.id as string, body.status, req.user!.sub);
            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

export default router;
