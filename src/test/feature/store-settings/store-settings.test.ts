import { vi, describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// Mock rbac middleware to use a unique user ID and prevent test collisions
vi.mock('@/middleware/rbac.middleware', () => ({
    requireAccess: vi.fn(() => (req: Request, res: Response, next: NextFunction) => {
        req.user = {
            sub: 'test-settings-user-id',
            email: 'testsettings@example.com',
            username: 'testsettingsuser',
            roles: ['Administrator']
        };
        req.rbacScope = 'All';
        next();
    }),
    authenticate: vi.fn((req: Request, res: Response, next: NextFunction) => {
        req.user = {
            sub: 'test-settings-user-id',
            email: 'testsettings@example.com',
            username: 'testsettingsuser',
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
import storeSettingsRouter from '@/feature/store-settings/store-settings.route';
import { HttpException } from '@/exceptions/http.exception';
import { ZodError } from 'zod';

describe('Store Settings Feature CRUD', () => {
    let app: express.Application;
    let prisma: PrismaClient;
    let createdSettingId: string;

    beforeAll(async () => {
        prisma = new PrismaClient();
        app = express();

        app.use(express.json());
        app.use('/store-settings', storeSettingsRouter);

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
            where: { id: 'test-settings-user-id' },
            update: {},
            create: {
                id: 'test-settings-user-id',
                email: 'testsettings@example.com',
                username: 'testsettingsuser',
                password: 'hashedpassword123',
                firstName: 'Test',
                lastName: 'User'
            }
        });

        // Clean up any existing store settings to start fresh
        await prisma.storeSetting.deleteMany({});
    });

    afterAll(async () => {
        // Cleanup all records created
        await prisma.storeSetting.deleteMany({});
        await prisma.user.deleteMany({
            where: {
                id: 'test-settings-user-id'
            }
        });

        await prisma.$disconnect();
    });

    describe('Store Settings CRUD Operations', () => {
        it('should automatically create and return default settings on GET if database is empty', async () => {
            const res = await request(app).get('/store-settings');
            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('id');
            expect(res.body.storeName).toBe('Basta Kape');
            expect(res.body.address).toBe('50 K-1st, Quezon City, Metro Manila');
            expect(res.body.openingTime).toBe('07:00');
            expect(res.body.closingTime).toBe('21:00');
            expect(res.body.vatRate).toBe(12.0);
            expect(res.body.serviceCharge).toBe(0.0);

            createdSettingId = res.body.id;
        });

        it('should return 409 conflict when trying to POST settings if one already exists', async () => {
            const payload = {
                storeName: 'Another Kape',
                address: '123 Coffee St',
                openingTime: '08:00',
                closingTime: '22:00',
                vatRate: 12.0,
                serviceCharge: 5.0
            };

            const res = await request(app).post('/store-settings').send(payload);
            expect(res.status).toBe(409);
            expect(res.body.error).toContain('already exist');
        });

        it('should update the store settings successfully via PUT', async () => {
            const payload = {
                storeName: 'Updated Basta Kape',
                address: '77 Brew Lane, QC',
                openingTime: '06:30',
                closingTime: '22:30',
                vatRate: 10.0,
                serviceCharge: 1.5
            };

            const res = await request(app).put(`/store-settings/${createdSettingId}`).send(payload);
            expect(res.status).toBe(200);
            expect(res.body.storeName).toBe('Updated Basta Kape');
            expect(res.body.address).toBe('77 Brew Lane, QC');
            expect(res.body.openingTime).toBe('06:30');
            expect(res.body.closingTime).toBe('22:30');
            expect(res.body.vatRate).toBe(10.0);
            expect(res.body.serviceCharge).toBe(1.5);
        });

        it('should return 400 when PUT payload is invalid', async () => {
            const payload = {
                openingTime: 'invalid-time',
                vatRate: -5.0
            };

            const res = await request(app).put(`/store-settings/${createdSettingId}`).send(payload);
            expect(res.status).toBe(400);
        });

        it('should delete the settings successfully via DELETE', async () => {
            const res = await request(app).delete(`/store-settings/${createdSettingId}`);
            expect(res.status).toBe(200);

            // Verify deleted
            const record = await prisma.storeSetting.findUnique({
                where: { id: createdSettingId }
            });
            expect(record).toBeNull();
        });

        it('should create new settings successfully via POST when none exists', async () => {
            const payload = {
                storeName: 'Fresh Brewed Kape',
                address: '99 Espresso Ave, Manila',
                openingTime: '09:00',
                closingTime: '20:00',
                vatRate: 12.0,
                serviceCharge: 2.0
            };

            const res = await request(app).post('/store-settings').send(payload);
            expect(res.status).toBe(201);
            expect(res.body.storeName).toBe('Fresh Brewed Kape');
            expect(res.body.address).toBe('99 Espresso Ave, Manila');
            expect(res.body.openingTime).toBe('09:00');
            expect(res.body.closingTime).toBe('20:00');
            expect(res.body.vatRate).toBe(12.0);
            expect(res.body.serviceCharge).toBe(2.0);
        });
    });
});
