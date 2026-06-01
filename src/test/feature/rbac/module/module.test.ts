import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import moduleRouter from '@/feature/rbac/module/module.route';
import { HttpException } from '@/exceptions/http.exception';

describe('Module Feature (RBAC) - GET /', () => {
    let app: express.Application;
    let prisma: PrismaClient;

    beforeAll(async () => {
        prisma = new PrismaClient();
        app = express();

        // Mount the module router
        app.use('/modules', moduleRouter);

        // Mock error handler to catch Zod validation errors cleanly instead of returning HTML traces
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        app.use((err: HttpException, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
            res.status(400).json({ error: err.message });
        });
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    it('should return a paginated list of modules', async () => {
        const response = await request(app).get('/modules/list?limit=5');

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('data');
        expect(response.body).toHaveProperty('meta');

        // Check pagination meta structure
        expect(response.body.meta).toHaveProperty('total');
        expect(response.body.meta.currentPage).toBe(1);
        expect(Array.isArray(response.body.data)).toBe(true);
        expect(response.body.data.length).toBeLessThanOrEqual(5);
    });

    it('should filter modules by search term (case-insensitive)', async () => {
        // "Users Management" is one of the modules seeded in the DB
        const response = await request(app).get('/modules/list?search=Users');

        expect(response.status).toBe(200);
        expect(response.body.data.length).toBeGreaterThan(0);
        expect(response.body.data[0].name).toContain('Users');
    });

    it('should return 400 if pagination parameters are invalid strings', async () => {
        // Expecting Zod coercion/validation to fail
        const response = await request(app).get('/modules/list?page=abc');
        expect(response.status).toBe(400);
    });
});
