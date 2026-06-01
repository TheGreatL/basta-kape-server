import { Router, type Request, type Response, type NextFunction } from 'express';
import { registry } from '@/docs/swagger';
import { AuthService } from './auth.service';
import { LoginSchema, RegisterSchema, AuthTokenResponseSchema } from './auth.types';
import { z } from 'zod';

const router = Router();
const authService = new AuthService();

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

router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { identifier, password } = LoginSchema.parse(req.body);
        const result = await authService.login(identifier, password);
        res.json(result);
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
        res.status(201).json(result);
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
        body: {
            content: {
                'application/json': {
                    schema: z.object({ refreshToken: z.string() })
                }
            }
        }
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
        const { refreshToken } = z.object({ refreshToken: z.string() }).parse(req.body);
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
        body: {
            content: {
                'application/json': {
                    schema: z.object({ refreshToken: z.string() })
                }
            }
        }
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
        const { refreshToken } = z.object({ refreshToken: z.string() }).parse(req.body);
        const result = await authService.logout(refreshToken);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

export default router;
