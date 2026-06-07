import { vi, describe, it, expect, beforeAll, afterAll } from 'vitest';

// Mock activity log service
vi.mock('@/feature/activity-log/activity-log.service', () => {
    return {
        ActivityLogService: class {
            logActivity = vi.fn().mockResolvedValue(true);
        }
    };
});

import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import { PrismaClient } from '@prisma/client';
import authRouter from '@/feature/auth/auth.route';
import { HttpException } from '@/exceptions/http.exception';

describe('Auth Feature Integration Tests', () => {
    let app: express.Application;
    let prisma: PrismaClient;
    let registeredUserId: string;
    let validRefreshToken: string;

    const testUser = {
        email: 'authtest@example.com',
        username: 'authtestuser',
        password: 'Password123!',
        firstName: 'Auth',
        lastName: 'Test'
    };

    beforeAll(async () => {
        prisma = new PrismaClient();
        app = express();

        app.use(express.json());
        app.use(cookieParser());
        app.use('/auth', authRouter);

        // Error handler
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        app.use((err: HttpException, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
            const status = err.statusCode || 400;
            res.status(status).json({ error: err.message });
        });

        // Pre-clean database if test user got stuck
        const stuckUser = await prisma.user.findFirst({
            where: { OR: [{ email: testUser.email }, { username: testUser.username }] }
        });
        if (stuckUser) {
            await prisma.refreshToken.deleteMany({ where: { userId: stuckUser.id } });
            await prisma.userRole.deleteMany({ where: { userId: stuckUser.id } });
            await prisma.user.delete({ where: { id: stuckUser.id } });
        }
    });

    afterAll(async () => {
        if (registeredUserId) {
            await prisma.refreshToken.deleteMany({ where: { userId: registeredUserId } });
            await prisma.userRole.deleteMany({ where: { userId: registeredUserId } });
            await prisma.user.delete({ where: { id: registeredUserId } });
        }
        await prisma.$disconnect();
    });

    describe('POST /auth/register', () => {
        it('should successfully register a new user', async () => {
            const res = await request(app).post('/auth/register').send(testUser);

            expect(res.status).toBe(201);
            expect(res.body).toHaveProperty('user');
            expect(res.body).toHaveProperty('accessToken');
            expect(res.body).not.toHaveProperty('refreshToken');
            expect(res.headers['set-cookie']).toBeDefined();
            expect(res.headers['set-cookie'][0]).toMatch(/refreshToken=/);
            expect(res.body.user.username).toBe(testUser.username);
            expect(res.body.user.email).toBe(testUser.email);

            registeredUserId = res.body.user.id;
        });

        it('should fail with 400 when registration fields are invalid', async () => {
            const invalidUser = {
                email: 'invalid-email',
                username: 'u', // too short
                password: '1', // too short
                firstName: '',
                lastName: ''
            };

            const res = await request(app).post('/auth/register').send(invalidUser);

            expect(res.status).toBe(400);
        });

        it('should fail with 409 conflict when email or username is already taken', async () => {
            const res = await request(app).post('/auth/register').send(testUser);

            expect(res.status).toBe(409);
        });
    });

    describe('POST /auth/login', () => {
        it('should login successfully with valid email and password', async () => {
            const res = await request(app).post('/auth/login').set('x-skip-rate-limit', 'true').send({
                identifier: testUser.email,
                password: testUser.password
            });

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('user');
            expect(res.body).toHaveProperty('accessToken');
            expect(res.body).not.toHaveProperty('refreshToken');

            expect(res.headers['set-cookie']).toBeDefined();
            expect(res.headers['set-cookie'][0]).toMatch(/refreshToken=/);

            // Extract just the token value for later use
            const cookieString = res.headers['set-cookie'][0];
            validRefreshToken = cookieString.split(';')[0].split('=')[1];
        });

        it('should login successfully with valid username and password', async () => {
            const res = await request(app).post('/auth/login').set('x-skip-rate-limit', 'true').send({
                identifier: testUser.username,
                password: testUser.password
            });

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('accessToken');
        });

        it('should fail with 401 for invalid credentials', async () => {
            const res = await request(app).post('/auth/login').set('x-skip-rate-limit', 'true').send({
                identifier: testUser.email,
                password: 'WrongPassword!'
            });

            expect(res.status).toBe(401);
        });

        it('should fail with 429 Too Many Requests after 5 login attempts', async () => {
            // Explicitly make 5 failed login attempts to hit the rate limit
            for (let i = 0; i < 5; i++) {
                await request(app).post('/auth/login').send({ identifier: 'test-rate-limit', password: '123' });
            }

            // The 6th attempt should be blocked by the rate limiter
            const res = await request(app).post('/auth/login').send({ identifier: 'test-rate-limit', password: '123' });
            expect(res.status).toBe(429);
        });
    });

    describe('POST /auth/refresh', () => {
        it('should issue a new access token for a valid refresh token', async () => {
            const res = await request(app)
                .post('/auth/refresh')
                .set('Cookie', [`refreshToken=${validRefreshToken}`]);

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('accessToken');
        });

        it('should fail with 401 for an invalid or revoked refresh token', async () => {
            const res = await request(app).post('/auth/refresh').send({ refreshToken: 'invalid-refresh-token-format' });

            expect(res.status).toBe(401);
        });
    });

    describe('POST /auth/logout', () => {
        it('should successfully revoke the refresh token on logout', async () => {
            const res = await request(app)
                .post('/auth/logout')
                .set('Cookie', [`refreshToken=${validRefreshToken}`]);

            expect(res.status).toBe(200);
            expect(res.body).toEqual({ success: true });

            // Trying to refresh again with the same token should now fail
            const refreshRes = await request(app)
                .post('/auth/refresh')
                .set('Cookie', [`refreshToken=${validRefreshToken}`]);

            expect(refreshRes.status).toBe(401);
        });
    });

    describe('Password Reset and Change Operations', () => {
        let resetToken: string;
        let testUserAccessToken: string;

        beforeAll(async () => {
            // Log in to get a valid accessToken for change-password test
            const loginRes = await request(app).post('/auth/login').set('x-skip-rate-limit', 'true').send({
                identifier: testUser.email,
                password: testUser.password
            });
            testUserAccessToken = loginRes.body.accessToken;
        });

        // --- FORGOT PASSWORD ---
        it('should generate a password reset token for registered email', async () => {
            const res = await request(app).post('/auth/forgot-password').send({ email: testUser.email });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.resetToken).toBeDefined();
            resetToken = res.body.resetToken;
        });

        it('should return 200 generic message even if email is not found', async () => {
            const res = await request(app).post('/auth/forgot-password').send({ email: 'nonexistent@example.com' });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.resetToken).toBeUndefined();
        });

        // --- RESET PASSWORD ---
        it('should fail to reset password with invalid token', async () => {
            const res = await request(app).post('/auth/reset-password').send({ token: 'invalid-token', newPassword: 'NewPassword123!' });

            expect(res.status).toBe(400);
        });

        it('should successfully reset password with valid token', async () => {
            const res = await request(app).post('/auth/reset-password').send({ token: resetToken, newPassword: 'NewPassword123!' });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);

            // Attempt login with new password
            const loginRes = await request(app).post('/auth/login').set('x-skip-rate-limit', 'true').send({
                identifier: testUser.email,
                password: 'NewPassword123!'
            });
            expect(loginRes.status).toBe(200);
            testUserAccessToken = loginRes.body.accessToken;
            testUser.password = 'NewPassword123!';
        }, 15000);

        // --- CHANGE PASSWORD ---
        it('should fail to change password with incorrect old password', async () => {
            const payload = {
                oldPassword: 'IncorrectPassword!',
                newPassword: 'FinalPassword123!'
            };

            const res = await request(app).post('/auth/change-password').set('Authorization', `Bearer ${testUserAccessToken}`).send(payload);

            expect(res.status).toBe(400);
        });

        it('should successfully change password with valid credentials', async () => {
            const payload = {
                oldPassword: testUser.password,
                newPassword: 'FinalPassword123!'
            };

            const res = await request(app).post('/auth/change-password').set('Authorization', `Bearer ${testUserAccessToken}`).send(payload);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);

            // Check login with final password
            const loginRes = await request(app).post('/auth/login').set('x-skip-rate-limit', 'true').send({
                identifier: testUser.email,
                password: 'FinalPassword123!'
            });
            expect(loginRes.status).toBe(200);
            testUser.password = 'FinalPassword123!';
        }, 15000);
    });
});
