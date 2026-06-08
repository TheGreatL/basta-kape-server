import { Router, Request, Response, NextFunction } from 'express';
import { registry } from '@/docs/swagger';
import { ProductSettingsService } from './product-settings.service';
import { requireAccess } from '@/middleware/rbac.middleware';
import { appModules, appPermissions } from '@/constant';
import {
    GetListQuerySchema,
    CreateCategorySchema,
    UpdateCategorySchema,
    CategoryResponseSchema,
    PaginatedCategoryResponseSchema,
    CreateTypeSchema,
    UpdateTypeSchema,
    TypeResponseSchema,
    PaginatedTypeResponseSchema,
    CreateAttributeSchema,
    UpdateAttributeSchema,
    AttributeResponseSchema,
    PaginatedAttributeResponseSchema,
    CreateAttributeValueSchema,
    UpdateAttributeValueSchema,
    AttributeValueResponseSchema,
    PaginatedAttributeValueResponseSchema
} from './product-settings.types';

const router = Router();
const service = new ProductSettingsService();

// ============================================================================
// 1. PRODUCT CATEGORIES ENDPOINTS
// ============================================================================

// GET /product-settings/categories
registry.registerPath({
    method: 'get',
    path: '/product-settings/categories',
    tags: ['Product Settings - Categories'],
    summary: 'Get paginated list of product categories',
    security: [{ bearerAuth: [] }],
    responses: {
        200: {
            description: 'Categories list retrieved successfully',
            content: { 'application/json': { schema: PaginatedCategoryResponseSchema } }
        }
    }
});

router.get(
    '/categories',
    requireAccess(appModules.PRODUCT_SETTINGS_MANAGEMENT, appPermissions.READ),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const query = GetListQuerySchema.parse(req.query);
            const result = await service.getCategoryList(query);
            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

// GET /product-settings/categories/:id
registry.registerPath({
    method: 'get',
    path: '/product-settings/categories/{id}',
    tags: ['Product Settings - Categories'],
    summary: 'Get product category by ID',
    security: [{ bearerAuth: [] }],
    responses: {
        200: {
            description: 'Category retrieved successfully',
            content: { 'application/json': { schema: CategoryResponseSchema } }
        }
    }
});

router.get(
    '/categories/:id',
    requireAccess(appModules.PRODUCT_SETTINGS_MANAGEMENT, appPermissions.READ),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await service.getCategoryById(req.params.id as string);
            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

// POST /product-settings/categories
registry.registerPath({
    method: 'post',
    path: '/product-settings/categories',
    tags: ['Product Settings - Categories'],
    summary: 'Create a new product category',
    security: [{ bearerAuth: [] }],
    request: {
        body: {
            content: {
                'application/json': {
                    schema: CreateCategorySchema
                }
            }
        }
    },
    responses: {
        201: {
            description: 'Category created successfully',
            content: { 'application/json': { schema: CategoryResponseSchema } }
        }
    }
});

router.post(
    '/categories',
    requireAccess(appModules.PRODUCT_SETTINGS_MANAGEMENT, appPermissions.CREATE),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const body = CreateCategorySchema.parse(req.body);
            const result = await service.createCategory(body, req.user!.sub);
            res.status(201).json(result);
        } catch (error) {
            next(error);
        }
    }
);

// PUT /product-settings/categories/:id
registry.registerPath({
    method: 'put',
    path: '/product-settings/categories/{id}',
    tags: ['Product Settings - Categories'],
    summary: 'Update a product category',
    security: [{ bearerAuth: [] }],
    request: {
        body: {
            content: {
                'application/json': {
                    schema: UpdateCategorySchema
                }
            }
        }
    },
    responses: {
        200: {
            description: 'Category updated successfully',
            content: { 'application/json': { schema: CategoryResponseSchema } }
        }
    }
});

