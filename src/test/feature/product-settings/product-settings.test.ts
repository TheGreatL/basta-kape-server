import { vi, describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// Mock rbac middleware to use a unique user ID and prevent test collisions
vi.mock('@/middleware/rbac.middleware', () => ({
    requireAccess: vi.fn(() => (req: Request, res: Response, next: NextFunction) => {
        req.user = {
            sub: 'test-product-settings-user-id',
            email: 'testproductsettings@example.com',
            username: 'testproductsettingsuser',
            roles: ['Administrator']
        };
        req.rbacScope = 'All';
        next();
    }),
    authenticate: vi.fn((req: Request, res: Response, next: NextFunction) => {
        req.user = {
            sub: 'test-product-settings-user-id',
            email: 'testproductsettings@example.com',
            username: 'testproductsettingsuser',
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
import productSettingsRouter from '@/feature/product-settings/product-settings.route';
import { HttpException } from '@/exceptions/http.exception';

describe('Product Settings Feature CRUD', () => {
    let app: express.Application;
    let prisma: PrismaClient;

    // Test IDs
    let testCategoryId: string;
    let testTypeId: string;
    let testAttributeId: string;
    let testAttributeValueId: string;
    let activeAttributeId: string;

    beforeAll(async () => {
        prisma = new PrismaClient();
        app = express();

        app.use(express.json());
        app.use('/product-settings', productSettingsRouter);

        // Error handler
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        app.use((err: HttpException, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
            const status = err.statusCode || 500;
            res.status(status).json({ error: err.message });
        });

        // Ensure we have a unique mock user record for referential integrity in this test suite
        await prisma.user.upsert({
            where: { id: 'test-product-settings-user-id' },
            update: {},
            create: {
                id: 'test-product-settings-user-id',
                email: 'testproductsettings@example.com',
                username: 'testproductsettingsuser',
                password: 'hashedpassword123',
                firstName: 'Test',
                lastName: 'User'
            }
        });
    });

    afterAll(async () => {
        // Cleanup created values in reverse order to satisfy foreign key constraints
        if (testAttributeValueId) {
            await prisma.productAttributeValue.deleteMany({ where: { id: testAttributeValueId } });
        }
        if (activeAttributeId) {
            await prisma.productAttributeValue.deleteMany({ where: { productAttributeId: activeAttributeId } });
            await prisma.productAttribute.deleteMany({ where: { id: activeAttributeId } });
        }
        if (testAttributeId) {
            await prisma.productAttribute.deleteMany({ where: { id: testAttributeId } });
        }
        if (testTypeId) {
            await prisma.productType.deleteMany({ where: { id: testTypeId } });
        }
        if (testCategoryId) {
            await prisma.productCategory.deleteMany({ where: { id: testCategoryId } });
        }
        // Cleanup test user
        await prisma.user.deleteMany({ where: { id: 'test-product-settings-user-id' } });
        await prisma.$disconnect();
    });

    // ==========================================
    // 1. PRODUCT CATEGORIES TESTS
    // ==========================================
    describe('Product Categories CRUD', () => {
        it('should create a new product category', async () => {
            const payload = {
                name: 'Test Category',
                description: 'This is a test category'
            };

            const res = await request(app).post('/product-settings/categories').send(payload);
            expect(res.status).toBe(201);
            expect(res.body).toHaveProperty('id');
            expect(res.body.name).toBe('Test Category');
            expect(res.body.description).toBe('This is a test category');
            testCategoryId = res.body.id;
        });

        it('should prevent creating a duplicate category name', async () => {
            const payload = {
                name: 'Test Category'
            };

            const res = await request(app).post('/product-settings/categories').send(payload);
            expect(res.status).toBe(409);
        });

        it('should retrieve a paginated list of categories', async () => {
            const res = await request(app).get('/product-settings/categories?limit=5');
            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('data');
            expect(res.body).toHaveProperty('meta');
            expect(res.body.meta.currentPage).toBe(1);
        });

        it('should find a category by ID', async () => {
            const res = await request(app).get(`/product-settings/categories/${testCategoryId}`);
            expect(res.status).toBe(200);
            expect(res.body.name).toBe('Test Category');
        });

        it('should update a category by ID', async () => {
            const payload = {
                name: 'Updated Test Category',
                description: 'This is an updated description'
            };

            const res = await request(app).put(`/product-settings/categories/${testCategoryId}`).send(payload);
            expect(res.status).toBe(200);
            expect(res.body.name).toBe('Updated Test Category');
            expect(res.body.description).toBe('This is an updated description');
        });

        it('should soft-delete a category by ID', async () => {
            const res = await request(app).delete(`/product-settings/categories/${testCategoryId}`);
            expect(res.status).toBe(200);

            // Verify soft-deleted
            const deleted = await prisma.productCategory.findUnique({
                where: { id: testCategoryId }
            });
            expect(deleted?.deletedAt).not.toBeNull();
        });
    });

    // ==========================================
    // 2. PRODUCT TYPES TESTS
    // ==========================================
    describe('Product Types CRUD', () => {
        it('should create a new product type', async () => {
            const payload = {
                name: 'Test Type',
                description: 'This is a test type'
            };

            const res = await request(app).post('/product-settings/types').send(payload);
            expect(res.status).toBe(201);
            expect(res.body).toHaveProperty('id');
            expect(res.body.name).toBe('Test Type');
            testTypeId = res.body.id;
        });

        it('should prevent duplicate type name', async () => {
            const payload = {
                name: 'Test Type'
            };

            const res = await request(app).post('/product-settings/types').send(payload);
            expect(res.status).toBe(409);
        });

        it('should update a type by ID', async () => {
            const payload = {
                name: 'Updated Test Type'
            };

            const res = await request(app).put(`/product-settings/types/${testTypeId}`).send(payload);
            expect(res.status).toBe(200);
            expect(res.body.name).toBe('Updated Test Type');
        });

        it('should soft-delete a type by ID', async () => {
            const res = await request(app).delete(`/product-settings/types/${testTypeId}`);
            expect(res.status).toBe(200);

            // Verify soft-deleted
            const deleted = await prisma.productType.findUnique({
                where: { id: testTypeId }
            });
            expect(deleted?.deletedAt).not.toBeNull();
        });
    });

    // ==========================================
    // 3. PRODUCT ATTRIBUTES TESTS
    // ==========================================
    describe('Product Attributes CRUD', () => {
        it('should create a new product attribute', async () => {
            const payload = {
                name: 'Test Size Attribute',
                description: 'Test attribute size'
            };

            const res = await request(app).post('/product-settings/attributes').send(payload);
            expect(res.status).toBe(201);
            expect(res.body).toHaveProperty('id');
            expect(res.body.name).toBe('Test Size Attribute');
            testAttributeId = res.body.id;
        });

        it('should update an attribute by ID', async () => {
            const payload = {
                name: 'Updated Size Attribute'
            };

            const res = await request(app).put(`/product-settings/attributes/${testAttributeId}`).send(payload);
            expect(res.status).toBe(200);
            expect(res.body.name).toBe('Updated Size Attribute');
        });

        it('should soft-delete an attribute by ID', async () => {
            const res = await request(app).delete(`/product-settings/attributes/${testAttributeId}`);
            expect(res.status).toBe(200);

            // Verify soft-deleted
            const deleted = await prisma.productAttribute.findUnique({
                where: { id: testAttributeId }
            });
            expect(deleted?.deletedAt).not.toBeNull();
        });
    });

    // ==========================================
    // 4. PRODUCT ATTRIBUTE VALUES TESTS
    // ==========================================
    describe('Product Attribute Values CRUD', () => {
        beforeAll(async () => {
            // Seed a fresh active attribute for child tests since the previous was soft-deleted
            const attr = await prisma.productAttribute.create({
                data: {
                    name: 'Active Test Attr',
                    createdById: 'test-product-settings-user-id',
                    updatedById: 'test-product-settings-user-id'
                }
            });
            activeAttributeId = attr.id;
        });

        it('should create a new product attribute value', async () => {
            const payload = {
                productAttributeId: activeAttributeId,
                value: 'Test Value 1'
            };

            const res = await request(app).post('/product-settings/attribute-values').send(payload);
            expect(res.status).toBe(201);
            expect(res.body).toHaveProperty('id');
            expect(res.body.value).toBe('Test Value 1');
            testAttributeValueId = res.body.id;
        });

        it('should prevent duplicate attribute value in the same attribute group', async () => {
            const payload = {
                productAttributeId: activeAttributeId,
                value: 'Test Value 1'
            };

            const res = await request(app).post('/product-settings/attribute-values').send(payload);
            expect(res.status).toBe(409);
        });

        it('should list all attribute values for a specific attribute ID', async () => {
            const res = await request(app).get(`/product-settings/attributes/${activeAttributeId}/values`);
            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('data');
            expect(res.body.data.length).toBeGreaterThanOrEqual(1);
            expect(res.body.data[0].value).toBe('Test Value 1');
        });

        it('should update an attribute value by ID', async () => {
            const payload = {
                value: 'Updated Value'
            };

            const res = await request(app).put(`/product-settings/attribute-values/${testAttributeValueId}`).send(payload);
            expect(res.status).toBe(200);
            expect(res.body.value).toBe('Updated Value');
        });

        it('should soft-delete an attribute value by ID', async () => {
            const res = await request(app).delete(`/product-settings/attribute-values/${testAttributeValueId}`);
            expect(res.status).toBe(200);

            // Verify soft-deleted
            const deleted = await prisma.productAttributeValue.findUnique({
                where: { id: testAttributeValueId }
            });
            expect(deleted?.deletedAt).not.toBeNull();
        });
    });
});
