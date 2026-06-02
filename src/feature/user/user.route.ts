import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { registry } from '@/docs/swagger';
import { UserService } from './user.service';
import { requireAccess, authenticate } from '@/middleware/rbac.middleware';
import { appModules, appPermissions } from '@/constant';
import { GetUserListQuerySchema, CreateUserSchema, UpdateUserSchema, PaginatedUserResponseSchema, UserResponseSchema } from './user.types';
import { UserRepository } from './user.repository';
import { ForbiddenException, UnauthorizedException } from '@/exceptions';

const router = Router();
const userService = new UserService();
const userRepository = new UserRepository();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});

// ==========================================
// POST /users
// ==========================================
registry.registerPath({
    method: 'post',
    path: '/users',
    tags: ['Users'],
    summary: 'Create a new user',
    security: [{ bearerAuth: [] }],
    request: {
        body: {
            content: {
                'application/json': {
                    schema: CreateUserSchema
                }
            }
        }
    },
    responses: {
        201: {
            description: 'User created successfully',
            content: { 'application/json': { schema: UserResponseSchema } }
        }
    }
});

router.post('/', requireAccess(appModules.USERS_MANAGEMENT, appPermissions.CREATE), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const body = CreateUserSchema.parse(req.body);
        const result = await userService.createUser(body, req.user!.sub);
        res.status(201).json(result);
    } catch (error) {
        next(error);
    }
});

// ==========================================
// GET /users/list
// ==========================================
registry.registerPath({
    method: 'get',
    path: '/users/list',
    tags: ['Users'],
    summary: 'Get paginated list of users',
    security: [{ bearerAuth: [] }],
    responses: {
        200: {
            description: 'User list retrieved successfully',
            content: { 'application/json': { schema: PaginatedUserResponseSchema } }
        }
    }
});

router.get('/list', requireAccess(appModules.USERS_MANAGEMENT, appPermissions.READ), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const query = GetUserListQuerySchema.parse(req.query);
        const result = await userService.getList(query);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

// ==========================================
// GET /users/:id
// ==========================================
registry.registerPath({
    method: 'get',
    path: '/users/{id}',
    tags: ['Users'],
    summary: 'Get user by ID',
    security: [{ bearerAuth: [] }],
    responses: {
        200: {
            description: 'User retrieved successfully',
            content: { 'application/json': { schema: UserResponseSchema } }
        }
    }
});

router.get('/:id', requireAccess(appModules.USERS_MANAGEMENT, appPermissions.READ), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await userService.getUserById(req.params.id as string);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

// ==========================================
// PUT /users/:id
// ==========================================
registry.registerPath({
    method: 'put',
    path: '/users/{id}',
    tags: ['Users'],
    summary: 'Update user by ID',
    security: [{ bearerAuth: [] }],
    request: {
        body: {
            content: {
                'application/json': {
                    schema: UpdateUserSchema
                }
            }
        }
    },
    responses: {
        200: {
            description: 'User updated successfully',
            content: { 'application/json': { schema: UserResponseSchema } }
        }
    }
});

router.put('/:id', requireAccess(appModules.USERS_MANAGEMENT, appPermissions.UPDATE), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const body = UpdateUserSchema.parse(req.body);
        const result = await userService.updateUser(req.params.id as string, body, req.user!.sub);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

// ==========================================
// DELETE /users/:id
// ==========================================
registry.registerPath({
    method: 'delete',
    path: '/users/{id}',
    tags: ['Users'],
    summary: 'Soft delete user by ID',
    security: [{ bearerAuth: [] }],
    responses: {
        200: {
            description: 'User deleted successfully'
        }
    }
});

router.delete('/:id', requireAccess(appModules.USERS_MANAGEMENT, appPermissions.DELETE), async (req: Request, res: Response, next: NextFunction) => {
    try {
        await userService.deleteUser(req.params.id as string, req.user!.sub);
        res.json({ message: 'User soft-deleted successfully' });
    } catch (error) {
        next(error);
    }
});

// ==========================================
// POST /users/:id/profile-picture
// ==========================================
registry.registerPath({
    method: 'post',
    path: '/users/{id}/profile-picture',
    tags: ['Users'],
    summary: 'Upload user profile picture',
    security: [{ bearerAuth: [] }],
    request: {
        body: {
            content: {
                'multipart/form-data': {
                    schema: {
                        type: 'object',
                        properties: {
                            file: { type: 'string', format: 'binary' }
                        }
                    }
                }
            }
        }
    },
    responses: {
        200: {
            description: 'Profile picture uploaded successfully',
            content: { 'application/json': { schema: { type: 'object', properties: { url: { type: 'string' } } } } }
        }
    }
});

router.post('/:id/profile-picture', authenticate, upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const actorId = req.user!.sub;
        const targetUserId = req.params.id as string;

        // If not updating themselves, they must hold USERS_MANAGEMENT UPDATE permission.
        if (actorId !== targetUserId) {
            const user = await userRepository.findUserByIdentifier(actorId);
            if (!user) {
                throw new UnauthorizedException('User no longer exists.');
            }

            let hasPermission = false;
            for (const ur of user.userRoles) {
                for (const rp of ur.role.rolePermissions) {
                    if (
                        rp.modulePermission.module.name.toLowerCase() === appModules.USERS_MANAGEMENT.toLowerCase() &&
                        rp.modulePermission.permission.name.toLowerCase() === appPermissions.UPDATE.toLowerCase()
                    ) {
                        hasPermission = true;
                        break;
                    }
                }
                if (hasPermission) break;
            }

            if (!hasPermission) {
                throw new ForbiddenException(`You do not have permission to update profile photos for other users.`);
            }
        }

        const result = await userService.uploadProfilePicture(targetUserId, req.file as Express.Multer.File, actorId);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

export default router;
