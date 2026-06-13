import { Router, Request, Response, NextFunction } from 'express';
import { registry } from '@/docs/swagger';
import { requireAccess } from '@/middleware/rbac.middleware';
import { appModules, appPermissions } from '@/constant';
import { ReportService } from './report.service';
import { ReportExportSchema, ReportModulesResponseSchema, ReportPreviewResponseSchema, ReportPreviewSchema } from './report.types';
import { z } from 'zod';

const router = Router();
const service = new ReportService();

// GET /reports/modules
registry.registerPath({
    method: 'get',
    path: '/reports/modules',
    tags: ['Reports'],
    summary: 'List available report modules, filters, and column definitions',
    security: [{ bearerAuth: [] }],
    responses: {
        200: {
            description: 'Report modules retrieved successfully',
            content: { 'application/json': { schema: ReportModulesResponseSchema } }
        }
    }
});

router.get(
    '/modules',
    requireAccess(appModules.REPORTS_MANAGEMENT, appPermissions.READ),
    async (_req: Request, res: Response, next: NextFunction) => {
        try {
            res.json({ data: service.getModules() });
        } catch (error) {
            next(error);
        }
    }
);

// POST /reports/preview
registry.registerPath({
    method: 'post',
    path: '/reports/preview',
    tags: ['Reports'],
    summary: 'Preview report data using selected module and filters',
    security: [{ bearerAuth: [] }],
    request: {
        body: {
            content: {
                'application/json': {
                    schema: ReportPreviewSchema
                }
            }
        }
    },
    responses: {
        200: {
            description: 'Report preview generated successfully',
            content: { 'application/json': { schema: ReportPreviewResponseSchema } }
        }
    }
});

router.post(
    '/preview',
    requireAccess(appModules.REPORTS_MANAGEMENT, appPermissions.READ),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const body = ReportPreviewSchema.parse(req.body);
            const result = await service.previewReport(body);
            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

// POST /reports/export
registry.registerPath({
    method: 'post',
    path: '/reports/export',
    tags: ['Reports'],
    summary: 'Export report data as Excel or PDF',
    security: [{ bearerAuth: [] }],
    request: {
        body: {
            content: {
                'application/json': {
                    schema: ReportExportSchema
                }
            }
        }
    },
    responses: {
        200: {
            description: 'Report file generated successfully'
        }
    }
});

router.post('/export', requireAccess(appModules.REPORTS_MANAGEMENT, appPermissions.READ), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const body = ReportExportSchema.parse(req.body);
        const result = await service.exportReport(body, req.user!.sub);

        res.setHeader('Content-Type', result.mimeType);
        res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
        res.send(result.buffer);
    } catch (error) {
        next(error);
    }
});

// GET /reports/sales-analytics
registry.registerPath({
    method: 'get',
    path: '/reports/sales-analytics',
    tags: ['Reports'],
    summary: 'Retrieve compiled sales analytics data',
    security: [{ bearerAuth: [] }],
    request: {
        query: z.object({
            dateFrom: z.string().optional(),
            dateTo: z.string().optional()
        })
    },
    responses: {
        200: {
            description: 'Sales analytics retrieved successfully'
        }
    }
});

router.get(
    '/sales-analytics',
    requireAccess(appModules.SALES_MANAGEMENT, appPermissions.READ),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const dateFrom = req.query.dateFrom as string;
            const dateTo = req.query.dateTo as string;
            const result = await service.getSalesAnalytics(dateFrom, dateTo);
            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

export default router;
