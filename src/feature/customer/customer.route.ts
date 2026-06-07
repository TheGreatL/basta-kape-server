import { Router, Request, Response, NextFunction } from 'express';
import { registry } from '@/docs/swagger';
import { CustomerService } from './customer.service';
import { requireAccess } from '@/middleware/rbac.middleware';
import { appModules, appPermissions } from '@/constant';
import {
    CreateCustomerSchema,
    UpdateCustomerSchema,
    GetCustomerListQuerySchema,
    CustomerResponseSchema,
    PaginatedCustomerResponseSchema,
    AddCartItemSchema,
    UpdateCartItemSchema,
    CartResponseSchema,
    CartItemResponseSchema
} from './customer.types';

const router = Router();
const customerService = new CustomerService();

// ==========================================
// POST /customers
// ==========================================
registry.registerPath({
    method: 'post',
    path: '/customers',
    tags: ['Customers'],
    summary: 'Create a new customer',
    security: [{ bearerAuth: [] }],
    request: {
        body: {
            content: {
                'application/json': {
                    schema: CreateCustomerSchema
                }
            }
        }
    },
    responses: {
        201: {
            description: 'Customer created successfully',
            content: { 'application/json': { schema: CustomerResponseSchema } }
        }
    }
});

router.post('/', requireAccess(appModules.CUSTOMERS_MANAGEMENT, appPermissions.CREATE), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const body = CreateCustomerSchema.parse(req.body);
        const result = await customerService.createCustomer(body, req.user!.sub);
        res.status(201).json(result);
    } catch (error) {
        next(error);
    }
});

// ==========================================
// GET /customers
// ==========================================
registry.registerPath({
    method: 'get',
    path: '/customers',
    tags: ['Customers'],
    summary: 'Get paginated list of customers',
    security: [{ bearerAuth: [] }],
    responses: {
        200: {
            description: 'Customer list retrieved successfully',
            content: { 'application/json': { schema: PaginatedCustomerResponseSchema } }
        }
    }
});

router.get('/', requireAccess(appModules.CUSTOMERS_MANAGEMENT, appPermissions.READ), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const query = GetCustomerListQuerySchema.parse(req.query);
        const result = await customerService.getCustomerList(query);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

// ==========================================
// GET /customers/:id
// ==========================================
registry.registerPath({
    method: 'get',
    path: '/customers/{id}',
    tags: ['Customers'],
    summary: 'Get customer by ID',
    security: [{ bearerAuth: [] }],
    responses: {
        200: {
            description: 'Customer retrieved successfully',
            content: { 'application/json': { schema: CustomerResponseSchema } }
        }
    }
});

router.get('/:id', requireAccess(appModules.CUSTOMERS_MANAGEMENT, appPermissions.READ), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await customerService.getCustomerById(req.params.id as string);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

// ==========================================
// PUT /customers/:id
// ==========================================
registry.registerPath({
    method: 'put',
    path: '/customers/{id}',
    tags: ['Customers'],
    summary: 'Update customer by ID',
    security: [{ bearerAuth: [] }],
    request: {
        body: {
            content: {
                'application/json': {
                    schema: UpdateCustomerSchema
                }
            }
        }
    },
    responses: {
        200: {
            description: 'Customer updated successfully',
            content: { 'application/json': { schema: CustomerResponseSchema } }
        }
    }
});

router.put('/:id', requireAccess(appModules.CUSTOMERS_MANAGEMENT, appPermissions.UPDATE), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const body = UpdateCustomerSchema.parse(req.body);
        const result = await customerService.updateCustomer(req.params.id as string, body, req.user!.sub);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

// ==========================================
// DELETE /customers/:id
// ==========================================
registry.registerPath({
    method: 'delete',
    path: '/customers/{id}',
    tags: ['Customers'],
    summary: 'Soft delete customer by ID',
    security: [{ bearerAuth: [] }],
    responses: {
        200: {
            description: 'Customer deleted successfully'
        }
    }
});

router.delete(
    '/:id',
    requireAccess(appModules.CUSTOMERS_MANAGEMENT, appPermissions.DELETE),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            await customerService.deleteCustomer(req.params.id as string, req.user!.sub);
            res.json({ message: 'Customer soft-deleted successfully' });
        } catch (error) {
            next(error);
        }
    }
);

// ==========================================
// CART ENDPOINTS
// ==========================================

// ==========================================
// GET /customers/:id/cart
// ==========================================
registry.registerPath({
    method: 'get',
    path: '/customers/{id}/cart',
    tags: ['Customers'],
    summary: 'Get customer cart items',
    security: [{ bearerAuth: [] }],
    responses: {
        200: {
            description: 'Customer cart retrieved successfully',
            content: { 'application/json': { schema: CartResponseSchema } }
        }
    }
});

router.get(
    '/:id/cart',
    requireAccess(appModules.CUSTOMERS_MANAGEMENT, appPermissions.READ),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await customerService.getCart(req.params.id as string);
            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

// ==========================================
// POST /customers/:id/cart
// ==========================================
registry.registerPath({
    method: 'post',
    path: '/customers/{id}/cart',
    tags: ['Customers'],
    summary: 'Add an item to customer cart',
    security: [{ bearerAuth: [] }],
    request: {
        body: {
            content: {
                'application/json': {
                    schema: AddCartItemSchema
                }
            }
        }
    },
    responses: {
        201: {
            description: 'Cart item added/updated successfully',
            content: { 'application/json': { schema: CartItemResponseSchema } }
        }
    }
});

router.post(
    '/:id/cart',
    requireAccess(appModules.CUSTOMERS_MANAGEMENT, appPermissions.UPDATE),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const body = AddCartItemSchema.parse(req.body);
            const result = await customerService.addCartItem(req.params.id as string, body, req.user!.sub);
            res.status(201).json(result);
        } catch (error) {
            next(error);
        }
    }
);