router.put(
    '/categories/:id',
    requireAccess(appModules.PRODUCT_SETTINGS_MANAGEMENT, appPermissions.UPDATE),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const body = UpdateCategorySchema.parse(req.body);
            const result = await service.updateCategory(req.params.id as string, body, req.user!.sub);
            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

// DELETE /product-settings/categories/:id
registry.registerPath({
    method: 'delete',
    path: '/product-settings/categories/{id}',
    tags: ['Product Settings - Categories'],
    summary: 'Soft-delete a product category',
    security: [{ bearerAuth: [] }],
    responses: {
        200: {
            description: 'Category soft-deleted successfully'
        }
    }
});

router.delete(
    '/categories/:id',
    requireAccess(appModules.PRODUCT_SETTINGS_MANAGEMENT, appPermissions.DELETE),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            await service.deleteCategory(req.params.id as string, req.user!.sub);
            res.json({ message: 'Product category soft-deleted successfully' });
        } catch (error) {
            next(error);
        }
    }
);

// ==========================================
// PATCH /product-settings/categories/:id/restore
// ==========================================
registry.registerPath({
    method: 'patch',
    path: '/product-settings/categories/{id}/restore',
    tags: ['Product Settings - Categories'],
    summary: 'Restore soft-deleted product category by ID',
    security: [{ bearerAuth: [] }],
    responses: {
        200: {
            description: 'Category restored successfully',
            content: { 'application/json': { schema: CategoryResponseSchema } }
        }
    }
});

router.patch(
    '/categories/:id/restore',
    requireAccess(appModules.PRODUCT_SETTINGS_MANAGEMENT, appPermissions.DELETE),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await service.restoreCategory(req.params.id as string, req.user!.sub);
            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

// ============================================================================
// 2. PRODUCT TYPES ENDPOINTS
// ============================================================================

// GET /product-settings/types
registry.registerPath({
    method: 'get',
    path: '/product-settings/types',
    tags: ['Product Settings - Types'],
    summary: 'Get paginated list of product types',
    security: [{ bearerAuth: [] }],
    responses: {
        200: {
            description: 'Types list retrieved successfully',
            content: { 'application/json': { schema: PaginatedTypeResponseSchema } }
        }
    }
});

router.get(
    '/types',
    requireAccess(appModules.PRODUCT_SETTINGS_MANAGEMENT, appPermissions.READ),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const query = GetListQuerySchema.parse(req.query);
            const result = await service.getTypeList(query);
            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

// GET /product-settings/types/:id
registry.registerPath({
    method: 'get',
    path: '/product-settings/types/{id}',
    tags: ['Product Settings - Types'],
    summary: 'Get product type by ID',
    security: [{ bearerAuth: [] }],
    responses: {
        200: {
            description: 'Type retrieved successfully',
            content: { 'application/json': { schema: TypeResponseSchema } }
        }
    }
});

router.get(
    '/types/:id',
    requireAccess(appModules.PRODUCT_SETTINGS_MANAGEMENT, appPermissions.READ),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await service.getTypeById(req.params.id as string);
            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

// POST /product-settings/types
registry.registerPath({
    method: 'post',
    path: '/product-settings/types',
    tags: ['Product Settings - Types'],
    summary: 'Create a new product type',
    security: [{ bearerAuth: [] }],
    request: {
        body: {
            content: {
                'application/json': {
                    schema: CreateTypeSchema
                }
            }
        }
    },
    responses: {
        201: {
            description: 'Type created successfully',
            content: { 'application/json': { schema: TypeResponseSchema } }
        }
    }
});

router.post(
    '/types',
    requireAccess(appModules.PRODUCT_SETTINGS_MANAGEMENT, appPermissions.CREATE),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const body = CreateTypeSchema.parse(req.body);
            const result = await service.createType(body, req.user!.sub);
            res.status(201).json(result);
        } catch (error) {
            next(error);
        }
    }
);

// PUT /product-settings/types/:id
registry.registerPath({
    method: 'put',
    path: '/product-settings/types/{id}',
    tags: ['Product Settings - Types'],
    summary: 'Update a product type',
    security: [{ bearerAuth: [] }],
    request: {
        body: {
            content: {
                'application/json': {
                    schema: UpdateTypeSchema
                }
            }
        }
    },
    responses: {
        200: {
            description: 'Type updated successfully',
            content: { 'application/json': { schema: TypeResponseSchema } }
        }
    }
});

router.put(
    '/types/:id',
    requireAccess(appModules.PRODUCT_SETTINGS_MANAGEMENT, appPermissions.UPDATE),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const body = UpdateTypeSchema.parse(req.body);
            const result = await service.updateType(req.params.id as string, body, req.user!.sub);
            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

// DELETE /product-settings/types/:id
registry.registerPath({
    method: 'delete',
    path: '/product-settings/types/{id}',
    tags: ['Product Settings - Types'],
    summary: 'Soft-delete a product type',
    security: [{ bearerAuth: [] }],
    responses: {
        200: {
            description: 'Type soft-deleted successfully'
        }
    }
});

router.delete(
    '/types/:id',
    requireAccess(appModules.PRODUCT_SETTINGS_MANAGEMENT, appPermissions.DELETE),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            await service.deleteType(req.params.id as string, req.user!.sub);
            res.json({ message: 'Product type soft-deleted successfully' });
        } catch (error) {
            next(error);
        }
    }
);

