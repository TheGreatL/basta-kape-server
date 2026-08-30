import { vi, describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// Mock rbac middleware
vi.mock('@/middleware/rbac.middleware', () => ({
    requireAccess: vi.fn(() => (req: Request, res: Response, next: NextFunction) => {
        req.user = {
            sub: 'test-food-prep-user-id',
            email: 'testfoodprep@example.com',
            username: 'testfoodprepuser',
            roles: ['Administrator']
        };
        next();
    }),
    authenticate: vi.fn((req: Request, res: Response, next: NextFunction) => {
        req.user = {
            sub: 'test-food-prep-user-id',
            email: 'testfoodprep@example.com',
            username: 'testfoodprepuser',
            roles: ['Administrator']
        };
        next();
    })
}));

import request from 'supertest';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import foodPrepRouter from '@/feature/food-prep/food-prep.route';
import orderRouter from '@/feature/order/order.route';
import menuRouter from '@/feature/menu/menu.route';
import { HttpException } from '@/exceptions/http.exception';

describe('Food Preparation & Display Inventory Feature Integration', () => {
    let app: express.Application;
    let prisma: PrismaClient;

    const testActorId = 'test-food-prep-user-id';
    let testTypeId: string;
    let testCategoryId: string;
    let testProductId: string;
    let testVariantId: string;
    let testUnitId: string;
    let testIngredientId: string;
    let testRecipeId: string;

    beforeAll(async () => {
        prisma = new PrismaClient();

        // 1. Ensure user exists
        await prisma.user.upsert({
            where: { id: testActorId },
            update: {},
            create: {
                id: testActorId,
                email: 'testfoodprep@example.com',
                username: 'testfoodprepuser',
                password: 'password123',
                firstName: 'FoodPrep',
                lastName: 'Tester',
                role: {
                    connectOrCreate: {
                        where: { name: 'Administrator' },
                        create: { name: 'Administrator', description: 'Admin' }
                    }
                }
            }
        });

        // 2. Create Type, Category, Product with PREPARED_DISPLAY
        const type = await prisma.productType.create({
            data: { name: 'Test Food Type ' + Date.now(), createdById: testActorId, updatedById: testActorId }
        });
        testTypeId = type.id;

        const category = await prisma.productCategory.create({
            data: {
                name: 'Test Cookie Category ' + Date.now(),
                productTypeId: testTypeId,
                createdById: testActorId,
                updatedById: testActorId
            }
        });
        testCategoryId = category.id;

        const product = await prisma.product.create({
            data: {
                name: 'Test Display Cookie ' + Date.now(),
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
                sku: 'TEST-COOKIE-' + Date.now(),
                price: 85,
                createdById: testActorId,
                updatedById: testActorId
            }
        });
        testVariantId = variant.id;

        // 3. Create Unit, Ingredient, Initial Batch
        const unit = await prisma.ingredientUnit.create({
            data: { name: 'pcs ' + Date.now(), abbreviation: 'pcs', createdById: testActorId, updatedById: testActorId }
        });
        testUnitId = unit.id;

        const ingredient = await prisma.ingredient.create({
            data: {
                name: 'Test Cookie Dough ' + Date.now(),
                type: 'INGREDIENT',
                ingredientUnitId: testUnitId,
                createdById: testActorId,
                updatedById: testActorId
            }
        });
        testIngredientId = ingredient.id;

        await prisma.ingredientInventory.create({
            data: {
                ingredientId: testIngredientId,
                currentQuantity: 100,
                createdById: testActorId,
                updatedById: testActorId
            }
        });

        await prisma.ingredientBatch.create({
            data: {
                ingredientId: testIngredientId,
                quantityReceived: 100,
                currentQuantity: 100,
                unitCost: 20,
                totalCost: 2000,
                createdById: testActorId,
                updatedById: testActorId
            }
        });

        // 4. Create Recipe for Variant (1 dough pcs per cookie)
        const recipe = await prisma.recipe.create({
            data: {
                name: 'Test Display Cookie Recipe',
                productVariantId: testVariantId,
                createdById: testActorId,
                updatedById: testActorId
            }
        });
        testRecipeId = recipe.id;

        await prisma.recipeIngredient.create({
            data: {
                recipeId: testRecipeId,
                ingredientId: testIngredientId,
                quantity: 1,
                ingredientUnitId: testUnitId,
                createdById: testActorId,
                updatedById: testActorId
            }
        });

        // Express Setup
        app = express();
        app.use(express.json());
        app.use('/food-prep', foodPrepRouter);
        app.use('/orders', orderRouter);
        app.use('/menu', menuRouter);

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
        await prisma.preparedItemTransaction.deleteMany({
            where: { batch: { productVariantId: testVariantId } }
        });
        await prisma.preparedItemBatch.deleteMany({
            where: { productVariantId: testVariantId }
        });
        await prisma.orderItem.deleteMany({
            where: { productVariantId: testVariantId }
        });
        await prisma.recipeIngredient.deleteMany({
            where: { recipeId: testRecipeId }
        });
        await prisma.recipe.deleteMany({
            where: { id: testRecipeId }
        });
        await prisma.productVariant.deleteMany({
            where: { id: testVariantId }
        });
        await prisma.product.deleteMany({
            where: { id: testProductId }
        });
        await prisma.productCategory.deleteMany({
            where: { id: testCategoryId }
        });
        await prisma.productType.deleteMany({
            where: { id: testTypeId }
        });
        await prisma.stockTransaction.deleteMany({
            where: { batch: { ingredientId: testIngredientId } }
        });
        await prisma.ingredientBatch.deleteMany({
            where: { ingredientId: testIngredientId }
        });
        await prisma.ingredientInventory.deleteMany({
            where: { ingredientId: testIngredientId }
        });
        await prisma.ingredient.deleteMany({
            where: { id: testIngredientId }
        });
        await prisma.ingredientUnit.deleteMany({
            where: { id: testUnitId }
        });
        await prisma.$disconnect();
    });

    let createdBatchId: string;

    it('1. should record fresh food preparation batch and deduct raw recipe ingredients', async () => {
        const response = await request(app).post('/food-prep/batches').send({
            productVariantId: testVariantId,
            quantity: 10,
            shelfLifeMinutes: 1440,
            notes: 'Morning fresh cookie bake'
        });

        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('id');
        expect(response.body.quantityPrepared).toBe(10);
        expect(response.body.currentQuantity).toBe(10);
        expect(response.body.status).toBe('FRESH');
        expect(response.body.product.name).toContain('Test Display Cookie');

        createdBatchId = response.body.id;

        // Verify raw ingredients were deducted by 10
        const updatedInventory = await prisma.ingredientInventory.findFirst({
            where: { ingredientId: testIngredientId }
        });
        expect(updatedInventory?.currentQuantity).toBe(90); // 100 - 10
    });

    it('2. should get display stock summary reflecting prepared units', async () => {
        const response = await request(app).get('/food-prep/summary');
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('totalFreshUnits');
        expect(response.body.totalFreshUnits).toBeGreaterThanOrEqual(10);

        const item = response.body.items.find((i: { productVariantId: string }) => i.productVariantId === testVariantId);
        expect(item).toBeDefined();
        expect(item.totalFreshQuantity).toBe(10);
    });

    it('3. should list prepared batches and get batch details', async () => {
        const listRes = await request(app).get('/food-prep/batches').query({ productVariantId: testVariantId });

        expect(listRes.status).toBe(200);
        expect(listRes.body.data.length).toBeGreaterThanOrEqual(1);

        const detailRes = await request(app).get(`/food-prep/batches/${createdBatchId}`);
        expect(detailRes.status).toBe(200);
        expect(detailRes.body.id).toBe(createdBatchId);
        expect(detailRes.body.currentQuantity).toBe(10);
    });

    it('4. should deduct from display batch on customer order WITHOUT re-deducting raw ingredients', async () => {
        const orderRes = await request(app)
            .post('/orders')
            .send({
                orderType: 'DINE_IN',
                orderSource: 'POS',
                subtotal: 170,
                taxAmount: 0,
                netTotal: 170,
                customerName: 'Cookie Customer',
                items: [
                    {
                        productVariantId: testVariantId,
                        quantity: 2,
                        unitPrice: 85,
                        totalPrice: 170
                    }
                ]
            });

        expect(orderRes.status).toBe(201);
        const orderId = orderRes.body.id;

        // Verify batch quantity dropped from 10 to 8
        const batch = await prisma.preparedItemBatch.findUnique({
            where: { id: createdBatchId }
        });
        expect(batch?.currentQuantity).toBe(8);

        // Verify raw ingredient inventory remained at 90 (NOT re-deducted)
        const inventory = await prisma.ingredientInventory.findFirst({
            where: { ingredientId: testIngredientId }
        });
        expect(inventory?.currentQuantity).toBe(90);

        // Cancel order to test restoration
        const cancelRes = await request(app).patch(`/orders/${orderId}/status`).send({ status: 'CANCELLED', notes: 'Customer cancelled' });

        expect(cancelRes.status).toBe(200);

        // Verify batch quantity restored back to 10
        const restoredBatch = await prisma.preparedItemBatch.findUnique({
            where: { id: createdBatchId }
        });
        expect(restoredBatch?.currentQuantity).toBe(10);
    });

    it('5. should dispose remaining units when expired or spoiled', async () => {
        const disposeRes = await request(app).post(`/food-prep/batches/${createdBatchId}/dispose`).send({
            quantity: 10,
            reason: 'EXPIRED',
            notes: 'End-of-day expiry write-off'
        });

        expect(disposeRes.status).toBe(200);
        expect(disposeRes.body.currentQuantity).toBe(0);
        expect(disposeRes.body.status).toBe('EXPIRED');

        // Verify transaction logged
        const trx = await prisma.preparedItemTransaction.findFirst({
            where: { batchId: createdBatchId, type: 'EXPIRED' }
        });
        expect(trx).toBeDefined();
        expect(trx?.quantityChange).toBe(-10);
    });
});
