import { Router, Request, Response, NextFunction } from 'express';
import { registry } from '@/docs/swagger';
import { InventoryService } from './inventory.service';
import { requireAccess } from '@/middleware/rbac.middleware';
import { appModules, appPermissions } from '@/constant';
import {
    GetListQuerySchema,
    CreateIngredientUnitSchema,
    UpdateIngredientUnitSchema,
    IngredientUnitResponseSchema,
    PaginatedIngredientUnitResponseSchema,
    CreateIngredientSchema,
    UpdateIngredientSchema,
    IngredientResponseSchema,
    PaginatedIngredientResponseSchema,
    UpdateInventoryCountSchema,
    InventoryLevelResponseSchema,
    PaginatedInventoryLevelResponseSchema,
    CreateDeliverySchema,
    DeliveryResponseSchema,
    PaginatedDeliveryResponseSchema,
    CreateAdjustmentSchema,
    AdjustmentResponseSchema,
    PaginatedAdjustmentResponseSchema
} from './inventory.types';

const router = Router();
const service = new InventoryService();

// ============================================================================
// 1. INGREDIENT UNITS ENDPOINTS
// ============================================================================

// GET /inventory/units
registry.registerPath({
    method: 'get',
    path: '/inventory/units',
    tags: ['Inventory - Units'],
    summary: 'Get paginated list of ingredient units',
    security: [{ bearerAuth: [] }],
    responses: {
        200: {
            description: 'Ingredient units list retrieved successfully',
            content: { 'application/json': { schema: PaginatedIngredientUnitResponseSchema } }
        }
    }
});

router.get('/units', requireAccess(appModules.INVENTORY_MANAGEMENT, appPermissions.READ), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const query = GetListQuerySchema.parse(req.query);
        const result = await service.getUnitList(query);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

// GET /inventory/units/:id
registry.registerPath({
    method: 'get',
    path: '/inventory/units/{id}',
    tags: ['Inventory - Units'],
    summary: 'Get ingredient unit by ID',
    security: [{ bearerAuth: [] }],
    responses: {
        200: {
            description: 'Ingredient unit retrieved successfully',
            content: { 'application/json': { schema: IngredientUnitResponseSchema } }
        }
    }
});

router.get(
    '/units/:id',
    requireAccess(appModules.INVENTORY_MANAGEMENT, appPermissions.READ),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await service.getUnitById(req.params.id as string);
            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

// POST /inventory/units
registry.registerPath({
    method: 'post',
    path: '/inventory/units',
    tags: ['Inventory - Units'],
    summary: 'Create a new ingredient unit',
    security: [{ bearerAuth: [] }],
    request: {
        body: {
            content: {
                'application/json': {
                    schema: CreateIngredientUnitSchema
                }
            }
        }
    },
    responses: {
        201: {
            description: 'Unit created successfully',
            content: { 'application/json': { schema: IngredientUnitResponseSchema } }
        }
    }
});

router.post(
    '/units',
    requireAccess(appModules.INVENTORY_MANAGEMENT, appPermissions.CREATE),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const body = CreateIngredientUnitSchema.parse(req.body);
            const result = await service.createUnit(body, req.user!.sub);
            res.status(201).json(result);
        } catch (error) {
            next(error);
        }
    }
);

// PUT /inventory/units/:id
registry.registerPath({
    method: 'put',
    path: '/inventory/units/{id}',
    tags: ['Inventory - Units'],
    summary: 'Update an ingredient unit',
    security: [{ bearerAuth: [] }],
    request: {
        body: {
            content: {
                'application/json': {
                    schema: UpdateIngredientUnitSchema
                }
            }
        }
    },
    responses: {
        200: {
            description: 'Unit updated successfully',
            content: { 'application/json': { schema: IngredientUnitResponseSchema } }
        }
    }
});

router.put(
    '/units/:id',
    requireAccess(appModules.INVENTORY_MANAGEMENT, appPermissions.UPDATE),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const body = UpdateIngredientUnitSchema.parse(req.body);
            const result = await service.updateUnit(req.params.id as string, body, req.user!.sub);
            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

// DELETE /inventory/units/:id
registry.registerPath({
    method: 'delete',
    path: '/inventory/units/{id}',
    tags: ['Inventory - Units'],
    summary: 'Soft-delete an ingredient unit',
    security: [{ bearerAuth: [] }],
    responses: {
        200: {
            description: 'Unit soft-deleted successfully'
        }
    }
});

router.delete(
    '/units/:id',
    requireAccess(appModules.INVENTORY_MANAGEMENT, appPermissions.DELETE),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            await service.deleteUnit(req.params.id as string, req.user!.sub);
            res.json({ message: 'Ingredient unit soft-deleted successfully' });
        } catch (error) {
            next(error);
        }
    }
);

// ============================================================================
// 2. INGREDIENTS ENDPOINTS
// ============================================================================

