import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ActivityLogService } from './activity-log.service';
import { GetActivityLogsQuerySchema } from './activity-log.types';
import { validateRequest } from '@/middleware/global.middleware';
import { requireAccess } from '@/middleware/rbac.middleware';
import { appModules, appPermissions } from '@/constant';

const router = Router();
const activityLogService = new ActivityLogService();

// GET /activity-logs
router.get(
    '/',
    requireAccess(appModules.ACTIVITY_LOGS, appPermissions.READ),
    validateRequest(GetActivityLogsQuerySchema, 'query'),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await activityLogService.getList(req.query as unknown as z.infer<typeof GetActivityLogsQuerySchema>);
            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

export default router;
