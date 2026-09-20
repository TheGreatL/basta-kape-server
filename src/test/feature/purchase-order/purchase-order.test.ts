import { vi, describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// Mock rbac middleware to use a unique user ID and prevent test collisions
vi.mock('@/middleware/rbac.middleware', () => ({
    requireAccess: vi.fn(() => (req: Request, res: Response, next: NextFunction) => {
        req.user = {
            sub: 'test-po-user-id',
            email: 'testpo@example.com',
            username: 'testpouser',
            roles: ['Administrator']
        };
        next();
    }),
    authenticate: vi.fn((req: Request, res: Response, next: NextFunction) => {
        req.user = {
            sub: 'test-po-user-id',
            email: 'testpo@example.com',
            username: 'testpouser',
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
import { PrismaClient, PurchaseOrderStatus } from '@prisma/client';
import purchaseOrderRouter from '@/feature/purchase-order/purchase-order.route';
import { HttpException } from '@/exceptions/http.exception';

describe('Purchase Order Feature CRUD', () => {
    let app: express.Application;
    let prisma: PrismaClient;

    let testSupplierId1: string;
    let testSupplierId2: string;
    let testUnitId: string;
    let testIngredientId1: string;
    let testIngredientId2: string;

    beforeAll(async () => {
        prisma = new PrismaClient();
        app = express();

        app.use(express.json());
        app.use('/purchase-orders', purchaseOrderRouter);

        // Error handler
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        app.use((err: HttpException, _req: express.Request, res: express.Response, next: express.NextFunction) => {
            const status = err.statusCode || 500;
            res.status(status).json({ error: err.message });
        });

        // 1. Ensure isolated mock user record exists
        await prisma.user.upsert({
            where: { id: 'test-po-user-id' },
            update: {},
            create: {
                id: 'test-po-user-id',
                email: 'testpo@example.com',
                username: 'testpouser',
                password: 'hashedpassword123',
                firstName: 'Test',
                lastName: 'User',
                role: {
                    connectOrCreate: {
                        where: { name: 'Administrator' },
                        create: { name: 'Administrator', isSystem: true }
                    }
                }
            }
        });

        // 2. Create mock suppliers
        const supplier1 = await prisma.supplier.create({
            data: {
                name: 'Test Supplier 1',
                createdById: 'test-po-user-id'
            }
        });
        testSupplierId1 = supplier1.id;

        const supplier2 = await prisma.supplier.create({
            data: {
                name: 'Test Supplier 2',
                createdById: 'test-po-user-id'
            }
        });
        testSupplierId2 = supplier2.id;

        // 3. Create mock unit
        const unit = await prisma.ingredientUnit.create({
            data: {
                name: 'Grams',
                abbreviation: 'g',
                createdById: 'test-po-user-id'
            }
        });
        testUnitId = unit.id;

        // 4. Create mock ingredients
        const ingredient1 = await prisma.ingredient.create({
            data: {
                name: 'Coffee Beans Test 1',
                ingredientUnitId: testUnitId,
                reorderPoint: 10,
                createdById: 'test-po-user-id'
            }
        });
        testIngredientId1 = ingredient1.id;

        const ingredient2 = await prisma.ingredient.create({
            data: {
                name: 'Milk Test 2',
                ingredientUnitId: testUnitId,
                reorderPoint: 5,
                createdById: 'test-po-user-id'
            }
        });
        testIngredientId2 = ingredient2.id;
    });

    afterAll(async () => {
        // Cleanup all records created
        await prisma.stockTransaction.deleteMany({
            where: { createdById: 'test-po-user-id' }
        });
        await prisma.ingredientBatch.deleteMany({
            where: { createdById: 'test-po-user-id' }
        });
        await prisma.ingredientInventory.deleteMany({
            where: { createdById: 'test-po-user-id' }
        });
        await prisma.purchaseOrderItem.deleteMany({
            where: {
                purchaseOrder: {
                    createdById: 'test-po-user-id'
                }
            }
        });
        await prisma.purchaseOrder.deleteMany({
            where: {
                createdById: 'test-po-user-id'
            }
        });
        await prisma.supplierIngredient.deleteMany({
            where: {
                supplier: { createdById: 'test-po-user-id' }
            }
        });
        await prisma.ingredient.deleteMany({
            where: {
                createdById: 'test-po-user-id'
            }
        });
        await prisma.ingredientUnit.deleteMany({
            where: {
                createdById: 'test-po-user-id'
            }
        });
        await prisma.supplier.deleteMany({
            where: {
                createdById: 'test-po-user-id'
            }
        });
        await prisma.user
            .delete({
                where: { id: 'test-po-user-id' }
            })
            .catch(() => {});

        await prisma.$disconnect();
    });

    describe('PUT /purchase-orders/:id', () => {
        it('should successfully update a draft purchase order', async () => {
            // Create a draft PO
            const createRes = await request(app)
                .post('/purchase-orders')
                .send({
                    supplierId: testSupplierId1,
                    notes: 'Initial draft notes',
                    items: [
                        {
                            ingredientId: testIngredientId1,
                            quantity: 100,
                            unitCost: 1.5
                        }
                    ]
                });

            expect(createRes.status).toBe(201);
            const poId = createRes.body.id;

            // Update the draft PO
            const updatePayload = {
                supplierId: testSupplierId2,
                notes: 'Updated draft notes',
                items: [
                    {
                        ingredientId: testIngredientId2,
                        quantity: 50,
                        unitCost: 2.0
                    }
                ]
            };

            const updateRes = await request(app).put(`/purchase-orders/${poId}`).send(updatePayload);

            expect(updateRes.status).toBe(200);
            expect(updateRes.body.supplierId).toBe(testSupplierId2);
            expect(updateRes.body.notes).toBe('Updated draft notes');
            expect(updateRes.body.totalAmount).toBe(100.0); // 50 * 2.0
            expect(updateRes.body.items).toHaveLength(1);
            expect(updateRes.body.items[0].ingredientId).toBe(testIngredientId2);
            expect(updateRes.body.items[0].quantity).toBe(50);
            expect(updateRes.body.items[0].unitCost).toBe(2.0);

            // Double check database state
            const dbPo = await prisma.purchaseOrder.findUnique({
                where: { id: poId },
                include: { items: true }
            });
            expect(dbPo).not.toBeNull();
            expect(dbPo?.supplierId).toBe(testSupplierId2);
            expect(dbPo?.notes).toBe('Updated draft notes');
            expect(dbPo?.totalAmount).toBe(100.0);
            expect(dbPo?.items).toHaveLength(1);
        });

        it('should fail with 404 for non-existent purchase order', async () => {
            const updatePayload = {
                notes: 'Should fail'
            };

            const res = await request(app).put('/purchase-orders/00000000-0000-0000-0000-000000000000').send(updatePayload);

            expect(res.status).toBe(404);
            expect(res.body.error).toContain('Purchase Order not found');
        });

        it('should fail with 400 when updating a purchase order that is not in DRAFT status', async () => {
            // Create a draft PO
            const createRes = await request(app)
                .post('/purchase-orders')
                .send({
                    supplierId: testSupplierId1,
                    items: [
                        {
                            ingredientId: testIngredientId1,
                            quantity: 10,
                            unitCost: 5.0
                        }
                    ]
                });
            const poId = createRes.body.id;

            // Change status to SENT using the status endpoint
            const statusRes = await request(app).patch(`/purchase-orders/${poId}/status`).send({ status: PurchaseOrderStatus.SENT });
            expect(statusRes.status).toBe(200);

            // Attempt to update the SENT PO
            const updateRes = await request(app).put(`/purchase-orders/${poId}`).send({ notes: 'Attempt update' });

            expect(updateRes.status).toBe(400);
            expect(updateRes.body.error).toContain('Cannot update a purchase order that is not in DRAFT status');
        });

        it('should fail with 404 when updating with a non-existent supplierId', async () => {
            const createRes = await request(app)
                .post('/purchase-orders')
                .send({
                    supplierId: testSupplierId1,
                    items: [
                        {
                            ingredientId: testIngredientId1,
                            quantity: 10,
                            unitCost: 5.0
                        }
                    ]
                });
            const poId = createRes.body.id;

            const res = await request(app).put(`/purchase-orders/${poId}`).send({ supplierId: '00000000-0000-0000-0000-000000000000' });

            expect(res.status).toBe(404);
            expect(res.body.error).toContain('Supplier not found');
        });

        it('should fail with 404 when updating with a non-existent ingredientId', async () => {
            const createRes = await request(app)
                .post('/purchase-orders')
                .send({
                    supplierId: testSupplierId1,
                    items: [
                        {
                            ingredientId: testIngredientId1,
                            quantity: 10,
                            unitCost: 5.0
                        }
                    ]
                });
            const poId = createRes.body.id;

            const res = await request(app)
                .put(`/purchase-orders/${poId}`)
                .send({
                    items: [
                        {
                            ingredientId: '00000000-0000-0000-0000-000000000000',
                            quantity: 10,
                            unitCost: 5.0
                        }
                    ]
                });

            expect(res.status).toBe(404);
            expect(res.body.error).toContain('Ingredient with ID 00000000-0000-0000-0000-000000000000 not found');
        });
    });

    describe('GET /purchase-orders', () => {
        it('should retrieve a paginated list of purchase orders', async () => {
            const res = await request(app).get('/purchase-orders?page=1&limit=10');

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('data');
            expect(res.body).toHaveProperty('meta');
            expect(res.body.data.length).toBeGreaterThanOrEqual(1);
        });

        it('should retrieve a single purchase order by ID', async () => {
            // Create a PO to fetch
            const createRes = await request(app)
                .post('/purchase-orders')
                .send({
                    supplierId: testSupplierId1,
                    notes: 'Fetch test PO',
                    items: [
                        {
                            ingredientId: testIngredientId1,
                            quantity: 15,
                            unitCost: 10.0
                        }
                    ]
                });
            expect(createRes.status).toBe(201);
            const poId = createRes.body.id;

            const res = await request(app).get(`/purchase-orders/${poId}`);
            expect(res.status).toBe(200);
            expect(res.body.id).toBe(poId);
            expect(res.body.notes).toBe('Fetch test PO');
            expect(res.body.supplier).toBeDefined();
            expect(res.body.items).toHaveLength(1);
        });

        it('should return 404 for non-existent purchase order ID', async () => {
            const res = await request(app).get('/purchase-orders/00000000-0000-0000-0000-000000000000');
            expect(res.status).toBe(404);
        });
    });

    describe('POST /purchase-orders & Delivery Price Population', () => {
        it('should successfully create a draft purchase order without unitCost, defaulting prices and totalAmount to 0', async () => {
            const createRes = await request(app)
                .post('/purchase-orders')
                .send({
                    supplierId: testSupplierId1,
                    notes: 'PO created without unitCost',
                    items: [
                        {
                            ingredientId: testIngredientId1,
                            quantity: 25
                        }
                    ]
                });

            expect(createRes.status).toBe(201);
            expect(createRes.body.status).toBe(PurchaseOrderStatus.DRAFT);
            expect(createRes.body.totalAmount).toBe(0);
            expect(createRes.body.items).toHaveLength(1);
            expect(createRes.body.items[0].quantity).toBe(25);
            expect(createRes.body.items[0].unitCost).toBe(0);
            expect(createRes.body.items[0].totalCost).toBe(0);
        });

        it('should automatically populate item prices from SupplierIngredient when marked as RECEIVED', async () => {
            // 1. Link supplier to ingredient with established catalog unitCost
            await prisma.supplierIngredient.upsert({
                where: {
                    supplierId_ingredientId: {
                        supplierId: testSupplierId1,
                        ingredientId: testIngredientId1
                    }
                },
                update: { unitCost: 15.75 },
                create: {
                    supplierId: testSupplierId1,
                    ingredientId: testIngredientId1,
                    unitCost: 15.75
                }
            });

            // 2. Create PO without unitCost
            const createRes = await request(app)
                .post('/purchase-orders')
                .send({
                    supplierId: testSupplierId1,
                    notes: 'Delivery auto-price test',
                    items: [
                        {
                            ingredientId: testIngredientId1,
                            quantity: 20
                        }
                    ]
                });

            expect(createRes.status).toBe(201);
            const poId = createRes.body.id;
            expect(createRes.body.totalAmount).toBe(0);

            // 3. Transition to SENT
            const sentRes = await request(app).patch(`/purchase-orders/${poId}/status`).send({ status: PurchaseOrderStatus.SENT });

            expect(sentRes.status).toBe(200);
            expect(sentRes.body.status).toBe(PurchaseOrderStatus.SENT);

            // 4. Mark as RECEIVED without passing items (auto-populates from SupplierIngredient)
            const receivedRes = await request(app).patch(`/purchase-orders/${poId}/status`).send({ status: PurchaseOrderStatus.RECEIVED });

            expect(receivedRes.status).toBe(200);
            expect(receivedRes.body.status).toBe(PurchaseOrderStatus.RECEIVED);
            expect(receivedRes.body.totalAmount).toBe(315); // 20 * 15.75
            expect(receivedRes.body.items).toHaveLength(1);
            expect(receivedRes.body.items[0].unitCost).toBe(15.75);
            expect(receivedRes.body.items[0].totalCost).toBe(315);

            // 5. Verify database batch has populated unitCost & totalCost
            const batch = await prisma.ingredientBatch.findFirst({
                where: { purchaseOrderId: poId }
            });
            expect(batch).not.toBeNull();
            expect(batch?.quantityReceived).toBe(20);
            expect(batch?.unitCost).toBe(15.75);
            expect(batch?.totalCost).toBe(315);
        });

        it('should allow explicit item price overrides when marking a purchase order as RECEIVED', async () => {
            // 1. Create PO without unitCost
            const createRes = await request(app)
                .post('/purchase-orders')
                .send({
                    supplierId: testSupplierId1,
                    notes: 'Override price delivery test',
                    items: [
                        {
                            ingredientId: testIngredientId1,
                            quantity: 10
                        }
                    ]
                });

            expect(createRes.status).toBe(201);
            const poId = createRes.body.id;

            // 2. Transition to SENT
            await request(app).patch(`/purchase-orders/${poId}/status`).send({ status: PurchaseOrderStatus.SENT });

            // 3. Mark as RECEIVED with explicit price override
            const receivedRes = await request(app)
                .patch(`/purchase-orders/${poId}/status`)
                .send({
                    status: PurchaseOrderStatus.RECEIVED,
                    items: [
                        {
                            ingredientId: testIngredientId1,
                            unitCost: 22.5
                        }
                    ]
                });

            expect(receivedRes.status).toBe(200);
            expect(receivedRes.body.status).toBe(PurchaseOrderStatus.RECEIVED);
            expect(receivedRes.body.totalAmount).toBe(225); // 10 * 22.5
            expect(receivedRes.body.items[0].unitCost).toBe(22.5);
            expect(receivedRes.body.items[0].totalCost).toBe(225);

            // 4. Verify batch in DB has overridden cost
            const batch = await prisma.ingredientBatch.findFirst({
                where: { purchaseOrderId: poId }
            });
            expect(batch).not.toBeNull();
            expect(batch?.unitCost).toBe(22.5);
            expect(batch?.totalCost).toBe(225);
        });
    });
});
