import { vi, describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// Mock rbac middleware to use a unique user ID and prevent test collisions
vi.mock('@/middleware/rbac.middleware', () => ({
    requireAccess: vi.fn(() => (req: Request, res: Response, next: NextFunction) => {
        req.user = {
            sub: 'test-order-user-id',
            email: 'testorder@example.com',
            username: 'testorderuser',
            roles: ['Administrator']
        };
        req.rbacScope = 'All';
        next();
    }),
    authenticate: vi.fn((req: Request, res: Response, next: NextFunction) => {
        req.user = {
            sub: 'test-order-user-id',
            email: 'testorder@example.com',
            username: 'testorderuser',
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
import orderRouter from '@/feature/order/order.route';
import { HttpException } from '@/exceptions/http.exception';
import { ZodError } from 'zod';

describe('Order Feature CRUD', () => {
    let app: express.Application;
    let prisma: PrismaClient;

    // Seed IDs
    let testCategoryId: string;
    let testTypeId: string;
    let testProductId: string;
    let testVariantId: string;
    let activeShiftId: string;
    let createdOrderId: string;

    beforeAll(async () => {
        prisma = new PrismaClient();
        app = express();

        app.use(express.json());
        app.use('/orders', orderRouter);

        // Error handler
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
            where: { id: 'test-order-user-id' },
            update: {},
            create: {
                id: 'test-order-user-id',
                email: 'testorder@example.com',
                username: 'testorderuser',
                password: 'hashedpassword123',
                firstName: 'Test',
                lastName: 'Order'
            }
        });

        // 2. Create category & type
        const category = await prisma.productCategory.create({
            data: {
                name: 'Test Order Category',
                description: 'For testing orders',
                createdById: 'test-order-user-id',
                updatedById: 'test-order-user-id'
            }
        });
        testCategoryId = category.id;

        const ptype = await prisma.productType.create({
            data: {
                name: 'Test Order Type',
                description: 'For testing orders',
                createdById: 'test-order-user-id',
                updatedById: 'test-order-user-id'
            }
        });
        testTypeId = ptype.id;

        // 3. Create product & variant
        const product = await prisma.product.create({
            data: {
                name: 'Order Hot Latte',
                description: 'Latte description',
                productCategoryId: testCategoryId,
                productTypeId: testTypeId,
                createdById: 'test-order-user-id',
                updatedById: 'test-order-user-id'
            }
        });
        testProductId = product.id;

        const variant = await prisma.productVariant.create({
            data: {
                productId: testProductId,
                sku: 'TEST-ORD-LAT-LRG',
                price: 150.0,
                createdById: 'test-order-user-id',
                updatedById: 'test-order-user-id'
            }
        });
        testVariantId = variant.id;

        // 4. Ensure store settings exist
        await prisma.storeSetting.upsert({
            where: { id: 'test-store-setting-seed-id' },
            update: { vatRate: 12.0 },
            create: {
                id: 'test-store-setting-seed-id',
                storeName: 'Basta Kape Test',
                address: 'Test Address',
                vatRate: 12.0
            }
        });

        // 5. Open a Register Shift for user
        const shift = await prisma.registerShift.create({
            data: {
                cashierId: 'test-order-user-id',
                startBalance: 1000
            }
        });
        activeShiftId = shift.id;
    });

    afterAll(async () => {
        // Cleanup order histories, payments, voids, items, shifts, variants, products, categories, types, store settings, and users in correct dependency order
        await prisma.orderStatusHistory.deleteMany({
            where: {
                order: {
                    items: {
                        some: {
                            productVariantId: testVariantId
                        }
                    }
                }
            }
        });
        await prisma.orderItem.deleteMany({ where: { productVariantId: testVariantId } });
        await prisma.order.deleteMany({
            where: {
                items: {
                    some: {
                        productVariantId: testVariantId
                    }
                }
            }
        });
        await prisma.registerShift.deleteMany({ where: { cashierId: 'test-order-user-id' } });
        await prisma.productVariant.deleteMany({ where: { createdById: 'test-order-user-id' } });
        await prisma.product.deleteMany({ where: { createdById: 'test-order-user-id' } });
        await prisma.productCategory.deleteMany({ where: { createdById: 'test-order-user-id' } });
        await prisma.productType.deleteMany({ where: { createdById: 'test-order-user-id' } });
        await prisma.user.deleteMany({ where: { id: 'test-order-user-id' } });
        await prisma.storeSetting.deleteMany({ where: { id: 'test-store-setting-seed-id' } });

        await prisma.$disconnect();
    });

    describe('Order Creation & Retrieval', () => {
        it('should successfully place a POS order when shift is active', async () => {
            const payload = {
                orderType: 'DINE_IN',
                orderSource: 'POS',
                notes: 'Extra hot latte please',
                customerName: 'Customer Jane',
                items: [
                    {
                        productVariantId: testVariantId,
                        quantity: 2,
                        notes: 'no sugar'
                    }
                ]
            };

            const res = await request(app).post('/orders').send(payload);
            expect(res.status).toBe(201);
            expect(res.body).toHaveProperty('id');
            expect(res.body.queueNumber).not.toBeNull();
            expect(res.body.status).toBe('PENDING');
            expect(res.body.cashierSessionId).toBe(activeShiftId);

            // Price verification
            // subtotal: 150.00 * 2 = 300.00
            // taxAmount: 300.00 * 12% = 36.00
            // netTotal: 300.00 + 36.00 = 336.00
            expect(res.body.subtotal).toBe(300.0);
            expect(res.body.taxAmount).toBe(36.0);
            expect(res.body.netTotal).toBe(336.0);

            createdOrderId = res.body.id;
        });

        it('should fetch the list of orders', async () => {
            const res = await request(app).get('/orders?limit=10');
            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('data');
            expect(res.body).toHaveProperty('meta');
            expect(res.body.data.length).toBeGreaterThanOrEqual(1);

            const found = res.body.data.find((o: { id: string }) => o.id === createdOrderId);
            expect(found).toBeDefined();
            expect(found.queueNumber).not.toBeNull();
        });

        it('should retrieve a single order by ID', async () => {
            const res = await request(app).get(`/orders/${createdOrderId}`);
            expect(res.status).toBe(200);
            expect(res.body.id).toBe(createdOrderId);
            expect(res.body.subtotal).toBe(300.0);
            expect(res.body.items.length).toBe(1);
            expect(res.body.statusHistory.length).toBeGreaterThanOrEqual(1);
        });

        it('should successfully update order status and append to status history', async () => {
            const payload = {
                status: 'PREPARING',
                notes: 'Starting brewing cycle'
            };

            const res = await request(app).patch(`/orders/${createdOrderId}/status`).send(payload);
            expect(res.status).toBe(200);
            expect(res.body.status).toBe('PREPARING');

            // Verify history in database
            const history = await prisma.orderStatusHistory.findMany({
                where: { orderId: createdOrderId },
                orderBy: { createdAt: 'desc' }
            });

            expect(history[0].status).toBe('PREPARING');
            expect(history[0].notes).toBe('Starting brewing cycle');
        });

        it('should fail status update if status parameter is invalid', async () => {
            const payload = {
                status: 'INVALID_STATUS'
            };

            const res = await request(app).patch(`/orders/${createdOrderId}/status`).send(payload);
            expect(res.status).toBe(400);
        });
    });
});
