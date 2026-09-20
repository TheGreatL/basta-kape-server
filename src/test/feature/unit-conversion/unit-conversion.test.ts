import { vi, describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// Mock RBAC middleware
vi.mock('@/middleware/rbac.middleware', () => ({
    requireAccess: vi.fn(() => (req: Request, res: Response, next: NextFunction) => {
        req.user = {
            sub: 'test-unit-conv-user-id',
            email: 'testconv@example.com',
            username: 'testconvuser',
            roles: ['Administrator']
        };
        next();
    }),
    authenticate: vi.fn((req: Request, res: Response, next: NextFunction) => {
        req.user = {
            sub: 'test-unit-conv-user-id',
            email: 'testconv@example.com',
            username: 'testconvuser',
            roles: ['Administrator']
        };
        next();
    })
}));

import request from 'supertest';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import unitConversionRouter from '@/feature/unit-conversion/unit-conversion.route';
import inventoryRouter from '@/feature/inventory/inventory.route';
import { UnitConversionService } from '@/feature/unit-conversion/unit-conversion.service';
import { globalErrorHandler } from '@/middleware/global.middleware';

describe('Unit Conversion Integration & Logic Tests', () => {
    let app: express.Application;
    let prisma: PrismaClient;

    const testActorId = 'test-unit-conv-user-id';
    let unitTbId: string;
    let unitMlId: string;
    let unitGId: string;
    let unitScoopId: string;
    let testIngredientId: string;
    let createdConversionId: string;

    beforeAll(async () => {
        prisma = new PrismaClient();

        // Ensure user exists
        await prisma.user.upsert({
            where: { id: testActorId },
            update: {},
            create: {
                id: testActorId,
                email: 'testconv@example.com',
                username: 'testconvuser',
                password: 'password123',
                firstName: 'Test',
                lastName: 'ConvUser',
                role: {
                    connectOrCreate: {
                        where: { name: 'Administrator' },
                        create: { name: 'Administrator', description: 'Admin' }
                    }
                }
            }
        });

        // Ensure units exist
        const tb = await prisma.ingredientUnit.upsert({
            where: { id: 'test-unit-tb' },
            update: {},
            create: {
                id: 'test-unit-tb',
                name: 'Test Tablespoon',
                abbreviation: 'tb',
                createdById: testActorId
            }
        });
        unitTbId = tb.id;

        const ml = await prisma.ingredientUnit.upsert({
            where: { id: 'test-unit-ml' },
            update: {},
            create: {
                id: 'test-unit-ml',
                name: 'Test Milliliters',
                abbreviation: 'ml',
                createdById: testActorId
            }
        });
        unitMlId = ml.id;

        const g = await prisma.ingredientUnit.upsert({
            where: { id: 'test-unit-g' },
            update: {},
            create: {
                id: 'test-unit-g',
                name: 'Test Grams',
                abbreviation: 'g',
                createdById: testActorId
            }
        });
        unitGId = g.id;

        const scoop = await prisma.ingredientUnit.upsert({
            where: { id: 'test-unit-scoop' },
            update: {},
            create: {
                id: 'test-unit-scoop',
                name: 'Test Scoop',
                abbreviation: 'scoop',
                createdById: testActorId
            }
        });
        unitScoopId = scoop.id;

        // Ensure test ingredient exists
        const ing = await prisma.ingredient.upsert({
            where: { id: 'test-conv-ingredient' },
            update: {},
            create: {
                id: 'test-conv-ingredient',
                name: 'Test Matcha Powder',
                ingredientUnitId: unitGId,
                reorderPoint: 50,
                createdById: testActorId
            }
        });
        testIngredientId = ing.id;

        // Ensure test inventory exists
        await prisma.ingredientInventory.upsert({
            where: { id: 'test-conv-inventory' },
            update: { currentQuantity: 150 },
            create: {
                id: 'test-conv-inventory',
                ingredientId: testIngredientId,
                currentQuantity: 150,
                status: 'SAFE',
                createdById: testActorId
            }
        });

        // Setup test Express app
        app = express();
        app.use(express.json());
        app.use('/unit-conversions', unitConversionRouter);
        app.use('/inventory', inventoryRouter);

        // Error handler
        app.use(globalErrorHandler);
    });

    afterAll(async () => {
        // Cleanup test conversions
        await prisma.unitConversion.deleteMany({
            where: {
                OR: [{ fromUnitId: unitTbId }, { toUnitId: unitTbId }, { fromUnitId: unitScoopId }, { toUnitId: unitScoopId }]
            }
        });
        await prisma.$disconnect();
    });

    describe('UnitConversionService createConverter Unit Logic', () => {
        it('correctly calculates conversions bidirectionally and respects ingredient overrides', () => {
            const conversions = [
                // Global: 1 tb = 4 ml
                {
                    fromUnitId: 'tb',
                    toUnitId: 'ml',
                    factor: 4,
                    ingredientId: null
                },
                // Global: 1 scoop = 10 g
                {
                    fromUnitId: 'scoop',
                    toUnitId: 'g',
                    factor: 10,
                    ingredientId: null
                },
                // Ingredient-specific: For matcha (ing-1), 1 scoop = 15 g
                {
                    fromUnitId: 'scoop',
                    toUnitId: 'g',
                    factor: 15,
                    ingredientId: 'ing-1'
                }
            ];

            const converter = UnitConversionService.createConverter(conversions);

            // Same unit
            expect(converter('ml', 'ml', 100)).toBe(100);

            // Global forward: 2 tb -> ml (2 * 4 = 8)
            expect(converter('tb', 'ml', 2)).toBe(8);

            // Global reverse: 12 ml -> tb (12 / 4 = 3)
            expect(converter('ml', 'tb', 12)).toBe(3);

            // Ingredient override forward: 2 scoops of matcha -> g (2 * 15 = 30)
            expect(converter('scoop', 'g', 2, 'ing-1')).toBe(30);

            // Ingredient fallback to global: 2 scoops of other item -> g (2 * 10 = 20)
            expect(converter('scoop', 'g', 2, 'ing-other')).toBe(20);

            // Reverse with ingredient override: 30 g matcha -> scoops (30 / 15 = 2)
            expect(converter('g', 'scoop', 30, 'ing-1')).toBe(2);

            // Unknown conversion throws error
            expect(() => converter('unknown-1', 'unknown-2', 5)).toThrowError();
        });
    });

    describe('POST /unit-conversions (Create)', () => {
        it('rejects creating conversion where fromUnit and toUnit are the same', async () => {
            const res = await request(app).post('/unit-conversions').send({
                fromUnitId: unitTbId,
                toUnitId: unitTbId,
                factor: 1
            });

            expect(res.status).toBe(500); // Zod validation failure
        });

        it('successfully creates a global unit conversion (1 tb = 4 ml)', async () => {
            const res = await request(app).post('/unit-conversions').send({
                fromUnitId: unitTbId,
                toUnitId: unitMlId,
                factor: 4
            });

            expect(res.status).toBe(201);
            expect(res.body.factor).toBe(4);
            expect(res.body.fromUnitId).toBe(unitTbId);
            expect(res.body.toUnitId).toBe(unitMlId);
            expect(res.body.ingredientId).toBeNull();
            createdConversionId = res.body.id;
        });

        it('rejects duplicate conversion between the same units', async () => {
            const res = await request(app).post('/unit-conversions').send({
                fromUnitId: unitTbId,
                toUnitId: unitMlId,
                factor: 4
            });

            expect(res.status).toBe(409);
        });

        it('allows creating an ingredient-specific conversion even if units match', async () => {
            const res = await request(app).post('/unit-conversions').send({
                fromUnitId: unitScoopId,
                toUnitId: unitGId,
                factor: 15,
                ingredientId: testIngredientId
            });

            expect(res.status).toBe(201);
            expect(res.body.ingredientId).toBe(testIngredientId);
            expect(res.body.factor).toBe(15);
        });
    });

    describe('GET /unit-conversions (List & Calculator)', () => {
        it('returns paginated list of unit conversions', async () => {
            const res = await request(app).get('/unit-conversions?page=1&limit=10');

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body.data)).toBe(true);
            expect(res.body.meta.total).toBeGreaterThanOrEqual(2);
        });

        it('calculates conversion forward via /unit-conversions/convert (5 tb -> 20 ml)', async () => {
            const res = await request(app).get(`/unit-conversions/convert?fromUnitId=${unitTbId}&toUnitId=${unitMlId}&quantity=5`);

            expect(res.status).toBe(200);
            expect(res.body.originalQuantity).toBe(5);
            expect(res.body.convertedQuantity).toBe(20);
            expect(res.body.factor).toBe(4);
        });

        it('calculates conversion reverse via /unit-conversions/convert (20 ml -> 5 tb)', async () => {
            const res = await request(app).get(`/unit-conversions/convert?fromUnitId=${unitMlId}&toUnitId=${unitTbId}&quantity=20`);

            expect(res.status).toBe(200);
            expect(res.body.originalQuantity).toBe(20);
            expect(res.body.convertedQuantity).toBe(5);
            expect(res.body.factor).toBe(0.25);
        });

        it('calculates ingredient-specific conversion (2 scoops -> 30 g)', async () => {
            const res = await request(app).get(
                `/unit-conversions/convert?fromUnitId=${unitScoopId}&toUnitId=${unitGId}&quantity=2&ingredientId=${testIngredientId}`
            );

            expect(res.status).toBe(200);
            expect(res.body.originalQuantity).toBe(2);
            expect(res.body.convertedQuantity).toBe(30);
            expect(res.body.factor).toBe(15);
        });
    });

    describe('PUT & DELETE /unit-conversions/:id', () => {
        it('updates conversion factor', async () => {
            const res = await request(app).put(`/unit-conversions/${createdConversionId}`).send({ factor: 4.5 });

            expect(res.status).toBe(200);
            expect(res.body.factor).toBe(4.5);
        });

        it('deletes the unit conversion', async () => {
            const res = await request(app).delete(`/unit-conversions/${createdConversionId}`);
            expect(res.status).toBe(200);
            expect(res.body.message).toContain('deleted');

            // Verifying it is no longer returned in active list
            const getRes = await request(app).get(`/unit-conversions/${createdConversionId}`);
            expect(getRes.status).toBe(404);
        });
    });

    describe('GET /inventory/levels (Multi-Unit Stock Representation)', () => {
        it('returns convertedQuantities on inventory levels for configured conversions', async () => {
            const res = await request(app).get('/inventory/levels?search=Test Matcha Powder');

            expect(res.status).toBe(200);
            expect(res.body.data.length).toBeGreaterThanOrEqual(1);

            interface IConvertedQty {
                unitId: string;
                quantity: number;
                unitAbbreviation?: string | null;
            }
            interface IStockItem {
                ingredientId: string;
                convertedQuantities?: IConvertedQty[];
            }

            const item = (res.body.data as IStockItem[]).find((d) => d.ingredientId === testIngredientId);
            expect(item).toBeDefined();
            expect(item?.convertedQuantities).toBeDefined();

            // 150 g with 1 scoop = 15 g should yield 10 scoops!
            const scoopRepresentation = item?.convertedQuantities?.find((c) => c.unitId === unitScoopId);
            expect(scoopRepresentation).toBeDefined();
            expect(scoopRepresentation?.quantity).toBe(10);
            expect(scoopRepresentation?.unitAbbreviation).toBe('scoop');
        });
    });
});
