import { vi, describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// Mock rbac middleware to use a unique user ID and prevent test collisions
vi.mock('@/middleware/rbac.middleware', () => ({
    requireAccess: vi.fn(() => (req: Request, res: Response, next: NextFunction) => {
        req.user = {
            sub: 'test-supplier-user-id',
            email: 'testsupplier@example.com',
            username: 'testsupplieruser',
            roles: ['Administrator']
        };
        req.rbacScope = 'All';
        next();
    }),
    authenticate: vi.fn((req: Request, res: Response, next: NextFunction) => {
        req.user = {
            sub: 'test-supplier-user-id',
            email: 'testsupplier@example.com',
            username: 'testsupplieruser',
            roles: ['Administrator']
        };
        next();
    })
}));

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
import { PrismaClient } from '@prisma/client';
import supplierRouter from '@/feature/supplier/supplier.route';
import { HttpException } from '@/exceptions/http.exception';

describe('Supplier Feature CRUD', () => {
    let app: express.Application;
    let prisma: PrismaClient;

    let testSupplierId: string;

    beforeAll(async () => {
        prisma = new PrismaClient();
        app = express();

        app.use(express.json());
        app.use('/suppliers', supplierRouter);

        // Error handler
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        app.use((err: HttpException, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
            const status = err.statusCode || 500;
            res.status(status).json({ error: err.message });
        });

        // 1. Ensure isolated mock user record exists
        await prisma.user.upsert({
            where: { id: 'test-supplier-user-id' },
            update: {},
            create: {
                id: 'test-supplier-user-id',
                email: 'testsupplier@example.com',
                username: 'testsupplieruser',
                password: 'hashedpassword123',
                firstName: 'Test',
                lastName: 'User'
            }
        });
    });

    afterAll(async () => {
        // Cleanup all records created
        await prisma.supplier.deleteMany({
            where: {
                createdById: 'test-supplier-user-id'
            }
        });

        await prisma.user.deleteMany({
            where: {
                id: 'test-supplier-user-id'
            }
        });

        await prisma.$disconnect();
    });

    // ========================================================================
    // SUPPLIER CRUD TESTS
    // ========================================================================
    describe('Supplier Management CRUD Operations', () => {
        it('should create a new supplier successfully', async () => {
            const payload = {
                name: 'Test Coffee Roasters',
                address: '123 Espresso Way, Coffee City',
                contactPerson: 'Juan Dela Cruz',
                contactNumber: '+639171234567',
                notes: 'Premium local coffee bean supplier'
            };

            const res = await request(app).post('/suppliers').send(payload);
            expect(res.status).toBe(201);
            expect(res.body).toHaveProperty('id');
            expect(res.body.name).toBe('Test Coffee Roasters');
            expect(res.body.address).toBe('123 Espresso Way, Coffee City');
            expect(res.body.contactPerson).toBe('Juan Dela Cruz');
            expect(res.body.contactNumber).toBe('+639171234567');
            expect(res.body.notes).toBe('Premium local coffee bean supplier');

            testSupplierId = res.body.id;
        });

        it('should return 409 when creating supplier with duplicate name', async () => {
            const payload = {
                name: 'Test Coffee Roasters'
            };

            const res = await request(app).post('/suppliers').send(payload);
            expect(res.status).toBe(409);
        });

        it('should fetch the list of suppliers', async () => {
            const res = await request(app).get('/suppliers?limit=10');
            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('data');
            expect(res.body).toHaveProperty('meta');
            expect(res.body.data.length).toBeGreaterThanOrEqual(1);

            const found = res.body.data.find((s: { id: string }) => s.id === testSupplierId);
            expect(found).toBeDefined();
            expect(found.name).toBe('Test Coffee Roasters');
        });

        it('should retrieve a single supplier by ID', async () => {
            const res = await request(app).get(`/suppliers/${testSupplierId}`);
            expect(res.status).toBe(200);
            expect(res.body.id).toBe(testSupplierId);
            expect(res.body.name).toBe('Test Coffee Roasters');
        });

        it('should update a supplier successfully', async () => {
            const payload = {
                name: 'Updated Coffee Roasters',
                address: '456 Brew Street, Coffee City',
                contactPerson: 'Maria Clara',
                contactNumber: '+639187654321',
                notes: 'Updated notes'
            };

            const res = await request(app).put(`/suppliers/${testSupplierId}`).send(payload);
            expect(res.status).toBe(200);
            expect(res.body.name).toBe('Updated Coffee Roasters');
            expect(res.body.address).toBe('456 Brew Street, Coffee City');
            expect(res.body.contactPerson).toBe('Maria Clara');
            expect(res.body.contactNumber).toBe('+639187654321');
            expect(res.body.notes).toBe('Updated notes');
        });

        it('should soft-delete a supplier', async () => {
            const res = await request(app).delete(`/suppliers/${testSupplierId}`);
            expect(res.status).toBe(200);

            // Verify soft-deleted
            const deleted = await prisma.supplier.findUnique({
                where: { id: testSupplierId }
            });
            expect(deleted?.deletedAt).not.toBeNull();
        });
    });
});
