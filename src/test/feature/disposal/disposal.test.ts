import { vi, describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// Mock rbac middleware
vi.mock('@/middleware/rbac.middleware', () => ({
    requireAccess: vi.fn(() => (req: Request, res: Response, next: NextFunction) => {
        req.user = {
            sub: 'test-disposal-user-id',
            email: 'testdisposal@example.com',
            username: 'testdisposaluser',
            roles: ['Administrator']
        };
        next();
    }),
    authenticate: vi.fn((req: Request, res: Response, next: NextFunction) => {
        req.user = {
            sub: 'test-disposal-user-id',
            email: 'testdisposal@example.com',
            username: 'testdisposaluser',
            roles: ['Administrator']
        };
        next();
    })
}));

import request from 'supertest';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import disposalRouter from '@/feature/disposal/disposal.route';
import { HttpException } from '@/exceptions/http.exception';

describe('Unified Waste & Disposal Log Integration', () => {
    let app: express.Application;
    let prisma: PrismaClient;

    const testActorId = 'test-disposal-user-id';
    let testIngredientId: string;
    let testUnitId: string;
    let testIngredientBatchId: string;
    let testStockTrxId: string;

    let testTypeId: string;
    let testCategoryId: string;
    let testProductId: string;
    let testVariantId: string;
    let testPreparedBatchId: string;
    let testPreparedTrxId: string;

    beforeAll(async () => {
        prisma = new PrismaClient();

        // 1. Ensure user exists
        await prisma.user.upsert({
            where: { id: testActorId },
            update: {},
            create: {
                id: testActorId,
                email: 'testdisposal@example.com',
                username: 'testdisposaluser',
                password: 'password123',
                firstName: 'Disposal',
                lastName: 'Tester',
                role: {
                    connectOrCreate: {
                        where: { name: 'Administrator' },
                        create: { name: 'Administrator', description: 'Admin' }
                    }
                }
            }
        });

        // 2. Create Raw Ingredient & Waste Transaction
        const unit = await prisma.ingredientUnit.create({
            data: { name: 'liters ' + Date.now(), abbreviation: 'L', createdById: testActorId, updatedById: testActorId }
        });
        testUnitId = unit.id;

        const ingredient = await prisma.ingredient.create({
            data: {
                name: 'Test Disposal Milk ' + Date.now(),
                type: 'INGREDIENT',
                ingredientUnitId: testUnitId,
                createdById: testActorId,
                updatedById: testActorId
            }
        });
        testIngredientId = ingredient.id;

        const ingBatch = await prisma.ingredientBatch.create({
            data: {
                ingredientId: testIngredientId,
                batchNumber: 'RAW-BATCH-' + Date.now(),
                quantityReceived: 50,
                currentQuantity: 45,
                unitCost: 60,
                totalCost: 3000,
                createdById: testActorId,
                updatedById: testActorId
            }
        });
        testIngredientBatchId = ingBatch.id;

        const stockTrx = await prisma.stockTransaction.create({
            data: {
                batchId: testIngredientBatchId,
                quantityChange: -5,
                type: 'WASTE',
                reason: 'Spilled carton during rush hour',
                createdById: testActorId
            }
        });
        testStockTrxId = stockTrx.id;

        // 3. Create Prepared Food Product & Disposal Transaction
        const type = await prisma.productType.create({
            data: { name: 'Disposal Food Type ' + Date.now(), createdById: testActorId, updatedById: testActorId }
        });
        testTypeId = type.id;

        const category = await prisma.productCategory.create({
            data: {
                name: 'Disposal Cookie Category ' + Date.now(),
                productTypeId: testTypeId,
                createdById: testActorId,
                updatedById: testActorId
            }
        });
        testCategoryId = category.id;

        const product = await prisma.product.create({
            data: {
                name: 'Test Disposal Cookie ' + Date.now(),
                productCategoryId: testCategoryId,
                productTypeId: testTypeId,
                preparationType: 'PREPARED_DISPLAY',
                defaultShelfLife: 1440,
                createdById: testActorId,
                updatedById: testActorId
            }
        });
        testProductId = product.id;

        const variant = await prisma.productVariant.create({
            data: {
                productId: testProductId,
                sku: 'DISP-COOKIE-' + Date.now(),
                price: 85,
                createdById: testActorId,
                updatedById: testActorId
            }
        });
        testVariantId = variant.id;

        const prepBatch = await prisma.preparedItemBatch.create({
            data: {
                productVariantId: testVariantId,
                productId: testProductId,
                batchNumber: 'PREP-BATCH-' + Date.now(),
                quantityPrepared: 10,
                currentQuantity: 8,
                preparedAt: new Date(),
                shelfLifeMinutes: 1440,
                expiresAt: new Date(Date.now() + 86400000),
                status: 'FRESH',
                createdById: testActorId,
                updatedById: testActorId
            }
        });
        testPreparedBatchId = prepBatch.id;

        const prepTrx = await prisma.preparedItemTransaction.create({
            data: {
                batchId: testPreparedBatchId,
                quantityChange: -2,
                type: 'EXPIRED',
                reason: 'Unsold expired display cookies',
                createdById: testActorId
            }
        });
        testPreparedTrxId = prepTrx.id;

        // Express Setup
        app = express();
        app.use(express.json());
        app.use('/disposals', disposalRouter);

        app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
            void _next;
            if (err instanceof HttpException) {
                res.status(err.statusCode).json({ message: err.message });
            } else {
                res.status(500).json({ message: err.message });
            }
        });
    });

    afterAll(async () => {
        // Clean up test records
        await prisma.preparedItemTransaction.deleteMany({ where: { batchId: testPreparedBatchId } });
        await prisma.preparedItemBatch.deleteMany({ where: { id: testPreparedBatchId } });
        await prisma.productVariant.deleteMany({ where: { id: testVariantId } });
        await prisma.product.deleteMany({ where: { id: testProductId } });
        await prisma.productCategory.deleteMany({ where: { id: testCategoryId } });
        await prisma.productType.deleteMany({ where: { id: testTypeId } });

        await prisma.stockTransaction.deleteMany({ where: { batchId: testIngredientBatchId } });
        await prisma.ingredientBatch.deleteMany({ where: { id: testIngredientBatchId } });
        await prisma.ingredient.deleteMany({ where: { id: testIngredientId } });
        await prisma.ingredientUnit.deleteMany({ where: { id: testUnitId } });

        await prisma.$disconnect();
    });

    it('1. should retrieve unified disposal logs containing both prepared food and raw ingredients', async () => {
        const response = await request(app).get('/disposals').query({ category: 'ALL' });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('data');
        expect(response.body).toHaveProperty('meta');

        const records = response.body.data;
        const foundRaw = records.find((r: { id: string }) => r.id === testStockTrxId);
        const foundPrep = records.find((r: { id: string }) => r.id === testPreparedTrxId);

        expect(foundRaw).toBeDefined();
        expect(foundRaw.category).toBe('RAW_INGREDIENT');
        expect(foundRaw.quantity).toBe(5);
        expect(foundRaw.estimatedCostLoss).toBe(300); // 5 * 60

        expect(foundPrep).toBeDefined();
        expect(foundPrep.category).toBe('PREPARED_FOOD');
        expect(foundPrep.quantity).toBe(2);
        expect(foundPrep.estimatedCostLoss).toBe(170); // 2 * 85
    });

    it('2. should filter disposal logs by category: PREPARED_FOOD', async () => {
        const response = await request(app).get('/disposals').query({ category: 'PREPARED_FOOD' });

        expect(response.status).toBe(200);
        const records = response.body.data;
        expect(records.every((r: { category: string }) => r.category === 'PREPARED_FOOD')).toBe(true);
        expect(records.some((r: { id: string }) => r.id === testPreparedTrxId)).toBe(true);
        expect(records.some((r: { id: string }) => r.id === testStockTrxId)).toBe(false);
    });

    it('3. should filter disposal logs by category: RAW_INGREDIENT', async () => {
        const response = await request(app).get('/disposals').query({ category: 'RAW_INGREDIENT' });

        expect(response.status).toBe(200);
        const records = response.body.data;
        expect(records.every((r: { category: string }) => r.category === 'RAW_INGREDIENT')).toBe(true);
        expect(records.some((r: { id: string }) => r.id === testStockTrxId)).toBe(true);
        expect(records.some((r: { id: string }) => r.id === testPreparedTrxId)).toBe(false);
    });

    it('4. should filter disposal logs by reason', async () => {
        const response = await request(app).get('/disposals').query({ reason: 'EXPIRED' });

        expect(response.status).toBe(200);
        const records = response.body.data;
        expect(records.every((r: { reason: string }) => r.reason === 'EXPIRED')).toBe(true);
    });

    it('5. should retrieve summary financial loss metrics', async () => {
        const response = await request(app).get('/disposals/summary');

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('totalFinancialLoss');
        expect(response.body).toHaveProperty('preparedFoodLoss');
        expect(response.body).toHaveProperty('rawIngredientLoss');
        expect(response.body.totalFinancialLoss).toBeGreaterThanOrEqual(470); // 300 + 170
        expect(response.body.preparedFoodLoss).toBeGreaterThanOrEqual(170);
        expect(response.body.rawIngredientLoss).toBeGreaterThanOrEqual(300);
        expect(response.body.topWastedItems.length).toBeGreaterThan(0);
    });
});
