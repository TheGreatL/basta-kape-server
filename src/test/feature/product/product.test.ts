import { vi, describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// Mock rbac middleware to use a unique user ID and prevent test collisions
vi.mock('@/middleware/rbac.middleware', () => ({
    requireAccess: vi.fn(() => (req: Request, res: Response, next: NextFunction) => {
        req.user = {
            sub: 'test-product-user-id',
            email: 'testproduct@example.com',
            username: 'testproductuser',
            roles: ['Administrator']
        };
        req.rbacScope = 'All';
        next();
    }),
    authenticate: vi.fn((req: Request, res: Response, next: NextFunction) => {
        req.user = {
            sub: 'test-product-user-id',
            email: 'testproduct@example.com',
            username: 'testproductuser',
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
import productRouter from '@/feature/product/product.route';
import { HttpException } from '@/exceptions/http.exception';

describe('Product Feature CRUD & Transactional Mappings', () => {
    let app: express.Application;
    let prisma: PrismaClient;

    // Seed variables for tests
    let testCategoryId: string;
    let testTypeId: string;
    let sizeAttributeId: string;
    let mediumValueId: string;
    let largeValueId: string;

    // Generated IDs inside tests
    let testProductId: string;
    let testVariantId: string;
    let secondVariantId: string;

    beforeAll(async () => {
        prisma = new PrismaClient();
        app = express();

        app.use(express.json());
        app.use('/products', productRouter);

        // Error handler
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        app.use((err: HttpException, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
            const status = err.statusCode || 500;
            res.status(status).json({ error: err.message });
        });

        // 1. Ensure isolated mock user record exists for FK constraints
        await prisma.user.upsert({
            where: { id: 'test-product-user-id' },
            update: {},
            create: {
                id: 'test-product-user-id',
                email: 'testproduct@example.com',
                username: 'testproductuser',
                password: 'hashedpassword123',
                firstName: 'Test',
                lastName: 'User'
            }
        });

        // 2. Create isolated Category & Type setup records
        const category = await prisma.productCategory.create({
            data: {
                name: 'Test Product Category',
                description: 'For testing product CRUD',
                createdById: 'test-product-user-id',
                updatedById: 'test-product-user-id'
            }
        });
        testCategoryId = category.id;

        const ptype = await prisma.productType.create({
            data: {
                name: 'Test Product Type',
                description: 'For testing product CRUD',
                createdById: 'test-product-user-id',
                updatedById: 'test-product-user-id'
            }
        });
        ptype.deletedAt = null; // ensure not deleted
        testTypeId = ptype.id;

        // 3. Create isolated attributes and values (e.g. Size: Medium, Large)
        const sizeAttr = await prisma.productAttribute.create({
            data: {
                name: 'Test Size',
                description: 'For testing variants',
                createdById: 'test-product-user-id',
                updatedById: 'test-product-user-id'
            }
        });
        sizeAttributeId = sizeAttr.id;

        const medVal = await prisma.productAttributeValue.create({
            data: {
                productAttributeId: sizeAttributeId,
                value: 'Test Medium',
                createdById: 'test-product-user-id',
                updatedById: 'test-product-user-id'
            }
        });
        mediumValueId = medVal.id;

        const lrgVal = await prisma.productAttributeValue.create({
            data: {
                productAttributeId: sizeAttributeId,
                value: 'Test Large',
                createdById: 'test-product-user-id',
                updatedById: 'test-product-user-id'
            }
        });
        largeValueId = lrgVal.id;
    });

    afterAll(async () => {
        // Cleanup all records created in correct dependency order
        // 1. Delete Variant Attributes
        await prisma.productVariantAttribute.deleteMany({
            where: {
                createdById: 'test-product-user-id'
            }
        });

        // 2. Delete Variants
        await prisma.productVariant.deleteMany({
            where: {
                createdById: 'test-product-user-id'
            }
        });

        // 3. Delete Products
        await prisma.product.deleteMany({
            where: {
                createdById: 'test-product-user-id'
            }
        });

        // 4. Delete Attribute Values
        await prisma.productAttributeValue.deleteMany({
            where: {
                id: { in: [mediumValueId, largeValueId] }
            }
        });

        // 5. Delete Attributes
        await prisma.productAttribute.deleteMany({
            where: {
                id: sizeAttributeId
            }
        });

        // 6. Delete Category & Type
        await prisma.productCategory.deleteMany({
            where: {
                id: testCategoryId
            }
        });
        await prisma.productType.deleteMany({
            where: {
                id: testTypeId
            }
        });

        // 7. Delete User
        await prisma.user.deleteMany({
            where: {
                id: 'test-product-user-id'
            }
        });

        await prisma.$disconnect();
    });

    // ========================================================================
    // 1. PRODUCTS CRUD TESTS
    // ========================================================================
    describe('Products Management CRUD', () => {
        it('should create a new product successfully', async () => {
            const payload = {
                name: 'Test Cappuccino',
                description: 'A rich double shot espresso with velvety milk',
                photo: 'https://images.unsplash.com/photo-1534778101976-62847782c213',
                productCategoryId: testCategoryId,
                productTypeId: testTypeId
            };

            const res = await request(app).post('/products').send(payload);
            expect(res.status).toBe(201);
            expect(res.body).toHaveProperty('id');
            expect(res.body.name).toBe('Test Cappuccino');
            expect(res.body.description).toBe('A rich double shot espresso with velvety milk');
            expect(res.body.photo).toBe('https://images.unsplash.com/photo-1534778101976-62847782c213');
            expect(res.body.productCategoryId).toBe(testCategoryId);
            expect(res.body.productTypeId).toBe(testTypeId);

            testProductId = res.body.id;
        });

        it('should return 409 when creating product with duplicate name', async () => {
            const payload = {
                name: 'Test Cappuccino',
                productCategoryId: testCategoryId
            };

            const res = await request(app).post('/products').send(payload);
            expect(res.status).toBe(409);
        });

        it('should fetch the list of products', async () => {
            const res = await request(app).get('/products?limit=10');
            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('data');
            expect(res.body).toHaveProperty('meta');
            expect(res.body.data.length).toBeGreaterThanOrEqual(1);

            const found = res.body.data.find(
                (p: { id: string; name: string; category: { name: string }; type: { name: string } }) => p.id === testProductId
            );
            expect(found).toBeDefined();
            expect(found.name).toBe('Test Cappuccino');
            expect(found.category.name).toBe('Test Product Category');
            expect(found.type.name).toBe('Test Product Type');
        });

        it('should retrieve a single product by ID', async () => {
            const res = await request(app).get(`/products/${testProductId}`);
            expect(res.status).toBe(200);
            expect(res.body.id).toBe(testProductId);
            expect(res.body.name).toBe('Test Cappuccino');
            expect(res.body.category).toBeDefined();
            expect(res.body.category.name).toBe('Test Product Category');
        });

        it('should update a product successfully', async () => {
            const payload = {
                name: 'Updated Test Cappuccino',
                description: 'Updated espresso description'
            };

            const res = await request(app).put(`/products/${testProductId}`).send(payload);
            expect(res.status).toBe(200);
            expect(res.body.name).toBe('Updated Test Cappuccino');
            expect(res.body.description).toBe('Updated espresso description');
        });
    });

    // ========================================================================
    // 2. PRODUCT VARIANTS CRUD TESTS
    // ========================================================================
    describe('Product Variants Management CRUD', () => {
        it('should create a product variant with attributes', async () => {
            const payload = {
                sku: 'TEST-CAPPUCCINO-LRG',
                price: 150.5,
                attributeValueIds: [largeValueId]
            };

            const res = await request(app).post(`/products/${testProductId}/variants`).send(payload);

            expect(res.status).toBe(201);
            expect(res.body).toHaveProperty('id');
            expect(res.body.sku).toBe('TEST-CAPPUCCINO-LRG');
            expect(res.body.price).toBe(150.5);
            expect(res.body.attributes.length).toBe(1);
            expect(res.body.attributes[0].productAttributeValueId).toBe(largeValueId);
            expect(res.body.attributes[0].attributeValue.value).toBe('Test Large');
            expect(res.body.attributes[0].attributeValue.attribute.name).toBe('Test Size');

            testVariantId = res.body.id;
        });

        it('should prevent creating a duplicate variant SKU', async () => {
            const payload = {
                sku: 'TEST-CAPPUCCINO-LRG',
                price: 120.0
            };

            const res = await request(app).post(`/products/${testProductId}/variants`).send(payload);

            expect(res.status).toBe(409);
        });

        it('should retrieve a single variant by ID', async () => {
            const res = await request(app).get(`/products/variants/${testVariantId}`);
            expect(res.status).toBe(200);
            expect(res.body.id).toBe(testVariantId);
            expect(res.body.sku).toBe('TEST-CAPPUCCINO-LRG');
            expect(res.body.product.name).toBe('Updated Test Cappuccino');
            expect(res.body.attributes[0].attributeValue.value).toBe('Test Large');
        });

        it('should update a variant price and attributes successfully', async () => {
            const payload = {
                price: 165.0,
                sku: 'TEST-CAPPUCCINO-MED',
                attributeValueIds: [mediumValueId] // switch from large to medium
            };

            const res = await request(app).put(`/products/variants/${testVariantId}`).send(payload);

            expect(res.status).toBe(200);
            expect(res.body.sku).toBe('TEST-CAPPUCCINO-MED');
            expect(res.body.price).toBe(165.0);
            expect(res.body.attributes.length).toBe(1);
            expect(res.body.attributes[0].productAttributeValueId).toBe(mediumValueId);
            expect(res.body.attributes[0].attributeValue.value).toBe('Test Medium');
        });

        it('should soft-delete a product variant', async () => {
            const res = await request(app).delete(`/products/variants/${testVariantId}`);
            expect(res.status).toBe(200);

            // Verify soft-deleted
            const deletedVariant = await prisma.productVariant.findUnique({
                where: { id: testVariantId }
            });
            expect(deletedVariant?.deletedAt).not.toBeNull();

            // Verify mapping is soft deleted too
            const joins = await prisma.productVariantAttribute.findMany({
                where: { productVariantId: testVariantId }
            });
            joins.forEach((j) => {
                expect(j.deletedAt).not.toBeNull();
            });
        });
    });

    // ========================================================================
    // 3. CASCADE SOFT DELETE TESTS
    // ========================================================================
    describe('Product Cascading Soft-Delete', () => {
        it('should cascade soft-delete variants when deleting the parent product', async () => {
            // 1. Create second variant under our product
            const variantPayload = {
                sku: 'TEST-CAPPUCCINO-LRG-2',
                price: 180.0,
                attributeValueIds: [largeValueId]
            };

            const variantRes = await request(app).post(`/products/${testProductId}/variants`).send(variantPayload);
            expect(variantRes.status).toBe(201);
            secondVariantId = variantRes.body.id;

            // 2. Soft-delete the parent product
            const deleteRes = await request(app).delete(`/products/${testProductId}`);
            expect(deleteRes.status).toBe(200);

            // 3. Verify parent product soft deleted
            const deletedProduct = await prisma.product.findUnique({
                where: { id: testProductId }
            });
            expect(deletedProduct?.deletedAt).not.toBeNull();

            // 4. Verify variants cascade soft deleted
            const cascadeVariant = await prisma.productVariant.findUnique({
                where: { id: secondVariantId }
            });
            expect(cascadeVariant?.deletedAt).not.toBeNull();

            // 5. Verify join attributes cascade soft deleted
            const cascadeJoins = await prisma.productVariantAttribute.findMany({
                where: { productVariantId: secondVariantId }
            });
            cascadeJoins.forEach((j) => {
                expect(j.deletedAt).not.toBeNull();
            });
        });
    });
});