// ==========================================
// PATCH /product-settings/types/:id/restore
// ==========================================
registry.registerPath({
    method: 'patch',
    path: '/product-settings/types/{id}/restore',
    tags: ['Product Settings - Types'],
    summary: 'Restore soft-deleted product type by ID',
    security: [{ bearerAuth: [] }],
    responses: {
        200: {
            description: 'Type restored successfully',
            content: { 'application/json': { schema: TypeResponseSchema } }
        }
    }
});

router.patch(
    '/types/:id/restore',
    requireAccess(appModules.PRODUCT_SETTINGS_MANAGEMENT, appPermissions.DELETE),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await service.restoreType(req.params.id as string, req.user!.sub);
            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

// ============================================================================
// 3. PRODUCT ATTRIBUTES ENDPOINTS
// ============================================================================

// GET /product-settings/attributes
registry.registerPath({
    method: 'get',
    path: '/product-settings/attributes',
    tags: ['Product Settings - Attributes'],
    summary: 'Get paginated list of product attributes',
    security: [{ bearerAuth: [] }],
    responses: {
        200: {
            description: 'Attributes list retrieved successfully',
            content: { 'application/json': { schema: PaginatedAttributeResponseSchema } }
        }
    }
});

router.get(
    '/attributes',
    requireAccess(appModules.PRODUCT_SETTINGS_MANAGEMENT, appPermissions.READ),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const query = GetListQuerySchema.parse(req.query);
            const result = await service.getAttributeList(query);
            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

// GET /product-settings/attributes/:id
registry.registerPath({
    method: 'get',
    path: '/product-settings/attributes/{id}',
    tags: ['Product Settings - Attributes'],
    summary: 'Get product attribute by ID',
    security: [{ bearerAuth: [] }],
    responses: {
        200: {
            description: 'Attribute retrieved successfully',
            content: { 'application/json': { schema: AttributeResponseSchema } }
        }
    }
});

router.get(
    '/attributes/:id',
    requireAccess(appModules.PRODUCT_SETTINGS_MANAGEMENT, appPermissions.READ),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await service.getAttributeById(req.params.id as string);
            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

// POST /product-settings/attributes
registry.registerPath({
    method: 'post',
    path: '/product-settings/attributes',
    tags: ['Product Settings - Attributes'],
    summary: 'Create a new product attribute',
    security: [{ bearerAuth: [] }],
    request: {
        body: {
            content: {
                'application/json': {
                    schema: CreateAttributeSchema
                }
            }
        }
    },
    responses: {
        201: {
            description: 'Attribute created successfully',
            content: { 'application/json': { schema: AttributeResponseSchema } }
        }
    }
});

router.post(
    '/attributes',
    requireAccess(appModules.PRODUCT_SETTINGS_MANAGEMENT, appPermissions.CREATE),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const body = CreateAttributeSchema.parse(req.body);
            const result = await service.createAttribute(body, req.user!.sub);
            res.status(201).json(result);
        } catch (error) {
            next(error);
        }
    }
);

// PUT /product-settings/attributes/:id
registry.registerPath({
    method: 'put',
    path: '/product-settings/attributes/{id}',
    tags: ['Product Settings - Attributes'],
    summary: 'Update a product attribute',
    security: [{ bearerAuth: [] }],
    request: {
        body: {
            content: {
                'application/json': {
                    schema: UpdateAttributeSchema
                }
            }
        }
    },
    responses: {
        200: {
            description: 'Attribute updated successfully',
            content: { 'application/json': { schema: AttributeResponseSchema } }
        }
    }
});

router.put(
    '/attributes/:id',
    requireAccess(appModules.PRODUCT_SETTINGS_MANAGEMENT, appPermissions.UPDATE),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const body = UpdateAttributeSchema.parse(req.body);
            const result = await service.updateAttribute(req.params.id as string, body, req.user!.sub);
            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

// DELETE /product-settings/attributes/:id
registry.registerPath({
    method: 'delete',
    path: '/product-settings/attributes/{id}',
    tags: ['Product Settings - Attributes'],
    summary: 'Soft-delete a product attribute',
    security: [{ bearerAuth: [] }],
    responses: {
        200: {
            description: 'Attribute soft-deleted successfully'
        }
    }
});

router.delete(
    '/attributes/:id',
    requireAccess(appModules.PRODUCT_SETTINGS_MANAGEMENT, appPermissions.DELETE),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            await service.deleteAttribute(req.params.id as string, req.user!.sub);
            res.json({ message: 'Product attribute soft-deleted successfully' });
        } catch (error) {
            next(error);
        }
    }
);

