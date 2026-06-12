import { Router, Request, Response, NextFunction } from 'express';
import { registry } from '@/docs/swagger';
import { RegisterShiftService } from './register-shift.service';
import { requireAccess } from '@/middleware/rbac.middleware';
import { appModules, appPermissions } from '@/constant';
import { ForbiddenException } from '@/exceptions';
import {
    OpenShiftSchema,
    CloseShiftSchema,
    RegisterShiftResponseSchema,
    GetRegisterShiftListQuerySchema,
    PaginatedRegisterShiftResponseSchema
} from './register-shift.types';

const router = Router();
const service = new RegisterShiftService();

// ============================================================================
// REGISTER SHIFT ENDPOINTS
// ============================================================================

// GET /register-shifts/active
registry.registerPath({
    method: 'get',
    path: '/register-shifts/active',
    tags: ['Register Shift'],
    summary: 'Get the active register shift for the logged in cashier',
    security: [{ bearerAuth: [] }],
    responses: {
        200: {
            description: 'Active register shift retrieved successfully',
            content: { 'application/json': { schema: RegisterShiftResponseSchema } }
        }
    }
});

router.get('/active', requireAccess(appModules.POINT_OF_SALE, appPermissions.READ), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await service.getActiveShift(req.user!.sub);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

// POST /register-shifts/open
registry.registerPath({
    method: 'post',
    path: '/register-shifts/open',
    tags: ['Register Shift'],
    summary: 'Open a new register shift session',
    security: [{ bearerAuth: [] }],
    request: {
        body: {
            content: {
                'application/json': {
                    schema: OpenShiftSchema
                }
            }
        }
    },
    responses: {
        201: {
            description: 'Register shift session opened successfully',
            content: { 'application/json': { schema: RegisterShiftResponseSchema } }
        }
    }
});

router.post('/open', requireAccess(appModules.POINT_OF_SALE, appPermissions.CREATE), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const body = OpenShiftSchema.parse(req.body);
        const result = await service.openShift(req.user!.sub, body, req.user!.sub);
        res.status(201).json(result);
    } catch (error) {
        next(error);
    }
});

// POST /register-shifts/close
registry.registerPath({
    method: 'post',
    path: '/register-shifts/close',
    tags: ['Register Shift'],
    summary: 'Close the active register shift session',
    security: [{ bearerAuth: [] }],
    request: {
        body: {
            content: {
                'application/json': {
                    schema: CloseShiftSchema
                }
            }
        }
    },
    responses: {
        200: {
            description: 'Register shift session closed successfully',
            content: { 'application/json': { schema: RegisterShiftResponseSchema } }
        }
    }
});

router.post('/close', requireAccess(appModules.POINT_OF_SALE, appPermissions.UPDATE), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const body = CloseShiftSchema.parse(req.body);
        const result = await service.closeShift(req.user!.sub, body, req.user!.sub);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

// GET /register-shifts/my-shifts
registry.registerPath({
    method: 'get',
    path: '/register-shifts/my-shifts',
    tags: ['Register Shift'],
    summary: 'Retrieve register shift sessions for the logged-in cashier',
    security: [{ bearerAuth: [] }],
    request: {
        query: GetRegisterShiftListQuerySchema
    },
    responses: {
        200: {
            description: 'Logged-in cashier register shift list retrieved successfully',
            content: {
                'application/json': {
                    schema: PaginatedRegisterShiftResponseSchema
                }
            }
        }
    }
});

router.get('/my-shifts', requireAccess(appModules.POINT_OF_SALE, appPermissions.READ), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const query = GetRegisterShiftListQuerySchema.parse(req.query);
        const result = await service.getShifts(query, req.user!.sub);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

// GET /register-shifts
registry.registerPath({
    method: 'get',
    path: '/register-shifts',
    tags: ['Register Shift'],
    summary: 'Retrieve all register shift sessions (requires ALL scope)',
    security: [{ bearerAuth: [] }],
    request: {
        query: GetRegisterShiftListQuerySchema
    },
    responses: {
        200: {
            description: 'Register shift list retrieved successfully',
            content: {
                'application/json': {
                    schema: PaginatedRegisterShiftResponseSchema
                }
            }
        }
    }
});

router.get('/', requireAccess(appModules.POINT_OF_SALE, appPermissions.READ), async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.rbacScope || req.rbacScope.toUpperCase() !== 'ALL') {
            throw new ForbiddenException('Insufficient access scope permissions. Scope ALL required.');
        }
        const query = GetRegisterShiftListQuerySchema.parse(req.query);
        const result = await service.getShifts(query);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

export default router;
