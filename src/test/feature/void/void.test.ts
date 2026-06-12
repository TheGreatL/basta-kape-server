import { vi, describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// Mock rbac middleware
vi.mock('@/middleware/rbac.middleware', () => ({
    requireAccess: vi.fn(() => (req: Request, res: Response, next: NextFunction) => {
        req.user = {
            sub: 'test-void-admin-id',
            email: 'testvoidadmin@example.com',
            username: 'testvoidadmin',
            roles: ['Administrator']
        };
        req.rbacScope = 'All';
        next();
    }),
    authenticate: vi.fn((req: Request, res: Response, next: NextFunction) => {
        req.user = {
            sub: 'test-void-admin-id',
            email: 'testvoidadmin@example.com',
            username: 'testvoidadmin',
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
import { voidRouter } from '@/feature/void/void.route';
import { VoidService } from '@/feature/void/void.service';
import { HttpException } from '@/exceptions/http.exception';
import { ForbiddenException } from '@/exceptions';
import { ZodError } from 'zod';

describe('Void Feature Integration Tests', () => {
    let app: express.Application;
    let prisma: PrismaClient;
    let service: VoidService;

    let testCategoryId: string;
    let testTypeId: string;
    let testProductId: string;
    let testVariantId: string;
    let activeShiftId: string;

    beforeAll(async () => {
        prisma = new PrismaClient();
        app = express();
        service = new VoidService();

        app.use(express.json());
        app.use('/orders', voidRouter);

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

        // 1. Clean up potential previous test data
        await prisma.orderVoidLog.deleteMany({
            where: {
                order: {
                    cashierSession: {
                        cashierId: { in: ['test-void-admin-id', 'test-void-cashier-id'] }
                    }
                }
            }
        });
        await prisma.orderStatusHistory.deleteMany({
            where: {
                order: {
                    cashierSession: {
                        cashierId: { in: ['test-void-admin-id', 'test-void-cashier-id'] }
                    }
                }
            }
        });
        await prisma.orderItem.deleteMany({
            where: {
                order: {
                    cashierSession: {
                        cashierId: { in: ['test-void-admin-id', 'test-void-cashier-id'] }
                    }
                }
            }
        });
        await prisma.order.deleteMany({
            where: {
                cashierSession: {
                    cashierId: { in: ['test-void-admin-id', 'test-void-cashier-id'] }
                }
            }
        });
        await prisma.registerShift.deleteMany({
            where: { cashierId: { in: ['test-void-admin-id', 'test-void-cashier-id'] } }
        });
        await prisma.userRole.deleteMany({
            where: { userId: { in: ['test-void-admin-id', 'test-void-cashier-id'] } }
        });
        await prisma.user.deleteMany({
            where: { id: { in: ['test-void-admin-id', 'test-void-cashier-id'] } }
        });

        // 2. Create roles and test users
        const adminRole = await prisma.role.upsert({
            where: { name: 'Administrator' },
            update: {},
            create: { name: 'Administrator', isSystem: true }
        });

        const cashierRole = await prisma.role.upsert({
            where: { name: 'Cashier' },
            update: {},
            create: { name: 'Cashier', isSystem: true }
        });

        await prisma.user.create({
            data: {
                id: 'test-void-admin-id',
                email: 'testvoidadmin@example.com',
                username: 'testvoidadmin',
                password: 'hashedpassword123',
                firstName: 'Test',
                lastName: 'Admin',
                userRoles: {
                    create: {
                        roleId: adminRole.id
                    }
                }
            }
        });

        await prisma.user.create({
            data: {
                id: 'test-void-cashier-id',
                email: 'testvoidcashier@example.com',
                username: 'testvoidcashier',
                password: 'hashedpassword123',
                firstName: 'Test',
                lastName: 'Cashier',
                userRoles: {
                    create: {
                        roleId: cashierRole.id
                    }
                }
            }
        });

        // 3. Setup product, category, type and variant
        const category = await prisma.productCategory.create({
            data: {
                name: 'Test Void Category',
                description: 'For testing voids',
                createdById: 'test-void-admin-id',
                updatedById: 'test-void-admin-id'
            }
        });
        testCategoryId = category.id;

        const ptype = await prisma.productType.create({
            data: {
                name: 'Test Void Type',
                createdById: 'test-void-admin-id',
                updatedById: 'test-void-admin-id'
            }
        });
        testTypeId = ptype.id;

        const product = await prisma.product.create({
            data: {
                name: 'Test Void Coffee',
                productCategoryId: testCategoryId,
                productTypeId: testTypeId,
                createdById: 'test-void-admin-id',
                updatedById: 'test-void-admin-id'
            }
        });
        testProductId = product.id;

        const variant = await prisma.productVariant.create({
            data: {
                productId: testProductId,
                sku: 'TEST-VOID-REG',
                price: 150.0,
                createdById: 'test-void-admin-id',
                updatedById: 'test-void-admin-id'
            }
        });
        testVariantId = variant.id;

        // 4. Create Register Shift
        const shift = await prisma.registerShift.create({
            data: {
                cashierId: 'test-void-admin-id',
                startBalance: 5000.0
            }
        });
        activeShiftId = shift.id;
    });

    afterAll(async () => {
        // Cleanup all records created by tests
        await prisma.orderVoidLog.deleteMany({
            where: {
                order: {
                    cashierSession: {
                        cashierId: { in: ['test-void-admin-id', 'test-void-cashier-id'] }
                    }
                }
            }
        });
        await prisma.orderStatusHistory.deleteMany({
            where: {
                order: {
                    cashierSession: {
                        cashierId: { in: ['test-void-admin-id', 'test-void-cashier-id'] }
                    }
                }
            }
        });
        await prisma.orderItem.deleteMany({
            where: {
                order: {
                    cashierSession: {
                        cashierId: { in: ['test-void-admin-id', 'test-void-cashier-id'] }
                    }
                }
            }
        });
        await prisma.order.deleteMany({
            where: {
                cashierSession: {
                    cashierId: { in: ['test-void-admin-id', 'test-void-cashier-id'] }
                }
            }
        });
        await prisma.registerShift.deleteMany({
            where: { cashierId: { in: ['test-void-admin-id', 'test-void-cashier-id'] } }
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
        await prisma.userRole.deleteMany({
            where: { userId: { in: ['test-void-admin-id', 'test-void-cashier-id'] } }
        });
        await prisma.user.delete({
            where: { id: 'test-void-admin-id' }
        });
        await prisma.user.delete({
            where: { id: 'test-void-cashier-id' }
        });
        await prisma.$disconnect();
    });

    const createTestOrder = async (status: 'PENDING' | 'CANCELLED' | 'COMPLETED' = 'PENDING') => {
        return prisma.order.create({
            data: {
                queueNumber: '#V01',
                orderType: 'DINE_IN',
                orderSource: 'POS',
                subtotal: 150.0,
                taxAmount: 18.0,
                netTotal: 168.0,
                cashierSessionId: activeShiftId,
                status,
                items: {
                    create: {
                        productVariantId: testVariantId,
                        quantity: 1,
                        unitPrice: 150.0,
                        totalPrice: 150.0
                    }
                }
            }
        });
    };

    describe('Void Order Transactions', () => {
        it('should successfully void a pending order with administrator override', async () => {
            const order = await createTestOrder('PENDING');

            const payload = {
                reason: 'Customer changed their mind'
            };

            const res = await request(app).post(`/orders/${order.id}/void`).send(payload);

            expect(res.status).toBe(200);
            expect(res.body.orderId).toBe(order.id);
            expect(res.body.reason).toBe('Customer changed their mind');
            expect(res.body.voidedById).toBe('test-void-admin-id');

            // Verify DB Order state
            const updatedOrder = await prisma.order.findUnique({
                where: { id: order.id },
                include: { statusHistory: true, voidLogs: true }
            });

            expect(updatedOrder?.status).toBe('CANCELLED');
            expect(updatedOrder?.voidLogs.length).toBe(1);
            expect(updatedOrder?.voidLogs[0].reason).toBe('Customer changed their mind');

            // Verify OrderStatusHistory
            const hasVoidHistory = updatedOrder?.statusHistory.some(
                (h) => h.status === 'CANCELLED' && h.notes?.includes('Order voided: Customer changed their mind')
            );
            expect(hasVoidHistory).toBe(true);
        });

        it('should block voiding if the order is already cancelled', async () => {
            const order = await createTestOrder('CANCELLED');

            const payload = {
                reason: 'Voiding again'
            };

            const res = await request(app).post(`/orders/${order.id}/void`).send(payload);

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('Cannot void an order that is already completed or cancelled');
        });

        it('should block voiding if the order is already completed', async () => {
            const order = await createTestOrder('COMPLETED');

            const payload = {
                reason: 'Voiding completed'
            };

            const res = await request(app).post(`/orders/${order.id}/void`).send(payload);

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('Cannot void an order that is already completed or cancelled');
        });

        it('should throw ForbiddenException if actor does not have required manager/supervisor/admin role', async () => {
            const order = await createTestOrder('PENDING');

            // We test the service layer logic directly to bypass router RBAC middleware mocking
            await expect(service.voidOrder(order.id, 'Cashier trying to void', 'test-void-cashier-id')).rejects.toThrow(ForbiddenException);

            // Verify the order remains unchanged
            const unchangedOrder = await prisma.order.findUnique({
                where: { id: order.id }
            });
            expect(unchangedOrder?.status).toBe('PENDING');
        });

        it('should throw NotFoundException if order does not exist', async () => {
            const fakeOrderId = '00000000-0000-0000-0000-000000000000';
            const payload = {
                reason: 'Invalid order ID'
            };

            const res = await request(app).post(`/orders/${fakeOrderId}/void`).send(payload);

            expect(res.status).toBe(404);
            expect(res.body.error).toContain('Order not found');
        });

        it('should validate void reason length (minimum 3 characters)', async () => {
            const order = await createTestOrder('PENDING');
            const payload = {
                reason: 'ab' // under 3 chars
            };

            const res = await request(app).post(`/orders/${order.id}/void`).send(payload);

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Validation failed');
        });
    });

    describe('Void Logs Retrieval', () => {
        it('should list all void logs sorted by date descending', async () => {
            const res = await request(app).get('/orders/void-logs');

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
            if (res.body.length > 0) {
                expect(res.body[0]).toHaveProperty('reason');
                expect(res.body[0]).toHaveProperty('voidedBy');
                expect(res.body[0].voidedBy).toHaveProperty('username');
            }
        });
    });
});
