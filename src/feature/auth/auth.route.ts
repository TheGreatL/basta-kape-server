import { Router, type Request, type Response, type NextFunction } from 'express';
import { registry } from '@/docs/swagger';
import { AuthService } from './auth.service';
import { LoginSchema, RegisterSchema, AuthTokenResponseSchema } from './auth.types';
import { z } from 'zod';
import { ActivityLogService } from '@/feature/activity-log/activity-log.service';
import rateLimit from 'express-rate-limit';

const router = Router();
const authService = new AuthService();
const activityLogService = new ActivityLogService();

const loginRateLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 5, // 5 attempts per windowMs
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

        // Omit refreshToken from JSON response
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { refreshToken, ...responsePayload } = result;
        res.json(responsePayload);
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

        // Omit refreshToken from JSON response
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { refreshToken, ...responsePayload } = result;
        res.status(201).json(responsePayload);
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
                    schema: z.object({ accessToken: z.string() })
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
        res.json(result);
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

export default router;
