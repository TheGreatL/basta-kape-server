import { vi, describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// Mock rbac middleware to use a unique user ID and bypass checks
vi.mock('@/middleware/rbac.middleware', () => ({
    requireAccess: vi.fn(() => (req: Request, res: Response, next: NextFunction) => {
        req.user = {
            sub: 'test-deduct-user-id',
            email: 'testdeduct@example.com',
            username: 'testdeductuser',
            roles: ['Manager']
        };
        req.rbacScope = 'All';
        next();
    }),
    authenticate: vi.fn((req: Request, res: Response, next: NextFunction) => {
        req.user = {
            sub: 'test-deduct-user-id',
            email: 'testdeduct@example.com',
            username: 'testdeductuser',
            roles: ['Manager']
        };
        next();
    })
}));

import request from 'supertest';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import orderRouter from '@/feature/order/order.route';
import modifierRouter from '@/feature/modifier/modifier.route';
import inventoryRouter from '@/feature/inventory/inventory.route';
import { HttpException } from '@/exceptions/http.exception';

interface IForecast {
    variantId: string;
    productId?: string;
    name: string;
    sku?: string | null;
    price?: number;
    hasRecipe?: boolean;
    maxProduceable: number | string | null;
    ingredients: {
        ingredientId: string;
        name: string;
        currentQuantity: number;
        requiredQuantity: number;
        unit: string;
        canProduce: number | string;
    }[];
}

describe('Inventory Stock Deduction and Modifier Recipes Integration', () => {
    let app: express.Application;
    let prisma: PrismaClient;

    // Seed variables
    let testCategoryId: string;
    let testTypeId: string;
    let testProductId: string;
    let testVariantId: string;
    let testUnitId: string;
    let testBeansIngredientId: string;
    let testMilkIngredientId: string;
    let testModifierGroupId: string;
    let testModifierOptionId: string;
    const testCustomerId = '9d2274b7-d1a1-43bb-a53b-0145be8a3b8b'; // Valid UUID

    beforeAll(async () => {
        prisma = new PrismaClient();
        app = RouterAndAppSetup();

        // 1. Create mock user
        await prisma.user.upsert({
            where: { id: 'test-deduct-user-id' },
            update: {},
            create: {
                id: 'test-deduct-user-id',
                email: 'testdeduct@example.com',
                username: 'testdeductuser',
                password: 'hashedpassword123',
                firstName: 'Manager',
                lastName: 'User'
            }
        });

        // 2. Create customer with valid UUID
        await prisma.customer.upsert({
            where: { id: testCustomerId },
            update: {},
            create: {
                id: testCustomerId,
                userId: 'test-deduct-user-id'
            }
        });

        // 3. Setup Category & Type
        const category = await prisma.productCategory.create({
            data: {
                name: 'Deduct Category',
                description: 'Testing deductions',
                createdById: 'test-deduct-user-id',
                updatedById: 'test-deduct-user-id'
            }
        });
        testCategoryId = category.id;

        const ptype = await prisma.productType.create({
            data: {
                name: 'Deduct Type',
                description: 'Testing deductions',
                createdById: 'test-deduct-user-id',
                updatedById: 'test-deduct-user-id'
            }
        });
        testTypeId = ptype.id;

        // 4. Create Unit & Ingredients
        const unit = await prisma.ingredientUnit.create({
            data: {
                name: 'Units Deduct',
                abbreviation: 'u-ded',
                createdById: 'test-deduct-user-id',
                updatedById: 'test-deduct-user-id'
            }
        });
        testUnitId = unit.id;

        // Espresso beans
        const beans = await prisma.ingredient.create({
            data: {
                name: 'Deduct Espresso Beans',
                ingredientUnitId: testUnitId,
                reorderPoint: 50.0,
                createdById: 'test-deduct-user-id',
                updatedById: 'test-deduct-user-id'
            }
        });
        testBeansIngredientId = beans.id;

        // Clean any auto-created inventories and create them explicitly to have correct quantities
        await prisma.ingredientInventory.deleteMany({ where: { ingredientId: testBeansIngredientId } });
        await prisma.ingredientInventory.create({
            data: {
                ingredientId: testBeansIngredientId,
                currentQuantity: 200.0,
                status: 'SAFE',
                createdById: 'test-deduct-user-id',
                updatedById: 'test-deduct-user-id'
            }
        });

        // Oat Milk
        const milk = await prisma.ingredient.create({
            data: {
                name: 'Deduct Oat Milk',
                ingredientUnitId: testUnitId,
                reorderPoint: 1000.0,
                createdById: 'test-deduct-user-id',
                updatedById: 'test-deduct-user-id'
            }
        });
        testMilkIngredientId = milk.id;

        // Clean any auto-created inventories and create explicitly
        await prisma.ingredientInventory.deleteMany({ where: { ingredientId: testMilkIngredientId } });
        await prisma.ingredientInventory.create({
            data: {
                ingredientId: testMilkIngredientId,
                currentQuantity: 5000.0,
                status: 'SAFE',
                createdById: 'test-deduct-user-id',
                updatedById: 'test-deduct-user-id'
            }
        });

        // 5. Setup Product & Variant
        const product = await prisma.product.create({
            data: {
                name: 'Deduct Double Espresso',
                description: 'Strong espresso',
                productCategoryId: testCategoryId,
                productTypeId: testTypeId,
                createdById: 'test-deduct-user-id',
                updatedById: 'test-deduct-user-id'
            }
        });
        testProductId = product.id;

        const variant = await prisma.productVariant.create({
            data: {
                productId: testProductId,
                sku: 'SKU-DEDUCT-ESPRESSO',
                price: 120.0,
                createdById: 'test-deduct-user-id',
                updatedById: 'test-deduct-user-id'
            }
        });
        testVariantId = variant.id;

        // Create base recipe for Double Espresso variant: requires 18g beans
        await prisma.recipe.create({
            data: {
                name: 'Espresso Recipe',
                productVariantId: testVariantId,
                createdById: 'test-deduct-user-id',
                updatedById: 'test-deduct-user-id',
                ingredients: {
                    create: {
                        ingredientId: testBeansIngredientId,
                        quantity: 18.0,
                        ingredientUnitId: testUnitId,
                        createdById: 'test-deduct-user-id',
                        updatedById: 'test-deduct-user-id'
                    }
                }
            }
        });

        // 6. Setup Modifiers
        const modGroup = await prisma.modifierGroup.create({
            data: {
                name: 'Deduct Milk Custom',
                isRequired: false,
                minSelect: 0,
                maxSelect: 1,
                products: { connect: { id: testProductId } }
            }
        });
        testModifierGroupId = modGroup.id;

        const modOption = await prisma.modifierOption.create({
            data: {
                modifierGroupId: testModifierGroupId,
                name: 'Deduct Oat Milk Choice',
                price: 35.0
            }
        });
        testModifierOptionId = modOption.id;
    });

    function RouterAndAppSetup() {
        const expressApp = express();
        expressApp.use(express.json());
        expressApp.use('/orders', orderRouter);
        expressApp.use('/modifiers', modifierRouter);
        expressApp.use('/inventory', inventoryRouter);

        // Error handler
        expressApp.use((err: HttpException, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
            void _next;
            const status = err.statusCode || 500;
            res.status(status).json({ error: err.message });
        });
        return expressApp;
    }

    afterAll(async () => {
        // Cleanup database records in correct sequence
        await prisma.orderStatusHistory.deleteMany({
            where: { order: { customerId: testCustomerId } }
        });
        await prisma.orderItemModifier.deleteMany({
            where: { modifierOption: { modifierGroupId: testModifierGroupId } }
        });
        await prisma.orderItem.deleteMany({
            where: { productVariantId: testVariantId }
        });
        await prisma.order.deleteMany({
            where: { customerId: testCustomerId }
        });
        await prisma.recipeIngredient.deleteMany({ where: { createdById: 'test-deduct-user-id' } });
        await prisma.recipe.deleteMany({ where: { createdById: 'test-deduct-user-id' } });
        await prisma.modifierOption.deleteMany({ where: { id: testModifierOptionId } });
        await prisma.modifierGroup.deleteMany({ where: { id: testModifierGroupId } });
        await prisma.productVariant.deleteMany({ where: { createdById: 'test-deduct-user-id' } });
        await prisma.product.deleteMany({ where: { createdById: 'test-deduct-user-id' } });
        await prisma.ingredientInventory.deleteMany({ where: { createdById: 'test-deduct-user-id' } });
        await prisma.ingredient.deleteMany({ where: { createdById: 'test-deduct-user-id' } });
        await prisma.ingredientUnit.deleteMany({ where: { createdById: 'test-deduct-user-id' } });
        await prisma.productCategory.deleteMany({ where: { createdById: 'test-deduct-user-id' } });
        await prisma.productType.deleteMany({ where: { createdById: 'test-deduct-user-id' } });
        await prisma.customer.deleteMany({ where: { id: testCustomerId } });
        await prisma.user.deleteMany({ where: { id: 'test-deduct-user-id' } });

        await prisma.$disconnect();
    });

    describe('Modifier Recipes CRUD & Seeding checks', () => {
        it('should return 404 when modifier option recipe is missing', async () => {
            const res = await request(app).get(`/modifiers/options/${testModifierOptionId}/recipe`);
            expect(res.status).toBe(404);
            expect(res.body.error).toMatch(/Recipe not found/);
        });

        it('should successfully configure a recipe for the modifier option', async () => {
            const recipeData = {
                name: 'Oat Milk Modifier Recipe',
                description: 'Uses 200 units of oat milk',
                ingredients: [
                    {
                        ingredientId: testMilkIngredientId,
                        quantity: 200.0,
                        ingredientUnitId: testUnitId
                    }
                ]
            };

            const res = await request(app).post(`/modifiers/options/${testModifierOptionId}/recipe`).send(recipeData);
            if (res.status !== 201) {
                console.error('Create Modifier Option Recipe Error:', res.body);
            }

            expect(res.status).toBe(201);
            expect(res.body).toHaveProperty('id');
            expect(res.body.name).toBe('Oat Milk Modifier Recipe');
            expect(res.body.modifierOptionId).toBe(testModifierOptionId);
            expect(res.body.ingredients).toHaveLength(1);
            expect(res.body.ingredients[0].ingredientId).toBe(testMilkIngredientId);
            expect(res.body.ingredients[0].quantity).toBe(200.0);
        });
    });

    describe('Inventory Forecasting & Projections', () => {
        it('should compute and include modifier option capacities in the forecast', async () => {
            const res = await request(app).get('/inventory/forecast');
            expect(res.status).toBe(200);

            // Double Espresso: 200g / 18g = 11 units max produceable
            const variantForecast = res.body.find((f: IForecast) => f.variantId === testVariantId);
            expect(variantForecast).toBeDefined();
            expect(variantForecast.maxProduceable).toBe(11);
            expect(variantForecast.ingredients[0].currentQuantity).toBe(200);

            // Oat Milk modifier: 5000ml / 200ml = 25 units max produceable
            const modifierForecast = res.body.find((f: IForecast) => f.variantId === testModifierOptionId);
            expect(modifierForecast).toBeDefined();
            expect(modifierForecast.name).toBe('[Modifier] Deduct Oat Milk Choice');
            expect(modifierForecast.maxProduceable).toBe(25);
            expect(modifierForecast.ingredients[0].currentQuantity).toBe(5000);
        });
    });

    describe('Automatic Stock Deduction', () => {
        let orderId: string;

        it('should place an order without immediately deducting stock (PENDING status)', async () => {
            const orderPayload = {
                orderType: 'TAKE_OUT',
                orderSource: 'MOBILE_APP',
                customerId: testCustomerId,
                customerName: 'Test Buyer',
                items: [
                    {
                        productVariantId: testVariantId,
                        quantity: 2,
                        notes: 'Extra hot',
                        modifierOptionIds: [testModifierOptionId]
                    }
                ]
            };

            const res = await request(app).post('/orders').send(orderPayload);
            if (res.status !== 201) {
                console.error('Create Order Error:', res.body);
            }
            expect(res.status).toBe(201);
            expect(res.body).toHaveProperty('id');
            orderId = res.body.id;

            // Verify stocks are STILL 200 and 5000
            const beansInv = await prisma.ingredientInventory.findFirst({
                where: { ingredientId: testBeansIngredientId }
            });
            const milkInv = await prisma.ingredientInventory.findFirst({
                where: { ingredientId: testMilkIngredientId }
            });

            expect(beansInv?.currentQuantity).toBe(200);
            expect(milkInv?.currentQuantity).toBe(5000);
        });

        it('should deduct ingredients when the order status changes to COMPLETED', async () => {
            // Update order status to COMPLETED
            const res = await request(app).patch(`/orders/${orderId}/status`).send({
                status: 'COMPLETED',
                notes: 'Order serves completed'
            });

            if (res.status !== 200) {
                console.error('Update Order Status to COMPLETED Error:', res.body);
            }

            expect(res.status).toBe(200);
            expect(res.body.status).toBe('COMPLETED');

            // Verify stock levels are now deducted correctly
            // Beans deduction: 18 * 2 = 36 -> 200 - 36 = 164
            // Milk deduction: 200 * 2 = 400 -> 5000 - 400 = 4600
            const beansInv = await prisma.ingredientInventory.findFirst({
                where: { ingredientId: testBeansIngredientId }
            });
            const milkInv = await prisma.ingredientInventory.findFirst({
                where: { ingredientId: testMilkIngredientId }
            });

            expect(beansInv?.currentQuantity).toBe(164);
            expect(milkInv?.currentQuantity).toBe(4600);

            // Reorder checks:
            // Beans: 164 > 50 (SAFE)
            // Milk: 4600 > 1000 (SAFE)
            expect(beansInv?.status).toBe('SAFE');
            expect(milkInv?.status).toBe('SAFE');
        });

        it('should not perform duplicate stock deductions if updated to COMPLETED again', async () => {
            // Re-update to COMPLETED
            const res = await request(app).patch(`/orders/${orderId}/status`).send({
                status: 'COMPLETED',
                notes: 'Redundant update check'
            });

            if (res.status !== 200) {
                console.error('Redundant Status Update Error:', res.body);
            }
            expect(res.status).toBe(200);

            // Verify stocks remained identical (no duplicate deduction)
            const beansInv = await prisma.ingredientInventory.findFirst({
                where: { ingredientId: testBeansIngredientId }
            });
            const milkInv = await prisma.ingredientInventory.findFirst({
                where: { ingredientId: testMilkIngredientId }
            });

            expect(beansInv?.currentQuantity).toBe(164);
            expect(milkInv?.currentQuantity).toBe(4600);
        });

        it('should update inventory status to CRITICAL or OUT_OF_STOCK if deductions cross reorder point', async () => {
            // Let's create another order that will exhaust beans:
            // Beans required per espresso item: 18
            // Stock remaining: 164.
            // If we order 8 units: 18 * 8 = 144 units.
            // Remaining Beans stock: 164 - 144 = 20.
            // Reorder point is 50. So it should become CRITICAL!
            const orderPayload2 = {
                orderType: 'TAKE_OUT',
                orderSource: 'MOBILE_APP',
                customerId: testCustomerId,
                customerName: 'Test Buyer 2',
                items: [
                    {
                        productVariantId: testVariantId,
                        quantity: 8,
                        modifierOptionIds: []
                    }
                ]
            };

            const resOrder = await request(app).post('/orders').send(orderPayload2);
            expect(resOrder.status).toBe(201);
            const orderId2 = resOrder.body.id;

            // Complete the order
            const resComplete2 = await request(app).patch(`/orders/${orderId2}/status`).send({
                status: 'COMPLETED'
            });
            expect(resComplete2.status).toBe(200);

            const beansInv = await prisma.ingredientInventory.findFirst({
                where: { ingredientId: testBeansIngredientId }
            });
            expect(beansInv?.currentQuantity).toBe(20);
            expect(beansInv?.status).toBe('CRITICAL');

            // Let's order another 2 units: 18 * 2 = 36 units.
            // Current quantity is 20, so 20 - 36 = -16 -> guarded to 0.
            // Status should become OUT_OF_STOCK.
            const orderPayload3 = {
                orderType: 'TAKE_OUT',
                orderSource: 'MOBILE_APP',
                customerId: testCustomerId,
                customerName: 'Test Buyer 3',
                items: [
                    {
                        productVariantId: testVariantId,
                        quantity: 2,
                        modifierOptionIds: []
                    }
                ]
            };

            const resOrder3 = await request(app).post('/orders').send(orderPayload3);
            expect(resOrder3.status).toBe(201);
            const orderId3 = resOrder3.body.id;

            // Complete the order
            const resComplete3 = await request(app).patch(`/orders/${orderId3}/status`).send({
                status: 'COMPLETED'
            });
            expect(resComplete3.status).toBe(200);

            const beansInvFinal = await prisma.ingredientInventory.findFirst({
                where: { ingredientId: testBeansIngredientId }
            });
            expect(beansInvFinal?.currentQuantity).toBe(0);
            expect(beansInvFinal?.status).toBe('OUT_OF_STOCK');
        });
    });
});
