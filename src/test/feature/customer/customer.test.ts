import { vi, describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// Mock rbac middleware to use a unique user ID and prevent test collisions
vi.mock('@/middleware/rbac.middleware', () => ({
    requireAccess: vi.fn(() => (req: Request, res: Response, next: NextFunction) => {
        req.user = {
            sub: 'test-customer-admin-id',
            email: 'testcustomeradmin@example.com',
            username: 'testcustomeradmin',
            roles: ['Administrator']
        };
        req.rbacScope = 'All';
        next();
    }),
    authenticate: vi.fn((req: Request, res: Response, next: NextFunction) => {
        req.user = {
            sub: 'test-customer-admin-id',
            email: 'testcustomeradmin@example.com',
            username: 'testcustomeradmin',
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
import customerRouter from '@/feature/customer/customer.route';
import { HttpException } from '@/exceptions/http.exception';

describe('Customer Feature CRUD', () => {
    let app: express.Application;
    let prisma: PrismaClient;
    let testCustomerId: string;
    let testCustomerUserId: string;
    let testCartItemId: string;

    beforeAll(async () => {
        prisma = new PrismaClient();
        app = express();

        app.use(express.json());
        app.use('/customers', customerRouter);

        // Error handler
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        app.use((err: HttpException, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
            const status = err.statusCode || 500;
            res.status(status).json({ error: err.message });
        });

        // 1. Ensure isolated mock admin user record exists
        await prisma.user.upsert({
            where: { id: 'test-customer-admin-id' },
            update: {},
            create: {
                id: 'test-customer-admin-id',
                email: 'testcustomeradmin@example.com',
                username: 'testcustomeradmin',
                password: 'hashedpassword123',
                firstName: 'Test',
                lastName: 'Admin'
            }
        });

        // 2. Ensure Customer Role exists so relation creation works
        await prisma.role.upsert({
            where: { name: 'Customer' },
            update: {},
            create: {
                name: 'Customer',
                description: 'Customer role'
            }
        });

        // 3. Ensure Category, Type, Product, and Variant exist for cart testing
        await prisma.productCategory.upsert({
            where: { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' },
            update: {},
            create: {
                id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
                name: 'Customer Test Category'
            }
        });

        await prisma.productType.upsert({
            where: { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12' },
            update: {},
            create: {
                id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',
                name: 'Customer Test Type'
            }
        });

        await prisma.product.upsert({
            where: { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13' },
            update: {},
            create: {
                id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13',
                name: 'Customer Test Coffee',
                productCategoryId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
                productTypeId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'
            }
        });

        await prisma.productVariant.upsert({
            where: { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14' },
            update: {},
            create: {
                id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14',
                productId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13',
                sku: 'TEST-SKU',
                price: 150.0
            }
        });
    });

    afterAll(async () => {
        // Cleanup all records created
        if (testCustomerId) {
            await prisma.customerCart.deleteMany({
                where: { customerId: testCustomerId }
            });
            await prisma.orderStatusHistory.deleteMany({
                where: { order: { customerId: testCustomerId } }
            });
            await prisma.orderItem.deleteMany({
                where: { order: { customerId: testCustomerId } }
            });
            await prisma.order.deleteMany({
                where: { customerId: testCustomerId }
            });
            await prisma.customer.deleteMany({
                where: { id: testCustomerId }
            });
        }

        if (testCustomerUserId) {
            await prisma.userRole.deleteMany({
                where: { userId: testCustomerUserId }
            });
            await prisma.user.deleteMany({
                where: { id: testCustomerUserId }
            });
        }

        await prisma.productVariant.deleteMany({
            where: { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14' }
        });
        await prisma.product.deleteMany({
            where: { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13' }
        });
        await prisma.productCategory.deleteMany({
            where: { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' }
        });
        await prisma.productType.deleteMany({
            where: { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12' }
        });

        await prisma.user.deleteMany({
            where: { id: 'test-customer-admin-id' }
        });

        await prisma.$disconnect();
    });

    describe('Customer Management CRUD Operations', () => {
        it('should create a new customer successfully', async () => {
            const payload = {
                email: 'test_charlie@example.com',
                username: 'test_charlie',
                firstName: 'Charlie',
                lastName: 'Customer',
                phoneNumber: '+639170000000'
            };

            const res = await request(app).post('/customers').send(payload);
            expect(res.status).toBe(201);
            expect(res.body).toHaveProperty('id');
            expect(res.body).toHaveProperty('userId');
            expect(res.body.user).toBeDefined();
            expect(res.body.user.email).toBe('test_charlie@example.com');
            expect(res.body.user.firstName).toBe('Charlie');
            expect(res.body.user.lastName).toBe('Customer');
            expect(res.body.user.phoneNumber).toBe('+639170000000');

            testCustomerId = res.body.id;
            testCustomerUserId = res.body.userId;
        });

        it('should return 409 when creating customer with duplicate email', async () => {
            const payload = {
                email: 'test_charlie@example.com',
                username: 'test_charlie_diff',
                firstName: 'Charlie',
                lastName: 'Customer'
            };

            const res = await request(app).post('/customers').send(payload);
            expect(res.status).toBe(409);
        });

        it('should fetch the list of customers', async () => {
            const res = await request(app).get('/customers?limit=10');
            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('data');
            expect(res.body).toHaveProperty('meta');
            expect(res.body.data.length).toBeGreaterThanOrEqual(1);

            const found = res.body.data.find((c: { id: string }) => c.id === testCustomerId);
            expect(found).toBeDefined();
            expect(found.user.email).toBe('test_charlie@example.com');
        });

        it('should retrieve a single customer by ID', async () => {
            const res = await request(app).get(`/customers/${testCustomerId}`);
            expect(res.status).toBe(200);
            expect(res.body.id).toBe(testCustomerId);
            expect(res.body.user.email).toBe('test_charlie@example.com');
        });

        it('should update a customer successfully', async () => {
            const payload = {
                firstName: 'Charlie Updated',
                phoneNumber: '+639171111111'
            };

            const res = await request(app).put(`/customers/${testCustomerId}`).send(payload);
            expect(res.status).toBe(200);
            expect(res.body.user.firstName).toBe('Charlie Updated');
            expect(res.body.user.phoneNumber).toBe('+639171111111');
        });
    });

    describe('Customer Cart Sub-Resource Operations', () => {
        it('should fetch an empty cart initially', async () => {
            const res = await request(app).get(`/customers/${testCustomerId}/cart`);
            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('items');
            expect(res.body.items).toHaveLength(0);
            expect(res.body.totalAmount).toBe(0);
        });

        it('should add a product variant to the cart', async () => {
            const payload = {
                productVariantId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14',
                quantity: 2
            };

            const res = await request(app).post(`/customers/${testCustomerId}/cart`).send(payload);
            expect(res.status).toBe(201);
            expect(res.body).toHaveProperty('id');
            expect(res.body.quantity).toBe(2);
            expect(res.body.unitPrice).toBe(150.0);
            expect(res.body.productVariant).toBeDefined();
            expect(res.body.productVariant.product.name).toBe('Customer Test Coffee');

            testCartItemId = res.body.id;
        });

        it('should increment quantity when adding the same variant to cart', async () => {
            const payload = {
                productVariantId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14',
                quantity: 1
            };

            const res = await request(app).post(`/customers/${testCustomerId}/cart`).send(payload);
            expect(res.status).toBe(201);
            expect(res.body.id).toBe(testCartItemId);
            expect(res.body.quantity).toBe(3);
        });

        it('should fetch the cart containing the added items and correct total', async () => {
            const res = await request(app).get(`/customers/${testCustomerId}/cart`);
            expect(res.status).toBe(200);
            expect(res.body.items).toHaveLength(1);
            expect(res.body.items[0].id).toBe(testCartItemId);
            expect(res.body.items[0].quantity).toBe(3);
            expect(res.body.totalAmount).toBe(450.0);
        });

        it('should update cart item quantity successfully', async () => {
            const payload = {
                quantity: 5
            };

            const res = await request(app).put(`/customers/${testCustomerId}/cart/${testCartItemId}`).send(payload);
            expect(res.status).toBe(200);
            expect(res.body.quantity).toBe(5);

            // Fetch to check total
            const cartRes = await request(app).get(`/customers/${testCustomerId}/cart`);
            expect(cartRes.body.totalAmount).toBe(750.0);
        });

        it('should remove a specific item from the cart', async () => {
            const res = await request(app).delete(`/customers/${testCustomerId}/cart/${testCartItemId}`);
            expect(res.status).toBe(200);

            // Verify cart is empty
            const cartRes = await request(app).get(`/customers/${testCustomerId}/cart`);
            expect(cartRes.body.items).toHaveLength(0);
        });

        it('should clear all items in the cart', async () => {
            // Add item back
            await request(app)
                .post(`/customers/${testCustomerId}/cart`)
                .send({ productVariantId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14', quantity: 1 });

            // Clear cart
            const res = await request(app).delete(`/customers/${testCustomerId}/cart`);
            expect(res.status).toBe(200);

            // Verify cart is cleared
            const cartRes = await request(app).get(`/customers/${testCustomerId}/cart`);
            expect(cartRes.body.items).toHaveLength(0);
        });
    });

    describe('Customer Order History Operations', () => {
        it('should fetch an empty order list initially', async () => {
            const res = await request(app).get(`/customers/${testCustomerId}/orders`);
            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('data');
            expect(res.body.data).toHaveLength(0);
            expect(res.body.meta.total).toBe(0);
        });

        it('should retrieve customer orders after placing an order', async () => {
            // Create a test order referencing this customer
            const order = await prisma.order.create({
                data: {
                    customerId: testCustomerId,
                    queueNumber: '#099',
                    orderType: 'DINE_IN',
                    orderSource: 'MOBILE_APP',
                    subtotal: 150.0,
                    taxAmount: 16.07,
                    netTotal: 150.0,
                    notes: 'Extra sugar test customer orders',
                    items: {
                        create: {
                            productVariantId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14',
                            quantity: 1,
                            unitPrice: 150.0,
                            totalPrice: 150.0
                        }
                    }
                }
            });

            const res = await request(app).get(`/customers/${testCustomerId}/orders`);
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].id).toBe(order.id);
            expect(res.body.data[0].notes).toBe('Extra sugar test customer orders');
            expect(res.body.data[0].items[0].productVariantId).toBe('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14');
            expect(res.body.data[0].items[0].variant.product.name).toBe('Customer Test Coffee');
            expect(res.body.meta.total).toBe(1);
        });

        it('should filter customer orders by status and search query', async () => {
            // Test search filter
            const resSearch = await request(app).get(`/customers/${testCustomerId}/orders?search=Extra%20sugar`);
            expect(resSearch.status).toBe(200);
            expect(resSearch.body.data).toHaveLength(1);

            const resSearchNone = await request(app).get(`/customers/${testCustomerId}/orders?search=nonexistent`);
            expect(resSearchNone.status).toBe(200);
            expect(resSearchNone.body.data).toHaveLength(0);

            // Test status filter
            const resStatusPending = await request(app).get(`/customers/${testCustomerId}/orders?status=PENDING`);
            expect(resStatusPending.status).toBe(200);
            expect(resStatusPending.body.data).toHaveLength(1);

            const resStatusCompleted = await request(app).get(`/customers/${testCustomerId}/orders?status=COMPLETED`);
            expect(resStatusCompleted.status).toBe(200);
            expect(resStatusCompleted.body.data).toHaveLength(0);
        });
    });

    describe('Customer Cleanup/Soft Delete Operations', () => {
        it('should soft-delete a customer and their user record', async () => {
            const res = await request(app).delete(`/customers/${testCustomerId}`);
            expect(res.status).toBe(200);

            // Verify customer soft-deleted
            const deletedCustomer = await prisma.customer.findUnique({
                where: { id: testCustomerId }
            });
            expect(deletedCustomer?.deletedAt).not.toBeNull();

            // Verify user soft-deleted
            const deletedUser = await prisma.user.findUnique({
                where: { id: testCustomerUserId }
            });
            expect(deletedUser?.deletedAt).not.toBeNull();
        });
    });
});
