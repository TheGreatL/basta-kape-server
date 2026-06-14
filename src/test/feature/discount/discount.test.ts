import { vi, describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// Mock rbac middleware to use a unique user ID and prevent test collisions
vi.mock('@/middleware/rbac.middleware', () => ({
    requireAccess: vi.fn(() => (req: Request, res: Response, next: NextFunction) => {
        req.user = {
            sub: 'test-discount-user-id',
            email: 'testdiscount@example.com',
            username: 'testdiscountuser',
            roles: ['Administrator']
        };
        req.rbacScope = 'All';
        next();
    }),
    authenticate: vi.fn((req: Request, res: Response, next: NextFunction) => {
        req.user = {
            sub: 'test-discount-user-id',
            email: 'testdiscount@example.com',
            username: 'testdiscountuser',
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
import { discountConfigRouter, orderDiscountRouter } from '@/feature/discount/discount.route';
import { HttpException } from '@/exceptions/http.exception';
import { ZodError } from 'zod';

describe('Discount Feature Integration Tests', () => {
    let app: express.Application;
    let prisma: PrismaClient;

    let testCategoryId: string;
    let testTypeId: string;
    let testProductId: string;
    let testVariantId: string;
    let activeShiftId: string;

    beforeAll(async () => {
        prisma = new PrismaClient();
        app = express();

        app.use(express.json());
        // Mount routers
        app.use('/discounts', discountConfigRouter);
        app.use('/orders', orderDiscountRouter);

        // Error handler middleware
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        app.use((err: HttpException | Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
            if (err instanceof ZodError) {
                res.status(400).json({ error: 'Validation failed', details: err.issues });
                return;
            }
            const status = err instanceof HttpException ? err.statusCode : 500;
            res.status(status).json({ error: err.message });
        });

        // 1. Ensure isolated mock user record exists
        await prisma.user.upsert({
            where: { id: 'test-discount-user-id' },
            update: {},
            create: {
                id: 'test-discount-user-id',
                email: 'testdiscount@example.com',
                username: 'testdiscountuser',
                password: 'hashedpassword123',
                firstName: 'Test',
                lastName: 'Discount'
            }
        });

        // 2. Create category & type
        const category = await prisma.productCategory.create({
            data: {
                name: 'Test Discount Category',
                description: 'For testing discounts',
                createdById: 'test-discount-user-id',
                updatedById: 'test-discount-user-id'
            }
        });
        testCategoryId = category.id;

        const ptype = await prisma.productType.create({
            data: {
                name: 'Test Discount Type',
                createdById: 'test-discount-user-id',
                updatedById: 'test-discount-user-id'
            }
        });
        testTypeId = ptype.id;

        // 3. Create product & variant
        const product = await prisma.product.create({
            data: {
                name: 'Test Discount Coffee',
                description: 'For testing discounts',
                productCategoryId: testCategoryId,
                productTypeId: testTypeId,
                createdById: 'test-discount-user-id',
                updatedById: 'test-discount-user-id'
            }
        });
        testProductId = product.id;

        const variant = await prisma.productVariant.create({
            data: {
                productId: testProductId,
                sku: 'TEST-DISC-REG',
                price: 100.0,
                createdById: 'test-discount-user-id',
                updatedById: 'test-discount-user-id'
            }
        });
        testVariantId = variant.id;

        // 4. Create active register shift
        const shift = await prisma.registerShift.create({
            data: {
                cashierId: 'test-discount-user-id',
                startBalance: 5000.0
            }
        });
        activeShiftId = shift.id;
    });

    afterAll(async () => {
        // Cleanup test data
        await prisma.orderDiscount.deleteMany({
            where: {
                order: {
                    cashierSession: {
                        cashierId: 'test-discount-user-id'
                    }
                }
            }
        });
        await prisma.orderPayment.deleteMany({
            where: {
                order: {
                    cashierSession: {
                        cashierId: 'test-discount-user-id'
                    }
                }
            }
        });
        await prisma.orderStatusHistory.deleteMany({
            where: {
                order: {
                    cashierSession: {
                        cashierId: 'test-discount-user-id'
                    }
                }
            }
        });
        await prisma.orderItem.deleteMany({
            where: {
                order: {
                    cashierSession: {
                        cashierId: 'test-discount-user-id'
                    }
                }
            }
        });
        await prisma.order.deleteMany({
            where: {
                cashierSession: {
                    cashierId: 'test-discount-user-id'
                }
            }
        });
        await prisma.registerShift.deleteMany({
            where: { cashierId: 'test-discount-user-id' }
        });
        if (testProductId) {
            await prisma.productVariant.deleteMany({
                where: { productId: testProductId }
            });
            await prisma.product.deleteMany({
                where: { id: testProductId }
            });
        }
        if (testTypeId) {
            await prisma.productType.deleteMany({
                where: { id: testTypeId }
            });
        }
        if (testCategoryId) {
            await prisma.productCategory.deleteMany({
                where: { id: testCategoryId }
            });
        }

        // Cleanup created discount configs
        await prisma.discount.deleteMany({
            where: {
                name: { startsWith: 'Test config' }
            }
        });

        await prisma.user
            .delete({
                where: { id: 'test-discount-user-id' }
            })
            .catch(() => {});

        await prisma.$disconnect();
    });

    const createTestOrder = async (orderSource: 'POS' | 'WEBSITE' = 'POS', status: 'PENDING' | 'CANCELLED' | 'COMPLETED' = 'PENDING') => {
        return prisma.order.create({
            data: {
                queueNumber: '#D01',
                orderType: 'DINE_IN',
                orderSource,
                subtotal: 100.0,
                taxAmount: 10.71,
                netTotal: 100.0,
                cashierSessionId: orderSource === 'POS' ? activeShiftId : null,
                status,
                items: {
                    create: {
                        productVariantId: testVariantId,
                        quantity: 1,
                        unitPrice: 100.0,
                        totalPrice: 100.0
                    }
                }
            }
        });
    };

    describe('Discount Configuration CRUD', () => {
        let createdDiscountId: string;

        it('should successfully create a discount configuration', async () => {
            const payload = {
                name: 'Test config promo',
                type: 'PERCENTAGE',
                value: 10.0,
                code: 'TEST10'
            };

            const res = await request(app).post('/discounts').send(payload);

            expect(res.status).toBe(201);
            expect(res.body.name).toBe('Test config promo');
            expect(res.body.type).toBe('PERCENTAGE');
            expect(res.body.value).toBe(10.0);
            expect(res.body.code).toBe('TEST10');
            createdDiscountId = res.body.id;
        });

        it('should list all configurations', async () => {
            const res = await request(app).get('/discounts');

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
            const found = res.body.find((d: { id: string }) => d.id === createdDiscountId);
            expect(found).toBeDefined();
        });

        it('should get a single discount configuration details', async () => {
            const res = await request(app).get(`/discounts/${createdDiscountId}`);

            expect(res.status).toBe(200);
            expect(res.body.name).toBe('Test config promo');
        });

        it('should update a configuration', async () => {
            const payload = {
                value: 15.0
            };

            const res = await request(app).put(`/discounts/${createdDiscountId}`).send(payload);

            expect(res.status).toBe(200);
            expect(res.body.value).toBe(15.0);
        });

        it('should soft-delete a configuration', async () => {
            const res = await request(app).delete(`/discounts/${createdDiscountId}`);
            expect(res.status).toBe(200);

            // Verify it is not returned in listing
            const listRes = await request(app).get('/discounts');
            const found = listRes.body.find((d: { id: string }) => d.id === createdDiscountId);
            expect(found).toBeUndefined();
        });
    });

    describe('Order Discount application', () => {
        let percentDiscountId: string;
        let fixedDiscountId: string;
        let scDiscountId: string;

        beforeAll(async () => {
            // Seed discounts configurations
            const d1 = await prisma.discount.create({
                data: { name: 'Test config 10%', type: 'PERCENTAGE', value: 10.0, code: 'PROMO10' }
            });
            percentDiscountId = d1.id;

            const d2 = await prisma.discount.create({
                data: { name: 'Test config PHP 50', type: 'FIXED_AMOUNT', value: 50.0, code: 'OFF50' }
            });
            fixedDiscountId = d2.id;

            const d3 = await prisma.discount.create({
                data: { name: 'Test config Senior Citizen', type: 'PERCENTAGE', value: 20.0, code: 'SC20' }
            });
            scDiscountId = d3.id;
        });

        it('should successfully apply percentage discount and recalculate totals', async () => {
            const order = await createTestOrder();
            const payload = {
                discountId: percentDiscountId
            };

            const res = await request(app).post(`/orders/${order.id}/discounts`).send(payload);

            expect(res.status).toBe(201);
            expect(res.body.amount).toBe(10.0); // 10% of 100

            // Verify order table totals updated: subtotal=100, discount=10, tax=9.64 (12/112 of 90), net=90.00
            const updatedOrder = await prisma.order.findUnique({ where: { id: order.id } });
            expect(updatedOrder?.discountAmount).toBe(10.0);
            expect(updatedOrder?.taxAmount).toBe(9.64);
            expect(updatedOrder?.netTotal).toBe(90.0);
        });

        it('should successfully apply fixed amount discount and recalculate totals', async () => {
            const order = await createTestOrder();
            const payload = {
                discountId: fixedDiscountId
            };

            const res = await request(app).post(`/orders/${order.id}/discounts`).send(payload);

            expect(res.status).toBe(201);
            expect(res.body.amount).toBe(50.0); // PHP 50 off

            // Verify order table totals: subtotal=100, discount=50, tax=5.36 (12/112 of 50), net=50.00
            const updatedOrder = await prisma.order.findUnique({ where: { id: order.id } });
            expect(updatedOrder?.discountAmount).toBe(50.0);
            expect(updatedOrder?.taxAmount).toBe(5.36);
            expect(updatedOrder?.netTotal).toBe(50.0);
        });

        it('should successfully apply BIR Senior Citizen discount (VAT-exempt + 20% discount)', async () => {
            const order = await prisma.order.create({
                data: {
                    queueNumber: '#D01',
                    orderType: 'DINE_IN',
                    orderSource: 'POS',
                    subtotal: 112.0,
                    taxAmount: 12.0,
                    netTotal: 112.0,
                    cashierSessionId: activeShiftId,
                    status: 'PENDING',
                    items: {
                        create: {
                            productVariantId: testVariantId,
                            quantity: 1,
                            unitPrice: 112.0,
                            totalPrice: 112.0
                        }
                    }
                }
            });
            const payload = {
                discountId: scDiscountId,
                referenceId: 'SC-98765',
                referenceName: 'Juan Dela Cruz'
            };

            const res = await request(app).post(`/orders/${order.id}/discounts`).send(payload);

            expect(res.status).toBe(201);
            expect(res.body.amount).toBe(20.0); // 20% of 100 (VAT-exclusive of 112)
            expect(res.body.referenceId).toBe('SC-98765');
            expect(res.body.referenceName).toBe('Juan Dela Cruz');

            // Verify totals: subtotal=112, discount=20, tax=0 (VAT exempt), net=80.00
            const updatedOrder = await prisma.order.findUnique({ where: { id: order.id } });
            expect(updatedOrder?.discountAmount).toBe(20.0);
            expect(updatedOrder?.taxAmount).toBe(0.0);
            expect(updatedOrder?.netTotal).toBe(80.0);
        });

        it('should fail SC discount application if reference cardholder details are missing', async () => {
            const order = await createTestOrder();
            const payload = {
                discountId: scDiscountId
            };

            const res = await request(app).post(`/orders/${order.id}/discounts`).send(payload);

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('Card ID and cardholder name are required');
        });

        it('should successfully remove discount and restore original full VAT and net totals', async () => {
            const order = await createTestOrder();
            // Apply first
            await request(app).post(`/orders/${order.id}/discounts`).send({ discountId: percentDiscountId });

            // Remove
            const res = await request(app).delete(`/orders/${order.id}/discounts`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);

            // Verify totals restored: subtotal=100, discount=0, tax=10.71, net=100.00
            const updatedOrder = await prisma.order.findUnique({ where: { id: order.id } });
            expect(updatedOrder?.discountAmount).toBe(0);
            expect(updatedOrder?.taxAmount).toBe(10.71);
            expect(updatedOrder?.netTotal).toBe(100.0);

            // Verify order discounts deleted
            const odCount = await prisma.orderDiscount.count({ where: { orderId: order.id } });
            expect(odCount).toBe(0);
        });

        it('should replace previous discount when a new one is applied (no double discounting)', async () => {
            const order = await createTestOrder();
            // Apply 10% first
            await request(app).post(`/orders/${order.id}/discounts`).send({ discountId: percentDiscountId });
            // Apply fixed PHP 50 next
            await request(app).post(`/orders/${order.id}/discounts`).send({ discountId: fixedDiscountId });

            // Verify only fixed discount PHP 50 is active and order totals are based on it
            const odCount = await prisma.orderDiscount.count({ where: { orderId: order.id } });
            expect(odCount).toBe(1);

            const updatedOrder = await prisma.order.findUnique({ where: { id: order.id } });
            expect(updatedOrder?.discountAmount).toBe(50.0);
            expect(updatedOrder?.taxAmount).toBe(5.36);
            expect(updatedOrder?.netTotal).toBe(50.0);
        });

        it('should fail if order is not pending or is already paid', async () => {
            const orderPaid = await createTestOrder();
            await prisma.orderPayment.create({
                data: { orderId: orderPaid.id, paymentMethod: 'CASH', paymentStatus: 'PAID', amount: 100.0 }
            });

            const orderCompleted = await createTestOrder('POS', 'COMPLETED');

            // 1. Paid order check
            const resPaid = await request(app).post(`/orders/${orderPaid.id}/discounts`).send({ discountId: percentDiscountId });
            expect(resPaid.status).toBe(409);

            // 2. Completed order check
            const resCompleted = await request(app).post(`/orders/${orderCompleted.id}/discounts`).send({ discountId: percentDiscountId });
            expect(resCompleted.status).toBe(400);
        });
    });
});
