import { vi, describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// Mock rbac middleware
vi.mock('@/middleware/rbac.middleware', () => ({
    requireAccess: vi.fn(() => (req: Request, res: Response, next: NextFunction) => {
        req.user = {
            sub: 'test-receipt-user-id',
            email: 'testreceipt@example.com',
            username: 'testreceiptuser',
            roles: ['Administrator']
        };
        req.rbacScope = 'All';
        next();
    }),
    authenticate: vi.fn((req: Request, res: Response, next: NextFunction) => {
        req.user = {
            sub: 'test-receipt-user-id',
            email: 'testreceipt@example.com',
            username: 'testreceiptuser',
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
import { PrismaClient, StoreSetting } from '@prisma/client';
import orderRouter from '@/feature/order/order.route';
import { HttpException } from '@/exceptions/http.exception';

describe('Order Receipt Integration Tests', () => {
    let app: express.Application;
    let prisma: PrismaClient;

    let testCategoryId: string;
    let testTypeId: string;
    let testProductId: string;
    let testVariantId: string;
    let testModifierGroupId: string;
    let testModifierOptionId: string;
    let activeShiftId: string;
    let testOrderId: string;
    let testDiscountId: string;
    let originalStoreSettings: StoreSetting[] = [];

    beforeAll(async () => {
        prisma = new PrismaClient();
        app = express();

        app.use(express.json());
        app.use('/orders', orderRouter);

        // Error handler
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        app.use((err: HttpException | Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
            const status = err instanceof HttpException ? err.statusCode : 500;
            res.status(status).json({ error: err.message });
        });

        // 1. Ensure isolated mock user record exists
        await prisma.user.upsert({
            where: { id: 'test-receipt-user-id' },
            update: {},
            create: {
                id: 'test-receipt-user-id',
                email: 'testreceipt@example.com',
                username: 'testreceiptuser',
                password: 'hashedpassword123',
                firstName: 'Test',
                lastName: 'Receipt'
            }
        });

        // 2. Create category & type
        const category = await prisma.productCategory.create({
            data: {
                name: 'Receipt Test Category',
                createdById: 'test-receipt-user-id',
                updatedById: 'test-receipt-user-id'
            }
        });
        testCategoryId = category.id;

        const ptype = await prisma.productType.create({
            data: {
                name: 'Receipt Test Type',
                createdById: 'test-receipt-user-id',
                updatedById: 'test-receipt-user-id'
            }
        });
        testTypeId = ptype.id;

        // 3. Create product & variant
        const product = await prisma.product.create({
            data: {
                name: 'Receipt Espresso',
                productCategoryId: testCategoryId,
                productTypeId: testTypeId,
                createdById: 'test-receipt-user-id',
                updatedById: 'test-receipt-user-id'
            }
        });
        testProductId = product.id;

        const variant = await prisma.productVariant.create({
            data: {
                productId: testProductId,
                sku: 'RCIPT-ESP-REG',
                price: 120.0,
                createdById: 'test-receipt-user-id',
                updatedById: 'test-receipt-user-id'
            }
        });
        testVariantId = variant.id;

        // 4. Create modifier group and option
        const group = await prisma.modifierGroup.create({
            data: {
                name: 'Receipt Modifiers',
                products: { connect: { id: testProductId } }
            }
        });
        testModifierGroupId = group.id;

        const option = await prisma.modifierOption.create({
            data: {
                modifierGroupId: testModifierGroupId,
                name: 'Extra Shot',
                price: 30.0
            }
        });
        testModifierOptionId = option.id;

        // 5. Isolate store settings (save original settings, empty table, insert test setting)
        originalStoreSettings = await prisma.storeSetting.findMany();
        await prisma.storeSetting.deleteMany();

        await prisma.storeSetting.create({
            data: {
                storeName: 'Receipt Cafe Test',
                address: '123 Receipt Lane',
                contactNumber: '09123456789',
                openingTime: '07:00',
                closingTime: '21:00',
                vatRate: 12.0,
                serviceCharge: 0.0
            }
        });

        // 6. Open register shift
        const shift = await prisma.registerShift.create({
            data: {
                cashierId: 'test-receipt-user-id',
                startBalance: 1000
            }
        });
        activeShiftId = shift.id;

        // 7. Seed order discount configuration
        const discount = await prisma.discount.create({
            data: {
                name: 'Promo 10%',
                type: 'PERCENTAGE',
                value: 10.0,
                code: 'RCPT10'
            }
        });
        testDiscountId = discount.id;

        // 8. Create full completed order with item, modifier, payment, discount, status history
        const order = await prisma.order.create({
            data: {
                queueNumber: '#R01',
                orderType: 'DINE_IN',
                orderSource: 'POS',
                subtotal: 150.0, // variant 120 + modifier 30
                taxAmount: 14.46, // inclusive VAT of (150 - 15) = 135 * 12 / 112 = 14.46
                discountAmount: 15.0, // 10% of 150
                netTotal: 135.0,
                cashierSessionId: activeShiftId,
                status: 'COMPLETED',
                items: {
                    create: {
                        productVariantId: testVariantId,
                        quantity: 1,
                        unitPrice: 150.0,
                        totalPrice: 150.0,
                        modifiers: {
                            create: {
                                modifierOptionId: testModifierOptionId,
                                price: 30.0
                            }
                        }
                    }
                },
                payments: {
                    create: {
                        paymentMethod: 'CASH',
                        paymentStatus: 'PAID',
                        amount: 135.0,
                        amountTendered: 150.0,
                        amountChange: 15.0
                    }
                },
                discounts: {
                    create: {
                        discountId: testDiscountId,
                        amount: 15.0
                    }
                },
                statusHistory: {
                    create: {
                        status: 'COMPLETED',
                        notes: 'Paid and served',
                        changedById: 'test-receipt-user-id'
                    }
                }
            }
        });
        testOrderId = order.id;
    });

    afterAll(async () => {
        // Cleanup seeded data
        await prisma.orderDiscount.deleteMany({ where: { orderId: testOrderId } });
        await prisma.orderPayment.deleteMany({ where: { orderId: testOrderId } });
        await prisma.orderStatusHistory.deleteMany({ where: { orderId: testOrderId } });
        await prisma.orderItemModifier.deleteMany({
            where: { orderItem: { orderId: testOrderId } }
        });
        await prisma.orderItem.deleteMany({ where: { orderId: testOrderId } });
        await prisma.order.deleteMany({ where: { id: testOrderId } });
        await prisma.registerShift.deleteMany({ where: { id: activeShiftId } });
        await prisma.modifierOption.deleteMany({ where: { modifierGroupId: testModifierGroupId } });
        await prisma.modifierGroup.deleteMany({ where: { id: testModifierGroupId } });
        await prisma.productVariant.deleteMany({ where: { id: testVariantId } });
        await prisma.product.deleteMany({ where: { id: testProductId } });
        await prisma.productType.deleteMany({ where: { id: testTypeId } });
        await prisma.productCategory.deleteMany({ where: { id: testCategoryId } });
        await prisma.discount.deleteMany({ where: { id: testDiscountId } });
        await prisma.user.deleteMany({ where: { id: 'test-receipt-user-id' } });

        // Restore original store settings
        await prisma.storeSetting.deleteMany();
        if (originalStoreSettings && originalStoreSettings.length > 0) {
            for (const setting of originalStoreSettings) {
                await prisma.storeSetting.create({
                    data: {
                        id: setting.id,
                        storeName: setting.storeName,
                        address: setting.address,
                        contactNumber: setting.contactNumber,
                        openingTime: setting.openingTime,
                        closingTime: setting.closingTime,
                        vatRate: setting.vatRate,
                        serviceCharge: setting.serviceCharge
                    }
                });
            }
        }

        await prisma.$disconnect();
    });

    describe('GET /orders/:id/receipt', () => {
        it('should successfully generate receipt in JSON format', async () => {
            const res = await request(app).get(`/orders/${testOrderId}/receipt?format=json`);

            expect(res.status).toBe(200);
            expect(res.header['content-type']).toContain('application/json');
            expect(res.body).toHaveProperty('order');
            expect(res.body).toHaveProperty('storeSetting');
            expect(res.body.order.id).toBe(testOrderId);
            expect(res.body.storeSetting.storeName).toBe('Receipt Cafe Test');
        });

        it('should successfully generate receipt in HTML format', async () => {
            const res = await request(app).get(`/orders/${testOrderId}/receipt?format=html`);

            expect(res.status).toBe(200);
            expect(res.header['content-type']).toContain('text/html');
            expect(res.text).toContain('RECEIPT CAFE TEST');
            expect(res.text).toContain('Receipt Espresso');
            expect(res.text).toContain('Extra Shot');
            expect(res.text).toContain('Promo 10%');
            expect(res.text).toContain('NET TOTAL');
        });

        it('should successfully generate receipt in plain text format', async () => {
            const res = await request(app).get(`/orders/${testOrderId}/receipt?format=text`);

            expect(res.status).toBe(200);
            expect(res.header['content-type']).toContain('text/plain');
            expect(res.text).toContain('RECEIPT CAFE TEST');
            expect(res.text).toContain('Receipt Espresso');
            expect(res.text).toContain('Extra Shot');
            expect(res.text).toContain('Subtotal:');
            expect(res.text).toContain('NET TOTAL:');
        });

        it('should successfully generate receipt in PDF format', async () => {
            const res = await request(app).get(`/orders/${testOrderId}/receipt?format=pdf`);

            expect(res.status).toBe(200);
            expect(res.header['content-type']).toContain('application/pdf');
            expect(res.body).toBeDefined(); // Binary PDF output
        });

        it('should fail with 404 when order ID does not exist', async () => {
            const fakeId = '00000000-0000-0000-0000-000000000000';
            const res = await request(app).get(`/orders/${fakeId}/receipt`);

            expect(res.status).toBe(404);
            expect(res.body.error).toContain('Order not found');
        });
    });
});
