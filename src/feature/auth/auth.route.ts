import { Router, type Request, type Response, type NextFunction } from 'express';
import { registry } from '@/docs/swagger';
import { AuthService } from './auth.service';
import { LoginSchema, RegisterSchema, AuthTokenResponseSchema, ForgotPasswordSchema, ResetPasswordSchema, ChangePasswordSchema } from './auth.types';
import { authenticate } from '@/middleware/rbac.middleware';
import { z } from 'zod';
import { ActivityLogService } from '@/feature/activity-log/activity-log.service';
import { prisma } from '@/lib/prisma';
import rateLimit from 'express-rate-limit';

const router = Router();
const authService = new AuthService();
const activityLogService = new ActivityLogService();

const loginRateLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 5, // 5 attempts per windowMs
    skip: (req) => req.headers['x-skip-rate-limit'] === 'true',
    message: { message: 'Too many login attempts, please try again after 5 minutes' }
});

// ==========================================
// POST /auth/login
// ==========================================
registry.registerPath({
    method: 'post',
    path: '/auth/login',
    tags: ['Auth'],
    summary: 'Login with email or username',
    request: {
        body: {
            content: {
                'application/json': {
                    schema: LoginSchema
                }
            }
        }
    },
    responses: {
        200: {
            description: 'Login successful',
            content: { 'application/json': { schema: AuthTokenResponseSchema } }
        },
        401: { description: 'Invalid credentials' }
    }
});

router.post('/login', loginRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { identifier, password } = LoginSchema.parse(req.body);
        const result = await authService.login(identifier, password);

        // Set refresh token in HttpOnly cookie
        res.cookie('refreshToken', result.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        res.json({ accessToken: result.accessToken, userId: result.user.id });
    } catch (error) {
        next(error);
    }
});

// ==========================================
// POST /auth/register
// ==========================================
registry.registerPath({
    method: 'post',
    path: '/auth/register',
    tags: ['Auth'],
    summary: 'Register a new user account',
    request: {
        body: {
            content: {
                'application/json': {
                    schema: RegisterSchema
                }
            }
        }
    },
    responses: {
        201: {
            description: 'Registration successful',
            content: { 'application/json': { schema: AuthTokenResponseSchema } }
        },
        409: { description: 'Email or username already in use' }
    }
});

router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = RegisterSchema.parse(req.body);
        const result = await authService.register(data);

        await activityLogService.logActivity({
            actorId: result.user.id,
            title: 'Register User',
            details: `Registered new user: ${data.username}`
        });

        // Set refresh token in HttpOnly cookie
        res.cookie('refreshToken', result.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        res.status(201).json({ accessToken: result.accessToken, userId: result.user.id });
    } catch (error) {
        next(error);
    }
});

// ==========================================
// POST /auth/refresh
// ==========================================
registry.registerPath({
    method: 'post',
    path: '/auth/refresh',
    tags: ['Auth'],
    summary: 'Exchange a refresh token for a new access token',
    request: {
        // No body required as token is in cookie
    },
    responses: {
        200: {
            description: 'New access token issued',
            content: {
                'application/json': {
                    schema: AuthTokenResponseSchema
                }
            }
        },
        401: { description: 'Refresh token invalid or expired' }
    }
});

router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const refreshToken = req.cookies.refreshToken;
        if (!refreshToken) {
            return res.status(401).json({ success: false, error: 'No refresh token provided' });
        }

        const result = await authService.refreshAccessToken(refreshToken);
        res.json({ accessToken: result.accessToken, userId: result.user.id });
    } catch (error) {
        next(error);
    }
});

// ==========================================
// POST /auth/logout
// ==========================================
registry.registerPath({
    method: 'post',
    path: '/auth/logout',
    tags: ['Auth'],
    summary: 'Revoke a refresh token (logout)',
    request: {
        // No body required as token is in cookie
    },
    responses: {
        200: {
            description: 'Logout successful',
            content: {
                'application/json': {
                    schema: z.object({ success: z.boolean() })
                }
            }
        }
    }
});

router.post('/logout', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const refreshToken = req.cookies.refreshToken;
        if (refreshToken) {
            await authService.logout(refreshToken);
            res.clearCookie('refreshToken');
        }
        res.json({ success: true });
    } catch (error) {
        next(error);
    }
});