// GET /inventory/ingredients
registry.registerPath({
    method: 'get',
    path: '/inventory/ingredients',
    tags: ['Inventory - Ingredients'],
    summary: 'Get paginated list of ingredients',
    security: [{ bearerAuth: [] }],
    responses: {
        200: {
            description: 'Ingredients list retrieved successfully',
            content: { 'application/json': { schema: PaginatedIngredientResponseSchema } }
        }
    }
});

router.get(
    '/ingredients',
    requireAccess(appModules.INVENTORY_MANAGEMENT, appPermissions.READ),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const query = GetListQuerySchema.parse(req.query);
            const result = await service.getIngredientList(query);
            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

// GET /inventory/ingredients/:id
registry.registerPath({
    method: 'get',
    path: '/inventory/ingredients/{id}',
    tags: ['Inventory - Ingredients'],
    summary: 'Get ingredient by ID',
    security: [{ bearerAuth: [] }],
    responses: {
        200: {
            description: 'Ingredient retrieved successfully',
            content: { 'application/json': { schema: IngredientResponseSchema } }
        }
    }
});

router.get(
    '/ingredients/:id',
    requireAccess(appModules.INVENTORY_MANAGEMENT, appPermissions.READ),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await service.getIngredientById(req.params.id as string);
            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

// POST /inventory/ingredients
registry.registerPath({
    method: 'post',
    path: '/inventory/ingredients',
    tags: ['Inventory - Ingredients'],
    summary: 'Create a new raw ingredient',
    security: [{ bearerAuth: [] }],
    request: {
        body: {
            content: {
                'application/json': {
                    schema: CreateIngredientSchema
                }
            }
        }
    },
    responses: {
        201: {
            description: 'Ingredient created successfully',
            content: { 'application/json': { schema: IngredientResponseSchema } }
        }
    }
});

router.post(
    '/ingredients',
    requireAccess(appModules.INVENTORY_MANAGEMENT, appPermissions.CREATE),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const body = CreateIngredientSchema.parse(req.body);
            const result = await service.createIngredient(body, req.user!.sub);
            res.status(201).json(result);
        } catch (error) {
            next(error);
        }
    }
);

// PUT /inventory/ingredients/:id
registry.registerPath({
    method: 'put',
    path: '/inventory/ingredients/{id}',
    tags: ['Inventory - Ingredients'],
    summary: 'Update a raw ingredient properties',
    security: [{ bearerAuth: [] }],
    request: {
        body: {
            content: {
                'application/json': {
                    schema: UpdateIngredientSchema
                }
            }
        }
    },
    responses: {
        200: {
            description: 'Ingredient updated successfully',
            content: { 'application/json': { schema: IngredientResponseSchema } }
        }
    }
});

router.put(
    '/ingredients/:id',
    requireAccess(appModules.INVENTORY_MANAGEMENT, appPermissions.UPDATE),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const body = UpdateIngredientSchema.parse(req.body);
            const result = await service.updateIngredient(req.params.id as string, body, req.user!.sub);
            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

// DELETE /inventory/ingredients/:id
registry.registerPath({
    method: 'delete',
    path: '/inventory/ingredients/{id}',
    tags: ['Inventory - Ingredients'],
    summary: 'Soft-delete a raw ingredient and archive stock',
    security: [{ bearerAuth: [] }],
    responses: {
        200: {
            description: 'Ingredient deleted successfully'
        }
    }
});

router.delete(
    '/ingredients/:id',
    requireAccess(appModules.INVENTORY_MANAGEMENT, appPermissions.DELETE),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            await service.deleteIngredient(req.params.id as string, req.user!.sub);
            res.json({ message: 'Ingredient soft-deleted successfully' });
        } catch (error) {
            next(error);
        }
    }
);

// ============================================================================
// 3. INVENTORY LEVELS & PHYSICAL COUNTS ENDPOINTS
// ============================================================================

// GET /inventory/levels
registry.registerPath({
    method: 'get',
    path: '/inventory/levels',
    tags: ['Inventory - Levels & Counts'],
    summary: 'Get paginated list of ingredient stock levels',
    security: [{ bearerAuth: [] }],
    responses: {
        200: {
            description: 'Inventory levels list retrieved successfully',
            content: { 'application/json': { schema: PaginatedInventoryLevelResponseSchema } }
        }
    }
});

