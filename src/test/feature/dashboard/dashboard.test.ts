import { vi, describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

vi.mock('@/middleware/rbac.middleware', () => ({
    authenticate: vi.fn((req: Request, res: Response, next: NextFunction) => {
        req.user = {
            sub: 'test-dashboard-user-id',
            email: 'dashboardtest@example.com',
            username: 'dashboardtestuser',
            roles: ['Administrator']
        };
        next();
    }),
    requireAccess: vi.fn(() => (req: Request, res: Response, next: NextFunction) => {
        req.user = {
            sub: 'test-dashboard-user-id',
            email: 'dashboardtest@example.com',
            username: 'dashboardtestuser',
            roles: ['Administrator']
        };
        next();
    })
}));

import request from 'supertest';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import dashboardRouter from '@/feature/dashboard/dashboard.route';
import { HttpException } from '@/exceptions/http.exception';

describe('Dashboard Feature Integration Tests', () => {
    let app: express.Application;
    let prisma: PrismaClient;

    beforeAll(async () => {
        prisma = new PrismaClient();
        app = express();
        app.use(express.json());
        app.use('/dashboard', dashboardRouter);

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        app.use((err: HttpException, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
            const status = err.statusCode || 500;
            res.status(status).json({ error: err.message });
        });

        // Ensure test user with Administrator role exists in DB
        await prisma.user.upsert({
            where: { id: 'test-dashboard-user-id' },
            update: {},
            create: {
                id: 'test-dashboard-user-id',
                email: 'dashboardtest@example.com',
                username: 'dashboardtestuser',
                password: 'hashedpassword123',
                firstName: 'Dashboard',
                lastName: 'Admin',
                role: {
                    connectOrCreate: {
                        where: { name: 'Administrator' },
                        create: { name: 'Administrator', isSystem: true }
                    }
                }
            }
        });
    });

    afterAll(async () => {
        await prisma.user.delete({ where: { id: 'test-dashboard-user-id' } }).catch(() => {});
        await prisma.$disconnect();
    });

    describe('GET /dashboard/summary', () => {
        it('should retrieve consolidated dashboard summary for authenticated user', async () => {
            const res = await request(app).get('/dashboard/summary');

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('user');
            expect(res.body.user).toHaveProperty('username', 'dashboardtestuser');
            expect(res.body.user).toHaveProperty('firstName', 'Dashboard');
            expect(res.body.user).toHaveProperty('lastName', 'Admin');
        });
    });
});