// ==========================================
// PUT /customers/:id/cart/:cartItemId
// ==========================================
registry.registerPath({
    method: 'put',
    path: '/customers/{id}/cart/{cartItemId}',
    tags: ['Customers'],
    summary: 'Update quantity of a cart item',
    security: [{ bearerAuth: [] }],
    request: {
        body: {
            content: {
                'application/json': {
                    schema: UpdateCartItemSchema
                }
            }
        }
    },
    responses: {
        200: {
            description: 'Cart item updated successfully',
            content: { 'application/json': { schema: CartItemResponseSchema } }
        }
    }
});

router.put(
    '/:id/cart/:cartItemId',
    requireAccess(appModules.CUSTOMERS_MANAGEMENT, appPermissions.UPDATE),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const body = UpdateCartItemSchema.parse(req.body);
            const result = await customerService.updateCartItem(req.params.id as string, req.params.cartItemId as string, body, req.user!.sub);
            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

// ==========================================
// DELETE /customers/:id/cart/:cartItemId
// ==========================================
registry.registerPath({
    method: 'delete',
    path: '/customers/{id}/cart/{cartItemId}',
    tags: ['Customers'],
    summary: 'Remove a specific item from cart',
    security: [{ bearerAuth: [] }],
    responses: {
        200: {
            description: 'Cart item removed successfully'
        }
    }
});

router.delete(
    '/:id/cart/:cartItemId',
    requireAccess(appModules.CUSTOMERS_MANAGEMENT, appPermissions.UPDATE),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            await customerService.removeCartItem(req.params.id as string, req.params.cartItemId as string, req.user!.sub);
            res.json({ message: 'Cart item removed successfully' });
        } catch (error) {
            next(error);
        }
    }
);

// ==========================================
// DELETE /customers/:id/cart
// ==========================================
registry.registerPath({
    method: 'delete',
    path: '/customers/{id}/cart',
    tags: ['Customers'],
    summary: 'Clear customer cart',
    security: [{ bearerAuth: [] }],
    responses: {
        200: {
            description: 'Cart cleared successfully'
        }
    }
});

router.delete(
    '/:id/cart',
    requireAccess(appModules.CUSTOMERS_MANAGEMENT, appPermissions.UPDATE),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            await customerService.clearCart(req.params.id as string, req.user!.sub);
            res.json({ message: 'Cart cleared successfully' });
        } catch (error) {
            next(error);
        }
    }
);

export default router;
