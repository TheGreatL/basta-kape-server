import { Router, Request, Response, NextFunction } from 'express';
import { registry } from '@/docs/swagger';
import { OrderService } from './order.service';
import { requireAccess } from '@/middleware/rbac.middleware';
import { appModules, appPermissions } from '@/constant';
import { OrderStatus } from '@prisma/client';
import { CreateOrderSchema, UpdateOrderStatusSchema, GetOrderListQuerySchema, OrderResponseSchema } from './order.types';

const router = Router();
const service = new OrderService();

// ============================================================================
// ORDERS ENDPOINTS
// ============================================================================

// GET /orders
registry.registerPath({
    method: 'get',
    path: '/orders',
    tags: ['Orders'],
    summary: 'Get paginated list of orders',
    security: [{ bearerAuth: [] }],
    request: {
        query: GetOrderListQuerySchema
    },
    responses: {
        200: {
            description: 'Orders list retrieved successfully'
        }
    }
});

router.get('/', requireAccess(appModules.ORDERS_MANAGEMENT, appPermissions.READ), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const query = GetOrderListQuerySchema.parse(req.query);
        const result = await service.getOrderList(query);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

// GET /orders/:id
registry.registerPath({
    method: 'get',
    path: '/orders/{id}',
    tags: ['Orders'],
    summary: 'Get order details by ID',
    security: [{ bearerAuth: [] }],
    responses: {
        200: {
            description: 'Order details retrieved successfully',
            content: { 'application/json': { schema: OrderResponseSchema } }
        }
    }
});

router.get('/:id', requireAccess(appModules.ORDERS_MANAGEMENT, appPermissions.READ), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await service.getOrderById(req.params.id as string);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

// POST /orders
registry.registerPath({
    method: 'post',
    path: '/orders',
    tags: ['Orders'],
    summary: 'Create a new order',
    security: [{ bearerAuth: [] }],
    request: {
        body: {
            content: {
                'application/json': {
                    schema: CreateOrderSchema
                }
            }
        }
    },
    responses: {
        201: {
            description: 'Order created successfully',
            content: { 'application/json': { schema: OrderResponseSchema } }
        }
    }
});

router.post('/', requireAccess(appModules.ORDERS_MANAGEMENT, appPermissions.CREATE), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const body = CreateOrderSchema.parse(req.body);
        const result = await service.createOrder(body, req.user!.sub);
        res.status(201).json(result);
    } catch (error) {
        next(error);
    }
});

// PATCH /orders/:id/status
registry.registerPath({
    method: 'patch',
    path: '/orders/{id}/status',
    tags: ['Orders'],
    summary: 'Update order status and add history log',
    security: [{ bearerAuth: [] }],
    request: {
        body: {
            content: {
                'application/json': {
                    schema: UpdateOrderStatusSchema
                }
            }
        }
    },
    responses: {
        200: {
            description: 'Order status updated successfully',
            content: { 'application/json': { schema: OrderResponseSchema } }
        }
    }
});

router.patch(
    '/:id/status',
    requireAccess(appModules.ORDERS_MANAGEMENT, appPermissions.UPDATE),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const body = UpdateOrderStatusSchema.parse(req.body);
            const result = await service.updateOrderStatus(req.params.id as string, body.status as OrderStatus, body.notes ?? null, req.user!.sub);
            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

export default router;