router.get(
    '/levels',
    requireAccess(appModules.INVENTORY_MANAGEMENT, appPermissions.READ),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const query = GetListQuerySchema.parse(req.query);
            const result = await service.getInventoryLevelsList(query);
            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

// GET /inventory/levels/:ingredientId
registry.registerPath({
    method: 'get',
    path: '/inventory/levels/{ingredientId}',
    tags: ['Inventory - Levels & Counts'],
    summary: 'Get inventory level for a specific ingredient ID',
    security: [{ bearerAuth: [] }],
    responses: {
        200: {
            description: 'Inventory level record retrieved successfully',
            content: { 'application/json': { schema: InventoryLevelResponseSchema } }
        }
    }
});

router.get(
    '/levels/:ingredientId',
    requireAccess(appModules.INVENTORY_MANAGEMENT, appPermissions.READ),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await service.getInventoryLevelByIngredientId(req.params.ingredientId as string);
            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

// PUT /inventory/ingredients/:ingredientId/physical-count
registry.registerPath({
    method: 'put',
    path: '/inventory/ingredients/{ingredientId}/physical-count',
    tags: ['Inventory - Levels & Counts'],
    summary: 'Log a physical inventory count (overwrites current count)',
    security: [{ bearerAuth: [] }],
    request: {
        body: {
            content: {
                'application/json': {
                    schema: UpdateInventoryCountSchema
                }
            }
        }
    },
    responses: {
        200: {
            description: 'Physical count logged and stock updated successfully',
            content: { 'application/json': { schema: InventoryLevelResponseSchema } }
        }
    }
});

router.put(
    '/ingredients/:ingredientId/physical-count',
    requireAccess(appModules.INVENTORY_MANAGEMENT, appPermissions.UPDATE),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const body = UpdateInventoryCountSchema.parse(req.body);
            const result = await service.updatePhysicalCount(req.params.ingredientId as string, body.currentQuantity, req.user!.sub);
            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

// ============================================================================
// 4. BATCH DELIVERIES ENDPOINTS
// ============================================================================

// GET /inventory/deliveries
registry.registerPath({
    method: 'get',
    path: '/inventory/deliveries',
    tags: ['Inventory - Deliveries & Batches'],
    summary: 'Get paginated list of ingredient deliveries',
    security: [{ bearerAuth: [] }],
    responses: {
        200: {
            description: 'Deliveries list retrieved successfully',
            content: { 'application/json': { schema: PaginatedDeliveryResponseSchema } }
        }
    }
});

router.get(
    '/deliveries',
    requireAccess(appModules.INVENTORY_MANAGEMENT, appPermissions.READ),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const query = GetListQuerySchema.parse(req.query);
            const result = await service.getDeliveryList(query);
            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

// POST /inventory/deliveries
registry.registerPath({
    method: 'post',
    path: '/inventory/deliveries',
    tags: ['Inventory - Deliveries & Batches'],
    summary: 'Receive an ingredient delivery (increments current stock count)',
    security: [{ bearerAuth: [] }],
    request: {
        body: {
            content: {
                'application/json': {
                    schema: CreateDeliverySchema
                }
            }
        }
    },
    responses: {
        201: {
            description: 'Delivery received and logged successfully',
            content: { 'application/json': { schema: DeliveryResponseSchema } }
        }
    }
});

router.post(
    '/deliveries',
    requireAccess(appModules.INVENTORY_MANAGEMENT, appPermissions.CREATE),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const body = CreateDeliverySchema.parse(req.body);
            const result = await service.logDelivery(body, req.user!.sub);
            res.status(201).json(result);
        } catch (error) {
            next(error);
        }
    }
);

// ============================================================================
// 5. STOCK ADJUSTMENTS & WASTE ENDPOINTS
// ============================================================================

// GET /inventory/adjustments
registry.registerPath({
    method: 'get',
    path: '/inventory/adjustments',
    tags: ['Inventory - Waste & Adjustments'],
    summary: 'Get paginated list of stock adjustments',
    security: [{ bearerAuth: [] }],
    responses: {
        200: {
            description: 'Adjustments list retrieved successfully',
            content: { 'application/json': { schema: PaginatedAdjustmentResponseSchema } }
        }
    }
});

router.get(
    '/adjustments',
    requireAccess(appModules.INVENTORY_MANAGEMENT, appPermissions.READ),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const query = GetListQuerySchema.parse(req.query);
            const result = await service.getAdjustmentList(query);
            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

// POST /inventory/adjustments
registry.registerPath({
    method: 'post',
    path: '/inventory/adjustments',
    tags: ['Inventory - Waste & Adjustments'],
    summary: 'Log a manual stock adjustment or waste report (modifies stock count)',
    security: [{ bearerAuth: [] }],
    request: {
        body: {
            content: {
                'application/json': {
                    schema: CreateAdjustmentSchema
                }
            }
        }
    },
    responses: {
        201: {
            description: 'Stock level adjustment logged successfully',
            content: { 'application/json': { schema: AdjustmentResponseSchema } }
        }
    }
});

router.post(
    '/adjustments',
    requireAccess(appModules.INVENTORY_MANAGEMENT, appPermissions.CREATE),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const body = CreateAdjustmentSchema.parse(req.body);
            const result = await service.logAdjustment(body, req.user!.sub);
            res.status(201).json(result);
        } catch (error) {
            next(error);
        }
    }
);

export default router;
