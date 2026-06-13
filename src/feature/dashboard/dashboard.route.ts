import { Router, Request, Response, NextFunction } from 'express';
import { registry } from '@/docs/swagger';
import { authenticate } from '@/middleware/rbac.middleware';
import { DashboardService } from './dashboard.service';

const router = Router();
const service = new DashboardService();

// GET /dashboard/summary
registry.registerPath({
    method: 'get',
    path: '/dashboard/summary',
    tags: ['Dashboard'],
    summary: 'Retrieve consolidated dashboard metrics and operations data based on user permissions',
    security: [{ bearerAuth: [] }],
    responses: {
        200: {
            description: 'Dashboard summary retrieved successfully'
        }
    }
});

router.get('/summary', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user!.sub;
        const result = await service.getSummary(userId);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

export default router;
