import { Router, Request, Response, NextFunction } from 'express';
import { registry } from '@/docs/swagger';
import { UnitConversionService } from './unit-conversion.service';
import { requireAccess } from '@/middleware/rbac.middleware';
import { appModules, appPermissions } from '@/constant';
import {
    GetUnitConversionListQuerySchema,
    CreateUnitConversionSchema,
    UpdateUnitConversionSchema,
    UnitConversionResponseSchema,
    PaginatedUnitConversionResponseSchema,
    ConvertQuantityQuerySchema,
    ConvertQuantityResponseSchema
} from './unit-conversion.types';
import { z } from 'zod';

const router = Router();
const service = new UnitConversionService();

// ============================================================================
// UNIT CONVERSIONS ENDPOINTS
// ============================================================================

// GET /unit-conversions
registry.registerPath({
    method: 'get',
    path: '/unit-conversions',
    tags: ['Inventory - Unit Conversions'],
    summary: 'Get paginated list of unit conversions',
    security: [{ bearerAuth: [] }],
    parameters: [
        {
            name: 'page',
            in: 'query',
            required: false,
            schema: { type: 'integer', default: 1 }
        },
        {
            name: 'limit',
            in: 'query',
            required: false,
            schema: { type: 'integer', default: 10 }
        },
        {
            name: 'fromUnitId',
            in: 'query',
            required: false,
            schema: { type: 'string' }
        },
        {
            name: 'toUnitId',
            in: 'query',
            required: false,
            schema: { type: 'string' }
        },
        {
            name: 'ingredientId',
            in: 'query',
            required: false,
            schema: { type: 'string' },
            description: 'Pass ingredient ID, or "global" for global conversions, or omit for all'
        },
        {
            name: 'search',
            in: 'query',
            required: false,
            schema: { type: 'string' }
        }
    ],
    responses: {
        200: {
            description: 'Unit conversions list retrieved successfully',
            content: { 'application/json': { schema: PaginatedUnitConversionResponseSchema } }
        }
    }
});

router.get('/', requireAccess(appModules.INVENTORY_MANAGEMENT, appPermissions.READ), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const query = GetUnitConversionListQuerySchema.parse(req.query);
        const result = await service.getConversionList(query);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

// GET /unit-conversions/convert
registry.registerPath({
    method: 'get',
    path: '/unit-conversions/convert',
    tags: ['Inventory - Unit Conversions'],
    summary: 'Calculate conversion between two units',
    security: [{ bearerAuth: [] }],
    parameters: [
        {
            name: 'fromUnitId',
            in: 'query',
            required: true,
            schema: { type: 'string' }
        },
        {
            name: 'toUnitId',
            in: 'query',
            required: true,
            schema: { type: 'string' }
        },
        {
            name: 'quantity',
            in: 'query',
            required: true,
            schema: { type: 'number' }
        },
        {
            name: 'ingredientId',
            in: 'query',
            required: false,
            schema: { type: 'string' }
        }
    ],
    responses: {
        200: {
            description: 'Conversion calculated successfully',
            content: { 'application/json': { schema: ConvertQuantityResponseSchema } }
        }
    }
});

router.get(
    '/convert',
    requireAccess(appModules.INVENTORY_MANAGEMENT, appPermissions.READ),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const query = ConvertQuantityQuerySchema.parse(req.query);
            const result = await service.convertQuantity(query);
            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

// GET /unit-conversions/:id
registry.registerPath({
    method: 'get',
    path: '/unit-conversions/{id}',
    tags: ['Inventory - Unit Conversions'],
    summary: 'Get unit conversion by ID',
    security: [{ bearerAuth: [] }],
    parameters: [
        {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' }
        }
    ],
    responses: {
        200: {
            description: 'Unit conversion retrieved successfully',
            content: { 'application/json': { schema: UnitConversionResponseSchema } }
        },
        404: { description: 'Unit conversion not found' }
    }
});

router.get('/:id', requireAccess(appModules.INVENTORY_MANAGEMENT, appPermissions.READ), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = req.params.id as string;
        const result = await service.getConversionById(id);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

// POST /unit-conversions
registry.registerPath({
    method: 'post',
    path: '/unit-conversions',
    tags: ['Inventory - Unit Conversions'],
    summary: 'Create a new unit conversion',
    security: [{ bearerAuth: [] }],
    request: {
        body: {
            content: { 'application/json': { schema: CreateUnitConversionSchema } }
        }
    },
    responses: {
        201: {
            description: 'Unit conversion created successfully',
            content: { 'application/json': { schema: UnitConversionResponseSchema } }
        },
        400: { description: 'Invalid input' },
        409: { description: 'Unit conversion already exists' }
    }
});

router.post('/', requireAccess(appModules.INVENTORY_MANAGEMENT, appPermissions.CREATE), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const body = CreateUnitConversionSchema.parse(req.body);
        const actorId = req.user?.sub || '';
        const result = await service.createConversion(body, actorId);
        res.status(201).json(result);
    } catch (error) {
        next(error);
    }
});

// PUT /unit-conversions/:id
registry.registerPath({
    method: 'put',
    path: '/unit-conversions/{id}',
    tags: ['Inventory - Unit Conversions'],
    summary: 'Update unit conversion factor',
    security: [{ bearerAuth: [] }],
    parameters: [
        {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' }
        }
    ],
    request: {
        body: {
            content: { 'application/json': { schema: UpdateUnitConversionSchema } }
        }
    },
    responses: {
        200: {
            description: 'Unit conversion updated successfully',
            content: { 'application/json': { schema: UnitConversionResponseSchema } }
        },
        404: { description: 'Unit conversion not found' }
    }
});

router.put('/:id', requireAccess(appModules.INVENTORY_MANAGEMENT, appPermissions.UPDATE), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = req.params.id as string;
        const body = UpdateUnitConversionSchema.parse(req.body);
        const actorId = req.user?.sub || '';
        const result = await service.updateConversion(id, body, actorId);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

// DELETE /unit-conversions/:id
registry.registerPath({
    method: 'delete',
    path: '/unit-conversions/{id}',
    tags: ['Inventory - Unit Conversions'],
    summary: 'Delete unit conversion',
    security: [{ bearerAuth: [] }],
    parameters: [
        {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' }
        }
    ],
    responses: {
        200: {
            description: 'Unit conversion deleted successfully',
            content: {
                'application/json': {
                    schema: z.object({ message: z.string() })
                }
            }
        },
        404: { description: 'Unit conversion not found' }
    }
});

router.delete(
    '/:id',
    requireAccess(appModules.INVENTORY_MANAGEMENT, appPermissions.DELETE),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const id = req.params.id as string;
            const actorId = req.user?.sub || '';
            const result = await service.deleteConversion(id, actorId);
            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

export default router;