// ==========================================
// PATCH /product-settings/attributes/:id/restore
// ==========================================
registry.registerPath({
    method: 'patch',
    path: '/product-settings/attributes/{id}/restore',
    tags: ['Product Settings - Attributes'],
    summary: 'Restore soft-deleted product attribute by ID',
    security: [{ bearerAuth: [] }],
    responses: {
        200: {
            description: 'Attribute restored successfully',
            content: { 'application/json': { schema: AttributeResponseSchema } }
        }
    }
});

router.patch(
    '/attributes/:id/restore',
    requireAccess(appModules.PRODUCT_SETTINGS_MANAGEMENT, appPermissions.DELETE),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await service.restoreAttribute(req.params.id as string, req.user!.sub);
            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

// ============================================================================
// 4. PRODUCT ATTRIBUTE VALUES ENDPOINTS
// ============================================================================

// GET /product-settings/attributes/:attributeId/values
registry.registerPath({
    method: 'get',
    path: '/product-settings/attributes/{attributeId}/values',
    tags: ['Product Settings - Attribute Values'],
    summary: 'Get paginated list of values for a specific attribute',
    security: [{ bearerAuth: [] }],
    responses: {
        200: {
            description: 'Attribute values retrieved successfully',
            content: { 'application/json': { schema: PaginatedAttributeValueResponseSchema } }
        }
    }
});

router.get(
    '/attributes/:attributeId/values',
    requireAccess(appModules.PRODUCT_SETTINGS_MANAGEMENT, appPermissions.READ),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const query = GetListQuerySchema.parse(req.query);
            const result = await service.getAttributeValueList(req.params.attributeId as string, query);
            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

// GET /product-settings/attribute-values/:id
registry.registerPath({
    method: 'get',
    path: '/product-settings/attribute-values/{id}',
    tags: ['Product Settings - Attribute Values'],
    summary: 'Get product attribute value by ID',
    security: [{ bearerAuth: [] }],
    responses: {
        200: {
            description: 'Attribute value retrieved successfully',
            content: { 'application/json': { schema: AttributeValueResponseSchema } }
        }
    }
});

router.get(
    '/attribute-values/:id',
    requireAccess(appModules.PRODUCT_SETTINGS_MANAGEMENT, appPermissions.READ),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await service.getAttributeValueById(req.params.id as string);
            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

// POST /product-settings/attribute-values
registry.registerPath({
    method: 'post',
    path: '/product-settings/attribute-values',
    tags: ['Product Settings - Attribute Values'],
    summary: 'Create a new product attribute value',
    security: [{ bearerAuth: [] }],
    request: {
        body: {
            content: {
                'application/json': {
                    schema: CreateAttributeValueSchema
                }
            }
        }
    },
    responses: {
        201: {
            description: 'Attribute value created successfully',
            content: { 'application/json': { schema: AttributeValueResponseSchema } }
        }
    }
});

router.post(
    '/attribute-values',
    requireAccess(appModules.PRODUCT_SETTINGS_MANAGEMENT, appPermissions.CREATE),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const body = CreateAttributeValueSchema.parse(req.body);
            const result = await service.createAttributeValue(body, req.user!.sub);
            res.status(201).json(result);
        } catch (error) {
            next(error);
        }
    }
);

// PUT /product-settings/attribute-values/:id
registry.registerPath({
    method: 'put',
    path: '/product-settings/attribute-values/{id}',
    tags: ['Product Settings - Attribute Values'],
    summary: 'Update a product attribute value',
    security: [{ bearerAuth: [] }],
    request: {
        body: {
            content: {
                'application/json': {
                    schema: UpdateAttributeValueSchema
                }
            }
        }
    },
    responses: {
        200: {
            description: 'Attribute value updated successfully',
            content: { 'application/json': { schema: AttributeValueResponseSchema } }
        }
    }
});

router.put(
    '/attribute-values/:id',
    requireAccess(appModules.PRODUCT_SETTINGS_MANAGEMENT, appPermissions.UPDATE),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const body = UpdateAttributeValueSchema.parse(req.body);
            const result = await service.updateAttributeValue(req.params.id as string, body, req.user!.sub);
            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

// DELETE /product-settings/attribute-values/:id
registry.registerPath({
    method: 'delete',
    path: '/product-settings/attribute-values/{id}',
    tags: ['Product Settings - Attribute Values'],
    summary: 'Soft-delete a product attribute value',
    security: [{ bearerAuth: [] }],
    responses: {
        200: {
            description: 'Attribute value soft-deleted successfully'
        }
    }
});

router.delete(
    '/attribute-values/:id',
    requireAccess(appModules.PRODUCT_SETTINGS_MANAGEMENT, appPermissions.DELETE),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            await service.deleteAttributeValue(req.params.id as string, req.user!.sub);
            res.json({ message: 'Product attribute value soft-deleted successfully' });
        } catch (error) {
            next(error);
        }
    }
);

// ==========================================
// PATCH /product-settings/attribute-values/:id/restore
// ==========================================
registry.registerPath({
    method: 'patch',
    path: '/product-settings/attribute-values/{id}/restore',
    tags: ['Product Settings - Attribute Values'],
    summary: 'Restore soft-deleted product attribute value by ID',
    security: [{ bearerAuth: [] }],
    responses: {
        200: {
            description: 'Attribute value restored successfully',
            content: { 'application/json': { schema: AttributeValueResponseSchema } }
        }
    }
});

router.patch(
    '/attribute-values/:id/restore',
    requireAccess(appModules.PRODUCT_SETTINGS_MANAGEMENT, appPermissions.DELETE),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await service.restoreAttributeValue(req.params.id as string, req.user!.sub);
            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

export default router;
