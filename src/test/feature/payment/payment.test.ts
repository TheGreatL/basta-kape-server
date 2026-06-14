import { vi, describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// Mock rbac middleware to use a unique user ID and prevent test collisions
vi.mock('@/middleware/rbac.middleware', () => ({
    requireAccess: vi.fn(() => (req: Request, res: Response, next: NextFunction) => {
        req.user = {
            sub: 'test-payment-user-id',
            email: 'testpayment@example.com',
            username: 'testpaymentuser',
            roles: ['Administrator']
        };
        req.rbacScope = 'All';
        next();
    }),
    authenticate: vi.fn((req: Request, res: Response, next: NextFunction) => {
        req.user = {
            sub: 'test-payment-user-id',
            email: 'testpayment@example.com',
            username: 'testpaymentuser',
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
import paymentRouter from '@/feature/payment/payment.route';
import { HttpException } from '@/exceptions/http.exception';
import { ZodError } from 'zod';

describe('Payment Feature Integration Tests', () => {
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
        // Mount under /orders just like routes.ts
        app.use('/orders', paymentRouter);

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
            where: { id: 'test-payment-user-id' },
            update: {},
            create: {
                id: 'test-payment-user-id',
                email: 'testpayment@example.com',
                username: 'testpaymentuser',
                password: 'hashedpassword123',
                firstName: 'Test',
                lastName: 'Payment'
            }
        });

        // 2. Create category & type
        const category = await prisma.productCategory.create({
            data: {
                name: 'Test Payment Category',
                description: 'For testing payments',
                createdById: 'test-payment-user-id',
                updatedById: 'test-payment-user-id'
            }
        });
        testCategoryId = category.id;

        const ptype = await prisma.productType.create({
            data: {
                name: 'Test Payment Type',
                createdById: 'test-payment-user-id',
                updatedById: 'test-payment-user-id'
            }
        });
        testTypeId = ptype.id;

        // 3. Create product & variant
        const product = await prisma.product.create({
            data: {
                name: 'Test Payment Coffee',
                description: 'For testing payments',
                productCategoryId: testCategoryId,
                productTypeId: testTypeId,
                createdById: 'test-payment-user-id',
                updatedById: 'test-payment-user-id'
            }
        });
        testProductId = product.id;

        const variant = await prisma.productVariant.create({
            data: {
                productId: testProductId,
                sku: 'TEST-PAY-REG',
                price: 120.0,
                createdById: 'test-payment-user-id',
                updatedById: 'test-payment-user-id'
            }
        });
        testVariantId = variant.id;

        // 4. Create active register shift
        const shift = await prisma.registerShift.create({
            data: {
                cashierId: 'test-payment-user-id',
                startBalance: 5000.0
            }
        });
        activeShiftId = shift.id;
    });

    afterAll(async () => {
        // Cleanup test data
        await prisma.orderPayment.deleteMany({
            where: {
                order: {
                    cashierSession: {
                        cashierId: 'test-payment-user-id'
                    }
                }
            }
        });
        await prisma.orderStatusHistory.deleteMany({
            where: {
                order: {
                    cashierSession: {
                        cashierId: 'test-payment-user-id'
                    }
                }
            }
        });
        await prisma.orderItem.deleteMany({
            where: {
                order: {
                    cashierSession: {
                        cashierId: 'test-payment-user-id'
                    }
                }
            }
        });
        await prisma.order.deleteMany({
            where: {
                cashierSession: {
                    cashierId: 'test-payment-user-id'
                }
            }
        });
        await prisma.registerShift.deleteMany({
            where: { cashierId: 'test-payment-user-id' }
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
        await prisma.user
            .delete({
                where: { id: 'test-payment-user-id' }
            })
            .catch(() => {});

        await prisma.$disconnect();
    });

    const createTestOrder = async (orderSource: 'POS' | 'WEBSITE' = 'POS', status: 'PENDING' | 'CANCELLED' | 'COMPLETED' = 'PENDING') => {
        return prisma.order.create({
            data: {
                queueNumber: '#P01',
                orderType: 'DINE_IN',
                orderSource,
                subtotal: 120.0,
                taxAmount: 12.86,
                netTotal: 120.0,
                cashierSessionId: orderSource === 'POS' ? activeShiftId : null,
                status,
                items: {
                    create: {
                        productVariantId: testVariantId,
                        quantity: 1,
                        unitPrice: 120.0,
                        totalPrice: 120.0
                    }
                }
            }
        });
    };

    describe('POST /orders/:orderId/payments', () => {
        it('should successfully record CASH payment and update order status', async () => {
            const order = await createTestOrder();
            const payload = {
                paymentMethod: 'CASH',
                amountTendered: 150.0
            };

            const res = await request(app).post(`/orders/${order.id}/payments`).send(payload);

            expect(res.status).toBe(201);
            expect(res.body.paymentMethod).toBe('CASH');
            expect(res.body.paymentStatus).toBe('PAID');
            expect(res.body.amount).toBe(120.0);
            expect(res.body.amountTendered).toBe(150.0);
            expect(res.body.amountChange).toBe(30.0);

            // Verify order status is PREPARING
            const updatedOrder = await prisma.order.findUnique({
                where: { id: order.id }
            });
            expect(updatedOrder?.status).toBe('PREPARING');

            // Verify order status history logged
            const history = await prisma.orderStatusHistory.findFirst({
                where: { orderId: order.id, status: 'PREPARING' }
            });
            expect(history).toBeDefined();
            expect(history?.notes).toContain('Paid via CASH');
        });

        it('should successfully record GCASH payment and update order status', async () => {
            const order = await createTestOrder();
            const payload = {
                paymentMethod: 'GCASH',
                gcashReferenceNumber: 'REF123456789'
            };

            const res = await request(app).post(`/orders/${order.id}/payments`).send(payload);

            expect(res.status).toBe(201);
            expect(res.body.paymentMethod).toBe('GCASH');
            expect(res.body.paymentStatus).toBe('PAID');
            expect(res.body.amount).toBe(120.0);
            expect(res.body.gcashReferenceNumber).toBe('REF123456789');

            const updatedOrder = await prisma.order.findUnique({
                where: { id: order.id }
            });
            expect(updatedOrder?.status).toBe('PREPARING');
        });

        it('should fail if paymentMethod is CASH but amountTendered is insufficient', async () => {
            const order = await createTestOrder();
            const payload = {
                paymentMethod: 'CASH',
                amountTendered: 100.0
            };

            const res = await request(app).post(`/orders/${order.id}/payments`).send(payload);

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('Amount tendered');
        });

        it('should fail if paymentMethod is GCASH but reference number is missing or too short', async () => {
            const order = await createTestOrder();
            const payload = {
                paymentMethod: 'GCASH',
                gcashReferenceNumber: '12'
            };

            const res = await request(app).post(`/orders/${order.id}/payments`).send(payload);

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Validation failed');
        });

        it('should fail if order does not exist', async () => {
            const payload = {
                paymentMethod: 'CASH',
                amountTendered: 200.0
            };

            const res = await request(app).post('/orders/00000000-0000-0000-0000-000000000000/payments').send(payload);

            expect(res.status).toBe(404);
            expect(res.body.error).toBe('Order not found');
        });

        it('should fail if order has already been paid', async () => {
            const order = await createTestOrder();
            await prisma.orderPayment.create({
                data: {
                    orderId: order.id,
                    paymentMethod: 'CASH',
                    paymentStatus: 'PAID',
                    amount: 120.0
                }
            });

            const payload = {
                paymentMethod: 'CASH',
                amountTendered: 200.0
            };

            const res = await request(app).post(`/orders/${order.id}/payments`).send(payload);

            expect(res.status).toBe(409);
            expect(res.body.error).toBe('Order has already been paid.');
        });

        it('should fail if order status is CANCELLED or COMPLETED', async () => {
            const cancelledOrder = await createTestOrder('POS', 'CANCELLED');
            const completedOrder = await createTestOrder('POS', 'COMPLETED');

            const payload = {
                paymentMethod: 'CASH',
                amountTendered: 200.0
            };

            const resCancelled = await request(app).post(`/orders/${cancelledOrder.id}/payments`).send(payload);
            expect(resCancelled.status).toBe(400);
            expect(resCancelled.body.error).toBe('Cannot process payment for a cancelled order.');

            const resCompleted = await request(app).post(`/orders/${completedOrder.id}/payments`).send(payload);
            expect(resCompleted.status).toBe(400);
            expect(resCompleted.body.error).toBe('Cannot process payment for a completed order.');
        });

        it('should fail if POS order and cashier has no active register shift', async () => {
            // Close active shift
            await prisma.registerShift.update({
                where: { id: activeShiftId },
                data: { closedAt: new Date() }
            });

            const order = await createTestOrder('POS', 'PENDING');
            const payload = {
                paymentMethod: 'CASH',
                amountTendered: 200.0
            };

            const res = await request(app).post(`/orders/${order.id}/payments`).send(payload);

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('active register shift');

            // Re-open register shift for subsequent actions/cleanup
            const shift = await prisma.registerShift.create({
                data: {
                    cashierId: 'test-payment-user-id',
                    startBalance: 5000.0
                }
            });
            activeShiftId = shift.id;
        });
    });

    describe('GET /orders/:orderId/payments', () => {
        it('should retrieve list of payments for an order', async () => {
            const order = await createTestOrder();
            await prisma.orderPayment.create({
                data: {
                    orderId: order.id,
                    paymentMethod: 'CASH',
                    paymentStatus: 'PAID',
                    amount: 120.0,
                    amountTendered: 150.0,
                    amountChange: 30.0
                }
            });

            const res = await request(app).get(`/orders/${order.id}/payments`);

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body.length).toBe(1);
            expect(res.body[0].paymentMethod).toBe('CASH');
            expect(res.body[0].amount).toBe(120.0);
        });

        it('should fail if order does not exist', async () => {
            const res = await request(app).get('/orders/00000000-0000-0000-0000-000000000000/payments');
            expect(res.status).toBe(404);
            expect(res.body.error).toBe('Order not found');
        });
    });
});
