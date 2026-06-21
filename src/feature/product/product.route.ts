import { Router, Request, Response, NextFunction } from 'express';
import { registry } from '@/docs/swagger';
import { z } from 'zod';
import { ProductService } from './product.service';
import { requireAccess } from '@/middleware/rbac.middleware';
import { appModules, appPermissions } from '@/constant';
import {
    GetProductListQuerySchema,
    CreateProductSchema,
    UpdateProductSchema,
    CreateProductVariantSchema,
    UpdateProductVariantSchema,
    ProductResponseSchema,
    ProductVariantResponseSchema,
    PaginatedProductResponseSchema,
    BulkSyncProductVariantsSchema
} from './product.types';

const router = Router();
const service = new ProductService();

// ============================================================================
// 1. PRODUCT ENDPOINTS
// ============================================================================

// GET /products
registry.registerPath({
    method: 'get',
    path: '/products',
    tags: ['Products'],
    summary: 'Get paginated list of products',
    security: [{ bearerAuth: [] }],
    request: {
        query: GetProductListQuerySchema
    },
    responses: {
        200: {
            description: 'Products list retrieved successfully',
            content: { 'application/json': { schema: PaginatedProductResponseSchema } }
        }
    }
});

router.get('/', requireAccess(appModules.PRODUCTS_MANAGEMENT, appPermissions.READ), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const query = GetProductListQuerySchema.parse(req.query);
        const result = await service.getProductList(query);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

// GET /products/:id
registry.registerPath({
    method: 'get',
    path: '/products/{id}',
    tags: ['Products'],
    summary: 'Get product by ID',
    security: [{ bearerAuth: [] }],
    responses: {
        200: {
            description: 'Product retrieved successfully',
            content: { 'application/json': { schema: ProductResponseSchema } }
        }
    }
});

router.get('/:id', requireAccess(appModules.PRODUCTS_MANAGEMENT, appPermissions.READ), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await service.getProductById(req.params.id as string);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

// POST /products
registry.registerPath({
    method: 'post',
    path: '/products',
    tags: ['Products'],
    summary: 'Create a new product',
    security: [{ bearerAuth: [] }],
    request: {
        body: {
            content: {
                'application/json': {
                    schema: CreateProductSchema
                }
            }
        }
    },
    responses: {
        201: {
            description: 'Product created successfully',
            content: { 'application/json': { schema: ProductResponseSchema } }
        }
    }
});

router.post('/', requireAccess(appModules.PRODUCTS_MANAGEMENT, appPermissions.CREATE), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const body = CreateProductSchema.parse(req.body);
        const result = await service.createProduct(body, req.user!.sub);
        res.status(201).json(result);
    } catch (error) {
        next(error);
    }
});

// PUT /products/:id
registry.registerPath({
    method: 'put',
    path: '/products/{id}',
    tags: ['Products'],
    summary: 'Update a product',
    security: [{ bearerAuth: [] }],
    request: {
        body: {
            content: {
                'application/json': {
                    schema: UpdateProductSchema
                }
            }
        }
    },
    responses: {
        200: {
            description: 'Product updated successfully',
            content: { 'application/json': { schema: ProductResponseSchema } }
        }
    }
});

router.put('/:id', requireAccess(appModules.PRODUCTS_MANAGEMENT, appPermissions.UPDATE), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const body = UpdateProductSchema.parse(req.body);
        const result = await service.updateProduct(req.params.id as string, body, req.user!.sub);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

// DELETE /products/:id
registry.registerPath({
    method: 'delete',
    path: '/products/{id}',
    tags: ['Products'],
    summary: 'Soft-delete a product',
    security: [{ bearerAuth: [] }],
    responses: {
        200: {
            description: 'Product soft-deleted successfully'
        }
    }
});

router.delete(
    '/:id',
    requireAccess(appModules.PRODUCTS_MANAGEMENT, appPermissions.DELETE),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            await service.deleteProduct(req.params.id as string, req.user!.sub);
            res.json({ message: 'Product soft-deleted successfully' });
        } catch (error) {
            next(error);
        }
    }
);

// ==========================================
// PATCH /products/:id/restore
// ==========================================
registry.registerPath({
    method: 'patch',
    path: '/products/{id}/restore',
    tags: ['Products'],
    summary: 'Restore soft-deleted product by ID',
    security: [{ bearerAuth: [] }],
    responses: {
        200: {
            description: 'Product restored successfully',
            content: { 'application/json': { schema: ProductResponseSchema } }
        }
    }
});

