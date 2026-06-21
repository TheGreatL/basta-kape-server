import { vi, describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

vi.mock('@/middleware/rbac.middleware', () => ({
    requireAccess: vi.fn(() => (req: Request, res: Response, next: NextFunction) => {
        req.user = {
            sub: 'test-user-id',
            email: 'test@example.com',
            username: 'testuser',
            roles: ['Administrator']
        };
        req.rbacScope = 'All';
        next();
    })
}));
import request from 'supertest';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import permissionRouter from '@/feature/rbac/permission/permission.route';
import { HttpException } from '@/exceptions/http.exception';

describe('Permission Feature (RBAC) - GET /', () => {
    let app: express.Application;
    let prisma: PrismaClient;

    beforeAll(async () => {
        prisma = new PrismaClient();
        app = express();

        // Mount the permission router
        app.use('/permissions', permissionRouter);

        // Mock error handler to catch Zod validation errors cleanly
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        app.use((err: HttpException, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
            const status = err.statusCode || 400;
            res.status(status).json({ error: err.message });
        });

        // Ensure we have seeded permissions
        const permission = await prisma.permission.findFirst();
        if (!permission) {
            const { seedUsers } = await import('../../../../../prisma/seed/user.seed');
            await seedUsers(prisma);
        }
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    it('should return a paginated list of permissions', async () => {
        const response = await request(app).get('/permissions/list?limit=5');

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('data');
        expect(response.body).toHaveProperty('meta');

        // Check pagination meta structure
        expect(response.body.meta).toHaveProperty('total');
        expect(response.body.meta.currentPage).toBe(1);
        expect(Array.isArray(response.body.data)).toBe(true);
        expect(response.body.data.length).toBeLessThanOrEqual(5);
    });

    it('should filter permissions by search term (case-insensitive)', async () => {
        // "create" should match some permission names based on your seed file
        const response = await request(app).get('/permissions/list?search=create');

        expect(response.status).toBe(200);
        expect(response.body.data.length).toBeGreaterThan(0);
        expect(response.body.data[0].name.toLowerCase()).toContain('create');
    });

    it('should return 400 if pagination parameters are invalid strings', async () => {
        // Expecting Zod coercion/validation to fail
        const response = await request(app).get('/permissions/list?page=abc');
        expect(response.status).toBe(400);
    });
});
