import { vi, describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// Mock rbac middleware to use a unique user ID and prevent test collisions
vi.mock('@/middleware/rbac.middleware', () => ({
    requireAccess: vi.fn(() => (req: Request, res: Response, next: NextFunction) => {
        req.user = {
            sub: 'test-cashier-user-id',
            email: 'testcashier@example.com',
            username: 'testcashieruser',
            roles: ['Cashier']
        };
        req.rbacScope = 'Store';
        next();
    }),
    authenticate: vi.fn((req: Request, res: Response, next: NextFunction) => {
        req.user = {
            sub: 'test-cashier-user-id',
            email: 'testcashier@example.com',
            username: 'testcashieruser',
            roles: ['Cashier']
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
import registerShiftRouter from '@/feature/register-shift/register-shift.route';
import { HttpException } from '@/exceptions/http.exception';
import { ZodError } from 'zod';

describe('Register Shift Feature CRUD', () => {
    let app: express.Application;
    let prisma: PrismaClient;
    let createdShiftId: string;

    beforeAll(async () => {
        prisma = new PrismaClient();
        app = express();

        app.use(express.json());
        app.use('/register-shifts', registerShiftRouter);

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

        // Ensure isolated mock user record exists
        await prisma.user.upsert({
            where: { id: 'test-cashier-user-id' },
            update: {},
            create: {
                id: 'test-cashier-user-id',
                email: 'testcashier@example.com',
                username: 'testcashieruser',
                password: 'hashedpassword123',
                firstName: 'Test',
                lastName: 'Cashier'
            }
        });

        // Clean up any existing shifts for this cashier
        await prisma.registerShift.deleteMany({
            where: { cashierId: 'test-cashier-user-id' }
        });
    });

    afterAll(async () => {
        // Cleanup all records created
        await prisma.orderPayment.deleteMany({
            where: {
                order: {
                    cashierSession: {
                        cashierId: 'test-cashier-user-id'
                    }
                }
            }
        });
        await prisma.order.deleteMany({
            where: {
                cashierSession: {
                    cashierId: 'test-cashier-user-id'
                }
            }
        });
        await prisma.registerShift.deleteMany({
            where: { cashierId: 'test-cashier-user-id' }
        });
        await prisma.user.deleteMany({
            where: {
                id: 'test-cashier-user-id'
            }
        });

        await prisma.$disconnect();
    });

    describe('Register Shift Operations', () => {
        it('should return 404 when getting active shift when none is open', async () => {
            const res = await request(app).get('/register-shifts/active');
            expect(res.status).toBe(404);
            expect(res.body.error).toContain('No active register shift');
        });

        it('should open a new shift successfully via POST /open', async () => {
            const payload = {
                startBalance: 2000,
                notes: 'Morning Shift Start'
            };

            const res = await request(app).post('/register-shifts/open').send(payload);
            expect(res.status).toBe(201);
            expect(res.body).toHaveProperty('id');
            expect(res.body.cashierId).toBe('test-cashier-user-id');
            expect(res.body.startBalance).toBe(2000);
            expect(res.body.closedAt).toBeNull();
            expect(res.body.notes).toBe('Morning Shift Start');

            createdShiftId = res.body.id;
        });

        it('should return 409 conflict when trying to open a new shift while one is active', async () => {
            const payload = {
                startBalance: 1500
            };

            const res = await request(app).post('/register-shifts/open').send(payload);
            expect(res.status).toBe(409);
            expect(res.body.error).toContain('already have an active register shift');
        });

        it('should fetch the active shift successfully via GET /active', async () => {
            const res = await request(app).get('/register-shifts/active');
            expect(res.status).toBe(200);
            expect(res.body.id).toBe(createdShiftId);
            expect(res.body.closedAt).toBeNull();
        });

        it('should calculate expected balance during shift closure with complete sales', async () => {
            // Seed a completed cash order associated with this shift session
            const order = await prisma.order.create({
                data: {
                    cashierSessionId: createdShiftId,
                    subtotal: 350.5,
                    netTotal: 350.5,
                    status: 'COMPLETED'
                }
            });

            await prisma.orderPayment.create({
                data: {
                    orderId: order.id,
                    paymentMethod: 'CASH',
                    paymentStatus: 'PAID',
                    amount: 350.5
                }
            });

            // Close the shift
            // Expected end balance: startBalance (2000) + cashSales (350.50) = 2350.50
            const payload = {
                actualBalance: 2350.5,
                notes: 'Balanced drawer closing'
            };

            const res = await request(app).post('/register-shifts/close').send(payload);
            expect(res.status).toBe(200);
            expect(res.body.closedAt).not.toBeNull();
            expect(res.body.endBalance).toBe(2350.5);
            expect(res.body.actualBalance).toBe(2350.5);
            expect(res.body.notes).toBe('Balanced drawer closing');
        });

        it('should return 404 when trying to close a shift when none is open', async () => {
            const payload = {
                actualBalance: 2000
            };

            const res = await request(app).post('/register-shifts/close').send(payload);
            expect(res.status).toBe(404);
            expect(res.body.error).toContain('No active register shift');
        });
    });
});