router.patch(
    '/:id/restore',
    requireAccess(appModules.PRODUCTS_MANAGEMENT, appPermissions.DELETE),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await service.restoreProduct(req.params.id as string, req.user!.sub);
            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

// ============================================================================
// 2. PRODUCT VARIANTS ENDPOINTS
// ============================================================================

// GET /products/variants/:id
registry.registerPath({
    method: 'get',
    path: '/products/variants/{id}',
    tags: ['Product Variants'],
    summary: 'Get product variant by ID',
    security: [{ bearerAuth: [] }],
    responses: {
        200: {
            description: 'Variant retrieved successfully',
            content: { 'application/json': { schema: ProductVariantResponseSchema } }
        }
    }
});

router.get(
    '/variants/:id',
    requireAccess(appModules.PRODUCTS_MANAGEMENT, appPermissions.READ),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await service.getVariantById(req.params.id as string);
            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

// POST /products/:productId/variants
registry.registerPath({
    method: 'post',
    path: '/products/{productId}/variants',
    tags: ['Product Variants'],
    summary: 'Create a new variant for a product',
    security: [{ bearerAuth: [] }],
    request: {
        body: {
            content: {
                'application/json': {
                    schema: CreateProductVariantSchema
                }
            }
        }
    },
    responses: {
        201: {
            description: 'Variant created successfully',
            content: { 'application/json': { schema: ProductVariantResponseSchema } }
        }
    }
});

router.post(
    '/:productId/variants',
    requireAccess(appModules.PRODUCTS_MANAGEMENT, appPermissions.CREATE),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const body = CreateProductVariantSchema.parse(req.body);
            const result = await service.createVariant(req.params.productId as string, body, req.user!.sub);
            res.status(201).json(result);
        } catch (error) {
            next(error);
        }
    }
);

// PUT /products/:productId/variants/bulk
registry.registerPath({
    method: 'put',
    path: '/products/{productId}/variants/bulk',
    tags: ['Product Variants'],
    summary: 'Bulk synchronize variants for a product',
    security: [{ bearerAuth: [] }],
    request: {
        body: {
            content: {
                'application/json': {
                    schema: BulkSyncProductVariantsSchema
                }
            }
        }
    },
    responses: {
        200: {
            description: 'Product variants synchronized successfully',
            content: {
                'application/json': {
                    schema: z.object({ message: z.string() })
                }
            }
        }
    }
});

router.put(
    '/:productId/variants/bulk',
    requireAccess(appModules.PRODUCTS_MANAGEMENT, appPermissions.UPDATE),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const body = BulkSyncProductVariantsSchema.parse(req.body);
            await service.syncVariants(req.params.productId as string, body, req.user!.sub);
            res.json({ message: 'Product variants synchronized successfully' });
        } catch (error) {
            next(error);
        }
    }
);

// PUT /products/variants/:id
registry.registerPath({
    method: 'put',
    path: '/products/variants/{id}',
    tags: ['Product Variants'],
    summary: 'Update a product variant',
    security: [{ bearerAuth: [] }],
    request: {
        body: {
            content: {
                'application/json': {
                    schema: UpdateProductVariantSchema
                }
            }
        }
    },
    responses: {
        200: {
            description: 'Variant updated successfully',
            content: { 'application/json': { schema: ProductVariantResponseSchema } }
        }
    }
});

router.put(
    '/variants/:id',
    requireAccess(appModules.PRODUCTS_MANAGEMENT, appPermissions.UPDATE),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const body = UpdateProductVariantSchema.parse(req.body);
            const result = await service.updateVariant(req.params.id as string, body, req.user!.sub);
            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

// DELETE /products/variants/:id
registry.registerPath({
    method: 'delete',
    path: '/products/variants/{id}',
    tags: ['Product Variants'],
    summary: 'Soft-delete a product variant',
    security: [{ bearerAuth: [] }],
    responses: {
        200: {
            description: 'Variant soft-deleted successfully'
        }
    }
});

router.delete(
    '/variants/:id',
    requireAccess(appModules.PRODUCTS_MANAGEMENT, appPermissions.DELETE),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            await service.deleteVariant(req.params.id as string, req.user!.sub);
            res.json({ message: 'Product variant soft-deleted successfully' });
        } catch (error) {
            next(error);
        }
    }
);

// ==========================================
// PATCH /products/variants/:id/restore
// ==========================================
registry.registerPath({
    method: 'patch',
    path: '/products/variants/{id}/restore',
    tags: ['Product Variants'],
    summary: 'Restore soft-deleted product variant by ID',
    security: [{ bearerAuth: [] }],
    responses: {
        200: {
            description: 'Variant restored successfully',
            content: { 'application/json': { schema: ProductVariantResponseSchema } }
        }
    }
});

router.patch(
    '/variants/:id/restore',
    requireAccess(appModules.PRODUCTS_MANAGEMENT, appPermissions.DELETE),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await service.restoreVariant(req.params.id as string, req.user!.sub);
            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

export default router;
