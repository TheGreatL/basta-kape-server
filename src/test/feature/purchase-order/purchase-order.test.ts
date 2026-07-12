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
                lastName: 'User'
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
});
