import { Router, Request, Response, NextFunction } from 'express';
import { DisposalService } from './disposal.service';
import {
    GetDisposalListQuerySchema,
    GetDisposalSummaryQuerySchema,
    PaginatedDisposalResponseSchema,
    DisposalSummaryResponseSchema
} from './disposal.types';
import { requireAccess } from '@/middleware/rbac.middleware';
import { appModules, appPermissions } from '@/constant';
import { registry } from '@/docs/swagger';

const router = Router();
const service = new DisposalService();

const disposalReadAccess = requireAccess([
    { module: appModules.INVENTORY_MANAGEMENT, permission: appPermissions.READ },
    { module: appModules.FOOD_PREPARATION, permission: appPermissions.READ },
    { module: appModules.REPORTS_MANAGEMENT, permission: appPermissions.READ }
]);

// 1. GET /disposals/summary
registry.registerPath({
    method: 'get',
    path: '/disposals/summary',
    tags: ['Disposals & Waste'],
    summary: 'Get consolidated financial loss summary and top wasted items across all categories',
    security: [{ bearerAuth: [] }],
    request: {
        query: GetDisposalSummaryQuerySchema
    },
    responses: {
        200: {
            description: 'Disposal and waste summary metrics retrieved successfully',
            content: { 'application/json': { schema: DisposalSummaryResponseSchema } }
        }
    }
});

router.get('/summary', disposalReadAccess, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const query = GetDisposalSummaryQuerySchema.parse(req.query);
        const result = await service.getDisposalSummary(query);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

// 2. GET /disposals
registry.registerPath({
    method: 'get',
    path: '/disposals',
    tags: ['Disposals & Waste'],
    summary: 'Get unified paginated disposal and waste audit log (Prepared Food & Raw Ingredients)',
    security: [{ bearerAuth: [] }],
    request: {
        query: GetDisposalListQuerySchema
    },
    responses: {
        200: {
            description: 'Paginated list of disposal records retrieved successfully',
            content: { 'application/json': { schema: PaginatedDisposalResponseSchema } }
        }
    }
});

router.get('/', disposalReadAccess, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const query = GetDisposalListQuerySchema.parse(req.query);
        const result = await service.getDisposalLogs(query);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

export default router;