// ==========================================
// POST /auth/forgot-password
// ==========================================
registry.registerPath({
    method: 'post',
    path: '/auth/forgot-password',
    tags: ['Auth'],
    summary: 'Request password reset token',
    request: {
        body: {
            content: {
                'application/json': {
                    schema: ForgotPasswordSchema
                }
            }
        }
    },
    responses: {
        200: {
            description: 'Password reset request handled successfully',
            content: {
                'application/json': {
                    schema: z.object({
                        success: z.boolean(),
                        message: z.string(),
                        resetToken: z.string().optional()
                    })
                }
            }
        }
    }
});

router.post('/forgot-password', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email } = ForgotPasswordSchema.parse(req.body);
        const result = await authService.forgotPassword(email);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

// ==========================================
// POST /auth/reset-password
// ==========================================
registry.registerPath({
    method: 'post',
    path: '/auth/reset-password',
    tags: ['Auth'],
    summary: 'Reset password using token',
    request: {
        body: {
            content: {
                'application/json': {
                    schema: ResetPasswordSchema
                }
            }
        }
    },
    responses: {
        200: {
            description: 'Password reset successfully',
            content: {
                'application/json': {
                    schema: z.object({
                        success: z.boolean(),
                        message: z.string()
                    })
                }
            }
        },
        400: { description: 'Invalid or expired token' }
    }
});

router.post('/reset-password', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { token, newPassword } = ResetPasswordSchema.parse(req.body);
        const result = await authService.resetPassword(token, newPassword);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

// ==========================================
// POST /auth/change-password
// ==========================================
registry.registerPath({
    method: 'post',
    path: '/auth/change-password',
    tags: ['Auth'],
    summary: 'Change password for authenticated user',
    security: [{ bearerAuth: [] }],
    request: {
        body: {
            content: {
                'application/json': {
                    schema: ChangePasswordSchema
                }
            }
        }
    },
    responses: {
        200: {
            description: 'Password changed successfully',
            content: {
                'application/json': {
                    schema: z.object({
                        success: z.boolean(),
                        message: z.string()
                    })
                }
            }
        },
        400: { description: 'Incorrect old password' },
        401: { description: 'Unauthorized' }
    }
});

router.post('/change-password', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { oldPassword, newPassword } = ChangePasswordSchema.parse(req.body);
        const userId = req.user!.sub;
        const result = await authService.changePassword(userId, oldPassword, newPassword);

        await activityLogService.logActivity({
            actorId: userId,
            title: 'Change Password',
            details: 'Successfully changed account password'
        });

        res.clearCookie('refreshToken');
        res.json(result);
    } catch (error) {
        next(error);
    }
});

// ==========================================
// GET /auth/me
// ==========================================
registry.registerPath({
    method: 'get',
    path: '/auth/me',
    tags: ['Auth'],
    summary: 'Get current authenticated user profile',
    security: [{ bearerAuth: [] }],
    responses: {
        200: {
            description: 'Current user profile',
            content: {
                'application/json': {
                    schema: z.object({
                        id: z.string(),
                        email: z.string(),
                        username: z.string(),
                        firstName: z.string(),
                        lastName: z.string(),
                        phoneNumber: z.string().nullable(),
                        createdAt: z.string(),
                        roles: z.array(
                            z.object({
                                name: z.string(),
                                permissions: z.array(
                                    z.object({
                                        module: z.string(),
                                        permission: z.string(),
                                        scope: z.string()
                                    })
                                )
                            })
                        )
                    })
                }
            }
        },
        401: { description: 'Unauthorized' }
    }
});

router.get('/me', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user!.sub;

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                username: true,
                firstName: true,
                lastName: true,
                phoneNumber: true,
                createdAt: true,
                profilePhoto: true,
                middleName: true,
                userRoles: {
                    where: { deletedAt: null },
                    select: {
                        role: {
                            select: {
                                name: true,
                                rolePermissions: {
                                    where: { deletedAt: null },
                                    select: {
                                        modulePermission: {
                                            select: {
                                                module: { select: { name: true } },
                                                permission: { select: { name: true } },
                                                accessScope: true
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        if (!user) {
            return res.status(401).json({ success: false, error: 'User not found' });
        }

        res.json({
            id: user.id,
            email: user.email,
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName,
            phoneNumber: user.phoneNumber,
            profilePhoto: user.profilePhoto,
            middleName: user.middleName,
            createdAt: user.createdAt.toISOString(),
            roles: user.userRoles.map((ur) => ({
                name: ur.role.name,
                permissions: ur.role.rolePermissions.map((rp) => ({
                    module: rp.modulePermission.module.name,
                    permission: rp.modulePermission.permission.name,
                    scope: rp.modulePermission.accessScope
                }))
            }))
        });
    } catch (error) {
        next(error);
    }
});

export default router;
