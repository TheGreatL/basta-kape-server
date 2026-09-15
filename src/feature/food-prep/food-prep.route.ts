import { Router, Request, Response, NextFunction } from 'express';
import { registry } from '@/docs/swagger';
import { FoodPrepService } from './food-prep.service';
import { requireAccess } from '@/middleware/rbac.middleware';
import { appModules, appPermissions } from '@/constant';
import {
    CreatePreparedBatchSchema,
    DisposePreparedBatchSchema,
    GetPreparedBatchListQuerySchema,
    PreparedBatchResponseSchema,
    PaginatedPreparedBatchResponseSchema,
    DisplayStockSummaryResponseSchema
} from './food-prep.types';

const router = Router();
const service = new FoodPrepService();

// ============================================================================
// FOOD PREPARATION & DISPLAY INVENTORY ENDPOINTS
// ============================================================================

// 1. GET /food-prep/summary
registry.registerPath({
    method: 'get',
    path: '/food-prep/summary',
    tags: ['Food Preparation'],
    summary: 'Get consolidated real-time summary of display inventory stock across all prepared items',
    security: [{ bearerAuth: [] }],
    responses: {
        200: {
            description: 'Display inventory stock summary retrieved successfully',
            content: { 'application/json': { schema: DisplayStockSummaryResponseSchema } }
        }
    }
});

router.get('/summary', requireAccess(appModules.FOOD_PREPARATION, appPermissions.READ), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await service.getDisplayStockSummary();
        res.json(result);
    } catch (error) {
        next(error);
    }
});

// 2. GET /food-prep/batches
registry.registerPath({
    method: 'get',
    path: '/food-prep/batches',
    tags: ['Food Preparation'],
    summary: 'Get paginated list of prepared food display batches with filtering and shelf-life tracking',
    security: [{ bearerAuth: [] }],
    request: {
        query: GetPreparedBatchListQuerySchema
    },
    responses: {
        200: {
            description: 'Prepared batches list retrieved successfully',
            content: { 'application/json': { schema: PaginatedPreparedBatchResponseSchema } }
        }
    }
});

router.get('/batches', requireAccess(appModules.FOOD_PREPARATION, appPermissions.READ), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const query = GetPreparedBatchListQuerySchema.parse(req.query);
        const result = await service.getBatchList(query);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

// 3. GET /food-prep/batches/:id
registry.registerPath({
    method: 'get',
    path: '/food-prep/batches/{id}',
    tags: ['Food Preparation'],
    summary: 'Get details of a specific prepared food batch',
    security: [{ bearerAuth: [] }],
    responses: {
        200: {
            description: 'Prepared batch details retrieved successfully',
            content: { 'application/json': { schema: PreparedBatchResponseSchema } }
        }
    }
});

router.get(
    '/batches/:id',
    requireAccess(appModules.FOOD_PREPARATION, appPermissions.READ),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await service.getBatchById(req.params.id as string);
            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

// 4. POST /food-prep/batches
registry.registerPath({
    method: 'post',
    path: '/food-prep/batches',
    tags: ['Food Preparation'],
    summary: 'Record a freshly prepared/baked batch of food items, deducting raw recipe ingredients from inventory immediately',
    security: [{ bearerAuth: [] }],
    request: {
        body: {
            content: {
                'application/json': { schema: CreatePreparedBatchSchema }
            }
        }
    },
    responses: {
        201: {
            description: 'Prepared batch created and raw ingredients deducted successfully',
            content: { 'application/json': { schema: PreparedBatchResponseSchema } }
        }
    }
});

router.post(
    '/batches',
    requireAccess(appModules.FOOD_PREPARATION, appPermissions.CREATE),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const data = CreatePreparedBatchSchema.parse(req.body);
            const actorId = req.user!.sub;
            const result = await service.createBatch(data, actorId);
            res.status(201).json(result);
        } catch (error) {
            next(error);
        }
    }
);

// 5. POST /food-prep/batches/:id/dispose
registry.registerPath({
    method: 'post',
    path: '/food-prep/batches/{id}/dispose',
    tags: ['Food Preparation'],
    summary: 'Dispose or write off expired, spoiled, or sampled units from a prepared batch',
    security: [{ bearerAuth: [] }],
    request: {
        body: {
            content: {
                'application/json': { schema: DisposePreparedBatchSchema }
            }
        }
    },
    responses: {
        200: {
            description: 'Batch units disposed and waste transaction recorded successfully',
            content: { 'application/json': { schema: PreparedBatchResponseSchema } }
        }
    }
});

router.post(
    '/batches/:id/dispose',
    requireAccess(appModules.FOOD_PREPARATION, appPermissions.UPDATE),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const data = DisposePreparedBatchSchema.parse(req.body);
            const actorId = req.user!.sub;
            const result = await service.disposeBatch(req.params.id as string, data, actorId);
            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

export default router;
