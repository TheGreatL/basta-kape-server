import { vi, describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

vi.mock('@/middleware/rbac.middleware', () => ({
    requireAccess: vi.fn(() => (req: Request, res: Response, next: NextFunction) => {
        req.user = {
            sub: 'test-activity-log-user-id',
            email: 'activitytest@example.com',
            username: 'activitytestuser',
            roles: ['Administrator']
        };
        next();
    }),
    authenticate: vi.fn((req: Request, res: Response, next: NextFunction) => {
        req.user = {
            sub: 'test-activity-log-user-id',
            email: 'activitytest@example.com',
            username: 'activitytestuser',
            roles: ['Administrator']
        };
        next();
    })
}));

import request from 'supertest';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import activityLogRouter from '@/feature/activity-log/activity-log.route';
import { HttpException } from '@/exceptions/http.exception';

describe('Activity Logs Integration Tests', () => {
    let app: express.Application;
    let prisma: PrismaClient;
    let createdLogId: string;

    beforeAll(async () => {
        prisma = new PrismaClient();
        app = express();

        app.use(express.json());
        app.use('/activity-logs', activityLogRouter);

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        app.use((err: HttpException, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
            const status = err.statusCode || 500;
            res.status(status).json({ error: err.message });
        });

        // Seed test user
        await prisma.user.upsert({
            where: { id: 'test-activity-log-user-id' },
            update: {},
            create: {
                id: 'test-activity-log-user-id',
                email: 'activitytest@example.com',
                username: 'activitytestuser',
                password: 'hashedpassword123',
                firstName: 'Activity',
                lastName: 'Test',
                role: {
                    connectOrCreate: {
                        where: { name: 'Administrator' },
                        create: { name: 'Administrator', isSystem: true }
                    }
                }
            }
        });

        // Create sample activity log
        const log = await prisma.activityLog.create({
            data: {
                actorId: 'test-activity-log-user-id',
                title: 'Test Log Action',
                details: 'Test details for activity log audit'
            }
        });
        createdLogId = log.id;
    });

    afterAll(async () => {
        if (createdLogId) {
            await prisma.activityLog.deleteMany({
                where: { actorId: 'test-activity-log-user-id' }
            });
        }
        await prisma.user.delete({ where: { id: 'test-activity-log-user-id' } }).catch(() => {});
        await prisma.$disconnect();
    });

    describe('GET /activity-logs', () => {
        it('should return paginated activity logs list', async () => {
            const res = await request(app).get('/activity-logs?page=1&limit=10');

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('data');
            expect(res.body).toHaveProperty('meta');
            expect(res.body.data.length).toBeGreaterThanOrEqual(1);

            const found = res.body.data.find((log: { id: string }) => log.id === createdLogId);
            expect(found).toBeDefined();
            expect(found.title).toBe('Test Log Action');
            expect(found.actor).toBeDefined();
            expect(found.actor.firstName).toBe('Activity');
            expect(found.actor.email).toBe('activitytest@example.com');
        });

        it('should filter activity logs by search query', async () => {
            const res = await request(app).get('/activity-logs?search=Test+Log+Action');

            expect(res.status).toBe(200);
            expect(res.body.data.length).toBeGreaterThanOrEqual(1);
            expect(res.body.data.some((log: { title: string }) => log.title.includes('Test Log Action'))).toBe(true);
        });

        it('should filter activity logs by date range', async () => {
            const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

            const res = await request(app).get(`/activity-logs?dateFrom=${yesterday}&dateTo=${tomorrow}`);

            expect(res.status).toBe(200);
            expect(res.body.data.length).toBeGreaterThanOrEqual(1);
        });
    });
});
