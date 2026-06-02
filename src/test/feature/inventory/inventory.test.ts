import { vi, describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// Mock rbac middleware to use a unique user ID for inventory tests
vi.mock('@/middleware/rbac.middleware', () => ({
    requireAccess: vi.fn(() => (req: Request, res: Response, next: NextFunction) => {
        req.user = {
            sub: 'test-inventory-user-id',
            email: 'testinventory@example.com',
            username: 'testinventoryuser',
            roles: ['Administrator']
        };
        req.rbacScope = 'All';
        next();
    }),
    authenticate: vi.fn((req: Request, res: Response, next: NextFunction) => {
        req.user = {
            sub: 'test-inventory-user-id',
            email: 'testinventory@example.com',
            username: 'testinventoryuser',
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
import { PrismaClient, InventoryStatus } from '@prisma/client';
import inventoryRouter from '@/feature/inventory/inventory.route';
import { HttpException } from '@/exceptions/http.exception';

describe('Inventory Feature CRUD & Synchronized Stocks', () => {
    let app: express.Application;
    let prisma: PrismaClient;

    // Test IDs
    let testUnitId: string;
    let testIngredientId: string;
    let testDeliveryId: string;
    let testAdjustmentId: string;

    beforeAll(async () => {
        prisma = new PrismaClient();
        app = express();

        app.use(express.json());
        app.use('/inventory', inventoryRouter);

        // Error handler
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        app.use((err: HttpException, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
            const status = err.statusCode || 500;
            res.status(status).json({ error: err.message });
        });

        // Ensure we have a unique mock user record for referential integrity in this test suite
        await prisma.user.upsert({
            where: { id: 'test-inventory-user-id' },
            update: {},
            create: {
                id: 'test-inventory-user-id',
                email: 'testinventory@example.com',
                username: 'testinventoryuser',
                password: 'hashedpassword123',
                firstName: 'Test',
                lastName: 'User'
            }
        });
    });

    afterAll(async () => {
        // Cleanup created values in reverse order to satisfy foreign key constraints
        if (testAdjustmentId) {
            await prisma.inventoryAdjustment.deleteMany({ where: { id: testAdjustmentId } });
        }
        if (testDeliveryId) {
            await prisma.ingredientDelivery.deleteMany({ where: { id: testDeliveryId } });
        }
        if (testIngredientId) {
            await prisma.ingredientInventory.deleteMany({ where: { ingredientId: testIngredientId } });
            await prisma.ingredient.deleteMany({ where: { id: testIngredientId } });
        }
        if (testUnitId) {
            await prisma.ingredientUnit.deleteMany({ where: { id: testUnitId } });
        }
        // Cleanup test user
        await prisma.user.deleteMany({ where: { id: 'test-inventory-user-id' } });
        await prisma.$disconnect();
    });

    // ==========================================
    // 1. INGREDIENT UNITS CRUD
    // ==========================================
    describe('Ingredient Units CRUD', () => {
        it('should create a new ingredient unit', async () => {
            const payload = {
                name: 'Test Liters',
                abbreviation: 'tL'
            };

            const res = await request(app).post('/inventory/units').send(payload);
            expect(res.status).toBe(201);
            expect(res.body).toHaveProperty('id');
            expect(res.body.name).toBe('Test Liters');
            expect(res.body.abbreviation).toBe('tL');
            testUnitId = res.body.id;
        });

        it('should prevent creating a duplicate unit name or abbreviation', async () => {
            const payload = {
                name: 'Test Liters',
                abbreviation: 'tL'
            };

            const res = await request(app).post('/inventory/units').send(payload);
            expect(res.status).toBe(409);
        });

        it('should retrieve a paginated list of units', async () => {
            const res = await request(app).get('/inventory/units?limit=5');
            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('data');
            expect(res.body).toHaveProperty('meta');
            expect(res.body.meta.currentPage).toBe(1);
        });

        it('should find a unit by ID', async () => {
            const res = await request(app).get(`/inventory/units/${testUnitId}`);
            expect(res.status).toBe(200);
            expect(res.body.name).toBe('Test Liters');
        });

        it('should update a unit by ID', async () => {
            const payload = {
                name: 'Updated Liters',
                abbreviation: 'utL'
            };

            const res = await request(app).put(`/inventory/units/${testUnitId}`).send(payload);
            expect(res.status).toBe(200);
            expect(res.body.name).toBe('Updated Liters');
            expect(res.body.abbreviation).toBe('utL');
        });

        it('should soft-delete a unit by ID', async () => {
            const res = await request(app).delete(`/inventory/units/${testUnitId}`);
            expect(res.status).toBe(200);

            // Verify soft-deleted
            const deleted = await prisma.ingredientUnit.findUnique({
                where: { id: testUnitId }
            });
            expect(deleted?.deletedAt).not.toBeNull();
        });
    });

    // ==========================================
    // 2. INGREDIENTS & INVENTORY INITIALIZATION
    // ==========================================
    describe('Ingredients & Inventory CRUD', () => {
        let activeUnitId: string;

        beforeAll(async () => {
            // Seed a fresh active unit for child tests since the previous was soft-deleted
            const unit = await prisma.ingredientUnit.create({
                data: {
                    name: 'Active Test Unit',
                    abbreviation: 'atu',
                    createdById: 'test-inventory-user-id',
                    updatedById: 'test-inventory-user-id'
                }
            });
            activeUnitId = unit.id;
        });

        afterAll(async () => {
            if (testIngredientId) {
                await prisma.ingredientInventory.deleteMany({ where: { ingredientId: testIngredientId } });
                await prisma.ingredient.deleteMany({ where: { id: testIngredientId } });
            }
            await prisma.ingredientUnit.deleteMany({ where: { id: activeUnitId } });
        });

        it('should create a new ingredient and automatically initialize its inventory level to 0 (OUT_OF_STOCK)', async () => {
            const payload = {
                name: 'Test Coffee Beans',
                description: 'Used for testing inventory levels',
                ingredientUnitId: activeUnitId,
                reorderPoint: 500 // Reorder point set to 500
            };

            const res = await request(app).post('/inventory/ingredients').send(payload);
            expect(res.status).toBe(201);
            expect(res.body).toHaveProperty('id');
            expect(res.body.name).toBe('Test Coffee Beans');
            testIngredientId = res.body.id;

            // Verify a matching IngredientInventory row was automatically created
            const inventory = await prisma.ingredientInventory.findFirst({
                where: { ingredientId: testIngredientId }
            });
            expect(inventory).not.toBeNull();
            expect(inventory?.currentQuantity).toBe(0);
            expect(inventory?.status).toBe(InventoryStatus.OUT_OF_STOCK);
        });

        it('should prevent creating a duplicate ingredient name', async () => {
            const payload = {
                name: 'Test Coffee Beans',
                ingredientUnitId: activeUnitId
            };

            const res = await request(app).post('/inventory/ingredients').send(payload);
            expect(res.status).toBe(409);
        });

        it('should retrieve a paginated list of ingredients', async () => {
            const res = await request(app).get('/inventory/ingredients?limit=5');
            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('data');
            expect(res.body).toHaveProperty('meta');
        });

        it('should update ingredient properties', async () => {
            const payload = {
                description: 'Updated test coffee beans description',
                reorderPoint: 300 // Lower reorder point to 300
            };

            const res = await request(app).put(`/inventory/ingredients/${testIngredientId}`).send(payload);
            expect(res.status).toBe(200);
            expect(res.body.reorderPoint).toBe(300);
            expect(res.body.description).toBe('Updated test coffee beans description');
        });

        it('should soft-delete an ingredient by ID and archive its inventory level', async () => {
            const res = await request(app).delete(`/inventory/ingredients/${testIngredientId}`);
            expect(res.status).toBe(200);

            // Verify ingredient soft-deleted
            const deletedIng = await prisma.ingredient.findUnique({
                where: { id: testIngredientId }
            });
            expect(deletedIng?.deletedAt).not.toBeNull();

            // Verify inventory level soft-deleted
            const deletedInv = await prisma.ingredientInventory.findFirst({
                where: { ingredientId: testIngredientId }
            });
            expect(deletedInv?.deletedAt).not.toBeNull();
        });
    });

    // ==========================================
    // 3. SYNCHRONIZED LOGIC (DELIVERIES, ADJUSTMENTS, STATUS ALERTS)
    // ==========================================
    describe('Synchronized Stocks & Live Alerts', () => {
        let activeUnitId: string;
        let activeIngredientId: string;

        beforeAll(async () => {
            // Setup active unit
            const unit = await prisma.ingredientUnit.create({
                data: {
                    name: 'Cups',
                    abbreviation: 'cps',
                    createdById: 'test-inventory-user-id',
                    updatedById: 'test-inventory-user-id'
                }
            });
            activeUnitId = unit.id;

            // Setup active ingredient with reorder point of 10
            const ingredient = await prisma.ingredient.create({
                data: {
                    name: 'Test Oat Milk',
                    ingredientUnitId: activeUnitId,
                    reorderPoint: 10,
                    createdById: 'test-inventory-user-id',
                    updatedById: 'test-inventory-user-id'
                }
            });
            activeIngredientId = ingredient.id;

            // Initialize stock count at 0 (OUT_OF_STOCK)
            await prisma.ingredientInventory.create({
                data: {
                    ingredientId: activeIngredientId,
                    currentQuantity: 0,
                    status: InventoryStatus.OUT_OF_STOCK,
                    createdById: 'test-inventory-user-id',
                    updatedById: 'test-inventory-user-id'
                }
            });
        });

        afterAll(async () => {
            await prisma.inventoryAdjustment.deleteMany({ where: { ingredientId: activeIngredientId } });
            await prisma.ingredientDelivery.deleteMany({ where: { ingredientId: activeIngredientId } });
            await prisma.ingredientInventory.deleteMany({ where: { ingredientId: activeIngredientId } });
            await prisma.ingredient.deleteMany({ where: { id: activeIngredientId } });
            await prisma.ingredientUnit.deleteMany({ where: { id: activeUnitId } });
        });

        it('should verify live inventory levels retrieve correctly', async () => {
            const res = await request(app).get('/inventory/levels');
            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('data');

            // Find our specific test row
            const testRow = res.body.data.find(
                (row: { ingredientId: string; currentQuantity: number; status: string }) => row.ingredientId === activeIngredientId
            );
            expect(testRow).not.toBeUndefined();
            expect(testRow.currentQuantity).toBe(0);
            expect(testRow.status).toBe('OUT_OF_STOCK');
        });

        it('should receive a delivery and atomically increment currentQuantity and calculate status to CRITICAL', async () => {
            const payload = {
                ingredientId: activeIngredientId,
                quantityReceived: 8, // Receives 8 items (0 + 8 = 8, which is <= reorderPoint of 10)
                unitCost: 15.0,
                batchNumber: 'BATCH-TEST-OM-1'
            };

            const res = await request(app).post('/inventory/deliveries').send(payload);
            expect(res.status).toBe(201);
            expect(res.body).toHaveProperty('id');
            expect(res.body.quantityReceived).toBe(8);
            expect(res.body.totalCost).toBe(120.0);
            testDeliveryId = res.body.id;

            // Verify live stock updated to 8 and status changed to CRITICAL
            const inventory = await prisma.ingredientInventory.findFirst({
                where: { ingredientId: activeIngredientId }
            });
            expect(inventory?.currentQuantity).toBe(8);
            expect(inventory?.status).toBe(InventoryStatus.CRITICAL);
        });

        it('should receive another delivery and update status to SAFE', async () => {
            const payload = {
                ingredientId: activeIngredientId,
                quantityReceived: 5, // Receives 5 more items (8 + 5 = 13, which is > reorderPoint of 10)
                unitCost: 15.0
            };

            const res = await request(app).post('/inventory/deliveries').send(payload);
            expect(res.status).toBe(201);

            // Verify live stock updated to 13 and status changed to SAFE
            const inventory = await prisma.ingredientInventory.findFirst({
                where: { ingredientId: activeIngredientId }
            });
            expect(inventory?.currentQuantity).toBe(13);
            expect(inventory?.status).toBe(InventoryStatus.SAFE);
        });

        it('should log a negative stock adjustment (waste) and atomically decrement stock and change status to CRITICAL', async () => {
            const payload = {
                ingredientId: activeIngredientId,
                quantity: -4, // Spoilage of 4 items (13 - 4 = 9, which is <= reorderPoint of 10)
                type: 'SPOILED',
                reason: 'Spoiled due to high ambient temperature'
            };

            const res = await request(app).post('/inventory/adjustments').send(payload);
            expect(res.status).toBe(201);
            expect(res.body.quantity).toBe(-4);
            testAdjustmentId = res.body.id;

            // Verify live stock updated to 9 and status changed to CRITICAL
            const inventory = await prisma.ingredientInventory.findFirst({
                where: { ingredientId: activeIngredientId }
            });
            expect(inventory?.currentQuantity).toBe(9);
            expect(inventory?.status).toBe(InventoryStatus.CRITICAL);
        });

        it('should overwrite current stock using a physical count and recalculate status to SAFE', async () => {
            const payload = {
                currentQuantity: 20 // Physical count count set to 20 (20 > reorderPoint of 10)
            };

            const res = await request(app).put(`/inventory/ingredients/${activeIngredientId}/physical-count`).send(payload);
            expect(res.status).toBe(200);
            expect(res.body.currentQuantity).toBe(20);
            expect(res.body.status).toBe('SAFE');
            expect(res.body.lastPhysicalCount).not.toBeNull();
        });

        it('should overwrite current stock using a physical count to 0 and recalculate status to OUT_OF_STOCK', async () => {
            const payload = {
                currentQuantity: 0 // Physical count set to 0 (OUT_OF_STOCK)
            };

            const res = await request(app).put(`/inventory/ingredients/${activeIngredientId}/physical-count`).send(payload);
            expect(res.status).toBe(200);
            expect(res.body.currentQuantity).toBe(0);
            expect(res.body.status).toBe('OUT_OF_STOCK');
        });
    });

    // ==========================================
    // 4. INVENTORY FORECASTING & STOCK PREDICTION
    // ==========================================
    describe('Inventory Production Forecasting', () => {
        let forecastUnitId: string;
        let forecastIng1Id: string;
        let forecastIng2Id: string;
        let forecastProductId: string;
        let forecastVariantId: string;
        let forecastRecipeId: string;

        beforeAll(async () => {
            // 1. Create a unit
            const unit = await prisma.ingredientUnit.create({
                data: {
                    name: 'Grams Forecast',
                    abbreviation: 'gf',
                    createdById: 'test-inventory-user-id',
                    updatedById: 'test-inventory-user-id'
                }
            });
            forecastUnitId = unit.id;

            // 2. Create raw ingredients
            const ing1 = await prisma.ingredient.create({
                data: {
                    name: 'Coffee Beans Forecast',
                    ingredientUnitId: forecastUnitId,
                    createdById: 'test-inventory-user-id',
                    updatedById: 'test-inventory-user-id'
                }
            });
            forecastIng1Id = ing1.id;

            const ing2 = await prisma.ingredient.create({
                data: {
                    name: 'Oat Milk Forecast',
                    ingredientUnitId: forecastUnitId,
                    createdById: 'test-inventory-user-id',
                    updatedById: 'test-inventory-user-id'
                }
            });
            forecastIng2Id = ing2.id;

            // Initialize inventories: Coffee Beans = 100g, Oat Milk = 300g
            await prisma.ingredientInventory.create({
                data: {
                    ingredientId: forecastIng1Id,
                    currentQuantity: 100,
                    status: 'SAFE',
                    createdById: 'test-inventory-user-id',
                    updatedById: 'test-inventory-user-id'
                }
            });

            await prisma.ingredientInventory.create({
                data: {
                    ingredientId: forecastIng2Id,
                    currentQuantity: 300,
                    status: 'SAFE',
                    createdById: 'test-inventory-user-id',
                    updatedById: 'test-inventory-user-id'
                }
            });

            // 3. Create a product and a variant
            const prod = await prisma.product.create({
                data: {
                    name: 'Forecast Latte',
                    createdById: 'test-inventory-user-id',
                    updatedById: 'test-inventory-user-id'
                }
            });
            forecastProductId = prod.id;

            const vrnt = await prisma.productVariant.create({
                data: {
                    productId: forecastProductId,
                    sku: 'FOR-LATTE',
                    price: 150.0,
                    createdById: 'test-inventory-user-id',
                    updatedById: 'test-inventory-user-id'
                }
            });
            forecastVariantId = vrnt.id;

            // 4. Create recipe: Requires 15g Coffee Beans, 100g Oat Milk
            const rcpe = await prisma.recipe.create({
                data: {
                    name: 'Latte Recipe',
                    productVariantId: forecastVariantId,
                    createdById: 'test-inventory-user-id',
                    updatedById: 'test-inventory-user-id'
                }
            });
            forecastRecipeId = rcpe.id;

            await prisma.recipeIngredient.create({
                data: {
                    recipeId: forecastRecipeId,
                    ingredientId: forecastIng1Id,
                    quantity: 15,
                    ingredientUnitId: forecastUnitId,
                    createdById: 'test-inventory-user-id',
                    updatedById: 'test-inventory-user-id'
                }
            });

            await prisma.recipeIngredient.create({
                data: {
                    recipeId: forecastRecipeId,
                    ingredientId: forecastIng2Id,
                    quantity: 100,
                    ingredientUnitId: forecastUnitId,
                    createdById: 'test-inventory-user-id',
                    updatedById: 'test-inventory-user-id'
                }
            });
        });

        afterAll(async () => {
            // Cleanup forecast setup records in correct dependency order
            await prisma.recipeIngredient.deleteMany({ where: { createdById: 'test-inventory-user-id' } });
            await prisma.recipe.deleteMany({ where: { createdById: 'test-inventory-user-id' } });
            await prisma.productVariant.deleteMany({ where: { createdById: 'test-inventory-user-id' } });
            await prisma.product.deleteMany({ where: { createdById: 'test-inventory-user-id' } });
            await prisma.ingredientInventory.deleteMany({ where: { createdById: 'test-inventory-user-id' } });
            await prisma.ingredient.deleteMany({ where: { createdById: 'test-inventory-user-id' } });
            await prisma.ingredientUnit.deleteMany({ where: { createdById: 'test-inventory-user-id' } });
        });

        it('should calculate forecast and identify Oat Milk as the bottleneck', async () => {
            // Inventory levels: Coffee Beans = 100g (requires 15g -> can produce 6 units)
            // Oat Milk = 300g (requires 100g -> can produce 3 units)
            // Bottleneck is Oat Milk (300/100 = 3)
            const res = await request(app).get('/inventory/forecast');
            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);

            const record = res.body.find((f: { variantId: string }) => f.variantId === forecastVariantId);
            expect(record).toBeDefined();
            expect(record.hasRecipe).toBe(true);
            expect(record.maxProduceable).toBe(3);
            expect(record.bottleneck.ingredientId).toBe(forecastIng2Id);
            expect(record.bottleneck.name).toBe('Oat Milk Forecast');
        });
    });
});
