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

describe('Product Bulk Variants Synchronization', () => {
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

        // 2. Create Category & Type
        const category = await prisma.productCategory.create({
            data: {
                name: 'Bulk Category',
                description: 'For testing bulk variants',
                createdById: 'test-product-user-id',
                updatedById: 'test-product-user-id'
            }
        });
        testCategoryId = category.id;

        const ptype = await prisma.productType.create({
            data: {
                name: 'Bulk Type',
                description: 'For testing bulk variants',
                createdById: 'test-product-user-id',
                updatedById: 'test-product-user-id'
            }
        });
        testTypeId = ptype.id;

        // 3. Create Attributes & Values
        const sizeAttr = await prisma.productAttribute.create({
            data: {
                name: 'Bulk Size',
                description: 'For testing bulk variants',
                createdById: 'test-product-user-id',
                updatedById: 'test-product-user-id'
            }
        });
        sizeAttributeId = sizeAttr.id;

        const medVal = await prisma.productAttributeValue.create({
            data: {
                productAttributeId: sizeAttributeId,
                value: 'Bulk Medium',
                createdById: 'test-product-user-id',
                updatedById: 'test-product-user-id'
            }
        });
        mediumValueId = medVal.id;

        const lrgVal = await prisma.productAttributeValue.create({
            data: {
                productAttributeId: sizeAttributeId,
                value: 'Bulk Large',
                createdById: 'test-product-user-id',
                updatedById: 'test-product-user-id'
            }
        });
        largeValueId = lrgVal.id;

        // 4. Create Product
        const product = await prisma.product.create({
            data: {
                name: 'Bulk Test Beverage',
                description: 'To test bulk sync of variants',
                productCategoryId: testCategoryId,
                productTypeId: testTypeId,
                createdById: 'test-product-user-id',
                updatedById: 'test-product-user-id'
            }
        });
        testProductId = product.id;
    });

    afterAll(async () => {
        // Cleanup in reverse order
        await prisma.productVariantAttribute.deleteMany({
            where: { createdById: 'test-product-user-id' }
        });

        await prisma.productVariant.deleteMany({
            where: { createdById: 'test-product-user-id' }
        });

        await prisma.product.deleteMany({
            where: { id: testProductId }
        });

        await prisma.productAttributeValue.deleteMany({
            where: { id: { in: [mediumValueId, largeValueId] } }
        });

        await prisma.productAttribute.deleteMany({
            where: { id: sizeAttributeId }
        });

        await prisma.productCategory.deleteMany({
            where: { id: testCategoryId }
        });

        await prisma.productType.deleteMany({
            where: { id: testTypeId }
        });

        await prisma.user.deleteMany({
            where: { id: 'test-product-user-id' }
        });

        await prisma.$disconnect();
    });

    it('should bulk synchronize product variants (insert new ones)', async () => {
        const payload = {
            variants: [
                {
                    sku: 'BULK-MED',
                    price: 100,
                    attributeValueIds: [mediumValueId]
                },
                {
                    sku: 'BULK-LRG',
                    price: 120,
                    attributeValueIds: [largeValueId]
                }
            ]
        };

        const res = await request(app).put(`/products/${testProductId}/variants/bulk`).send(payload);

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Product variants synchronized successfully');

        // Check DB state
        const variants = await prisma.productVariant.findMany({
            where: { productId: testProductId, deletedAt: null },
            include: { attributes: true }
        });

        expect(variants.length).toBe(2);
        const medVariant = variants.find((v) => v.sku === 'BULK-MED');
        const lrgVariant = variants.find((v) => v.sku === 'BULK-LRG');

        expect(medVariant).toBeDefined();
        expect(medVariant?.price).toBe(100);
        expect(medVariant?.attributes.length).toBe(1);
        expect(medVariant?.attributes[0].productAttributeValueId).toBe(mediumValueId);

        expect(lrgVariant).toBeDefined();
        expect(lrgVariant?.price).toBe(120);
        expect(lrgVariant?.attributes.length).toBe(1);
        expect(lrgVariant?.attributes[0].productAttributeValueId).toBe(largeValueId);
    });

    it('should bulk synchronize product variants (update existing & soft-delete omitted ones)', async () => {
        // Fetch current active variants to obtain existing IDs
        const existingVariants = await prisma.productVariant.findMany({
            where: { productId: testProductId, deletedAt: null }
        });
        const medVariant = existingVariants.find((v) => v.sku === 'BULK-MED')!;
        const lrgVariant = existingVariants.find((v) => v.sku === 'BULK-LRG')!;

        // We want to:
        // 1. Update BULK-MED price to 110 (passing its existing ID)
        // 2. Omit BULK-LRG (should be soft-deleted)
        // 3. Create a new standard variant with no attributes (e.g. general size)
        const payload = {
            variants: [
                {
                    id: medVariant.id,
                    sku: 'BULK-MED-UPDATED',
                    price: 110,
                    attributeValueIds: [mediumValueId]
                },
                {
                    sku: 'BULK-STANDARD',
                    price: 90,
                    attributeValueIds: []
                }
            ]
        };

        const res = await request(app).put(`/products/${testProductId}/variants/bulk`).send(payload);

        expect(res.status).toBe(200);

        // Verify active variants in DB
        const activeVariants = await prisma.productVariant.findMany({
            where: { productId: testProductId, deletedAt: null },
            include: { attributes: true }
        });

        expect(activeVariants.length).toBe(2);
        const updatedMed = activeVariants.find((v) => v.id === medVariant.id);
        const standardVar = activeVariants.find((v) => v.sku === 'BULK-STANDARD');

        expect(updatedMed).toBeDefined();
        expect(updatedMed?.sku).toBe('BULK-MED-UPDATED');
        expect(updatedMed?.price).toBe(110);

        expect(standardVar).toBeDefined();
        expect(standardVar?.price).toBe(90);
        expect(standardVar?.attributes.length).toBe(0);

        // Verify large variant was soft deleted
        const softDeletedLrg = await prisma.productVariant.findUnique({
            where: { id: lrgVariant.id }
        });
        expect(softDeletedLrg?.deletedAt).not.toBeNull();
    });
});
