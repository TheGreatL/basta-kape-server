import { vi, describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// Mock rbac middleware to use a unique user ID and prevent test collisions
vi.mock('@/middleware/rbac.middleware', () => ({
    requireAccess: vi.fn(() => (req: Request, res: Response, next: NextFunction) => {
        req.user = {
            sub: 'test-modifier-admin-id',
            email: 'testmodifieradmin@example.com',
            username: 'testmodifieradmin',
            roles: ['Administrator']
        };
        next();
    }),
    authenticate: vi.fn((req: Request, res: Response, next: NextFunction) => {
        req.user = {
            sub: 'test-modifier-admin-id',
            email: 'testmodifieradmin@example.com',
            username: 'testmodifieradmin',
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
import modifierRouter from '@/feature/modifier/modifier.route';
import { HttpException } from '@/exceptions/http.exception';
import { ZodError } from 'zod';

describe('Modifier Feature CRUD', () => {
    let app: express.Application;
    let prisma: PrismaClient;

    let testCategoryId: string;
    let testTypeId: string;
    let testProductId: string;
    let createdGroupId: string;
    let createdOptionId: string;
    let testUnitId: string;
    let testIngredientId: string;

    beforeAll(async () => {
        prisma = new PrismaClient();
        app = express();

        app.use(express.json());
        app.use('/modifiers', modifierRouter);

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
            where: { id: 'test-modifier-admin-id' },
            update: {},
            create: {
                id: 'test-modifier-admin-id',
                email: 'testmodifieradmin@example.com',
                username: 'testmodifieradmin',
                password: 'hashedpassword123',
                firstName: 'Test',
                lastName: 'Admin',
                role: {
                    connectOrCreate: {
                        where: { name: 'Administrator' },
                        create: { name: 'Administrator', isSystem: true }
                    }
                }
            }
        });

        // 2. Create isolated Category & Type & Product
        const category = await prisma.productCategory.create({
            data: {
                name: 'Test Modifier Category',
                createdById: 'test-modifier-admin-id'
            }
        });
        testCategoryId = category.id;

        const ptype = await prisma.productType.create({
            data: {
                name: 'Test Modifier Type',
                createdById: 'test-modifier-admin-id'
            }
        });
        testTypeId = ptype.id;

        const product = await prisma.product.create({
            data: {
                name: 'Test Modifier Coffee Product',
                productCategoryId: testCategoryId,
                productTypeId: testTypeId,
                createdById: 'test-modifier-admin-id'
            }
        });
        testProductId = product.id;

        // 3. Create unit and ingredient for modifier recipe tests
        const unit = await prisma.ingredientUnit.create({
            data: {
                name: 'Milliliters Test Mod',
                abbreviation: 'ml_mod',
                createdById: 'test-modifier-admin-id'
            }
        });
        testUnitId = unit.id;

        const ingredient = await prisma.ingredient.create({
            data: {
                name: 'Honey Syrup Test Mod',
                ingredientUnitId: testUnitId,
                reorderPoint: 10,
                createdById: 'test-modifier-admin-id'
            }
        });
        testIngredientId = ingredient.id;
    });

    afterAll(async () => {
        // Cleanup recipes and ingredients
        await prisma.recipeIngredient.deleteMany({
            where: { ingredientId: testIngredientId }
        });
        await prisma.recipe.deleteMany({
            where: { createdById: 'test-modifier-admin-id' }
        });
        await prisma.ingredient.deleteMany({ where: { createdById: 'test-modifier-admin-id' } });
        await prisma.ingredientUnit.deleteMany({ where: { createdById: 'test-modifier-admin-id' } });

        // Cleanup modifier options and groups
        await prisma.modifierOption.deleteMany({
            where: {
                group: {
                    name: { startsWith: 'Test Sweetness' }
                }
            }
        });

        await prisma.modifierGroup.deleteMany({
            where: {
                name: { startsWith: 'Test Sweetness' }
            }
        });

        // Cleanup product variant, product, category, type, and user
        await prisma.product.deleteMany({ where: { createdById: 'test-modifier-admin-id' } });
        await prisma.productCategory.deleteMany({ where: { createdById: 'test-modifier-admin-id' } });
        await prisma.productType.deleteMany({ where: { createdById: 'test-modifier-admin-id' } });
        await prisma.user.deleteMany({ where: { id: 'test-modifier-admin-id' } });

        await prisma.$disconnect();
    });

    describe('Modifier Group CRUD Operations', () => {
        it('should successfully create a modifier group linked to a product', async () => {
            const payload = {
                name: 'Test Sweetness Level',
                isRequired: true,
                minSelect: 1,
                maxSelect: 1,
                productIds: [testProductId]
            };

            const res = await request(app).post('/modifiers/groups').send(payload);
            expect(res.status).toBe(201);
            expect(res.body).toHaveProperty('id');
            expect(res.body.name).toBe('Test Sweetness Level');
            expect(res.body.isRequired).toBe(true);
            expect(res.body.products).toHaveLength(1);
            expect(res.body.products[0].id).toBe(testProductId);

            createdGroupId = res.body.id;
        });

        it('should fail to create group if minSelect is greater than maxSelect', async () => {
            const payload = {
                name: 'Invalid Test Group',
                minSelect: 2,
                maxSelect: 1
            };

            const res = await request(app).post('/modifiers/groups').send(payload);
            expect(res.status).toBe(400);
            expect(res.body.error).toContain('minSelect cannot be greater than maxSelect');
        });

        it('should retrieve modifier groups list', async () => {
            const res = await request(app).get('/modifiers/groups?search=Test%20Sweetness');
            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('data');
            expect(res.body.data.length).toBeGreaterThanOrEqual(1);

            const found = res.body.data.find((g: { id: string }) => g.id === createdGroupId);
            expect(found).toBeDefined();
            expect(found.name).toBe('Test Sweetness Level');
        });

        it('should filter modifier groups list by productId', async () => {
            const res = await request(app).get(`/modifiers/groups?productId=${testProductId}`);
            expect(res.status).toBe(200);
            expect(res.body.data.length).toBeGreaterThanOrEqual(1);

            const wrongProductRes = await request(app).get('/modifiers/groups?productId=a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');
            expect(wrongProductRes.status).toBe(200);
            expect(wrongProductRes.body.data).toHaveLength(0);
        });

        it('should fetch modifier group details by ID', async () => {
            const res = await request(app).get(`/modifiers/groups/${createdGroupId}`);
            expect(res.status).toBe(200);
            expect(res.body.id).toBe(createdGroupId);
            expect(res.body.name).toBe('Test Sweetness Level');
        });

        it('should update modifier group successfully', async () => {
            const payload = {
                name: 'Test Sweetness Level Updated',
                maxSelect: 2
            };

            const res = await request(app).put(`/modifiers/groups/${createdGroupId}`).send(payload);
            expect(res.status).toBe(200);
            expect(res.body.name).toBe('Test Sweetness Level Updated');
            expect(res.body.maxSelect).toBe(2);
        });
    });

    describe('Modifier Option CRUD Operations', () => {
        it('should successfully add a modifier option to the group', async () => {
            const payload = {
                name: 'Test Extra Sugar (Large)',
                price: 15.5
            };

            const res = await request(app).post(`/modifiers/groups/${createdGroupId}/options`).send(payload);
            expect(res.status).toBe(201);
            expect(res.body).toHaveProperty('id');
            expect(res.body.name).toBe('Test Extra Sugar (Large)');
            expect(res.body.price).toBe(15.5);

            createdOptionId = res.body.id;
        });

        it('should update modifier option details', async () => {
            const payload = {
                name: 'Test Extra Honey Option',
                price: 20.0
            };

            const res = await request(app).put(`/modifiers/options/${createdOptionId}`).send(payload);
            expect(res.status).toBe(200);
            expect(res.body.name).toBe('Test Extra Honey Option');
            expect(res.body.price).toBe(20.0);
        });

        it('should soft delete modifier option successfully', async () => {
            const deleteRes = await request(app).delete(`/modifiers/options/${createdOptionId}`);
            expect(deleteRes.status).toBe(200);

            // Verify soft-deleted
            const details = await prisma.modifierOption.findUnique({
                where: { id: createdOptionId }
            });
            expect(details?.deletedAt).not.toBeNull();
        });

        it('should soft delete modifier group and its options', async () => {
            // Re-create option for group delete cascade testing
            const option = await prisma.modifierOption.create({
                data: {
                    modifierGroupId: createdGroupId,
                    name: 'Test Delete Option Cascade',
                    price: 5.0
                }
            });

            const deleteGroupRes = await request(app).delete(`/modifiers/groups/${createdGroupId}`);
            expect(deleteGroupRes.status).toBe(200);

            // Verify group is soft deleted
            const groupRecord = await prisma.modifierGroup.findUnique({
                where: { id: createdGroupId }
            });
            expect(groupRecord?.deletedAt).not.toBeNull();

            // Verify option is soft deleted too
            const optionRecord = await prisma.modifierOption.findUnique({
                where: { id: option.id }
            });
            expect(optionRecord?.deletedAt).not.toBeNull();
        });
    });

    describe('Modifier Option Recipe CRUD Operations', () => {
        let recipeOptionId: string;
        let testRecipeId: string;

        beforeAll(async () => {
            // Create a group and option for recipe tests
            const group = await prisma.modifierGroup.create({
                data: {
                    name: 'Test Sweetness Recipe Group',
                    isRequired: false,
                    minSelect: 0,
                    maxSelect: 1
                }
            });

            const option = await prisma.modifierOption.create({
                data: {
                    modifierGroupId: group.id,
                    name: 'Honey 50%',
                    price: 10.0
                }
            });
            recipeOptionId = option.id;
        });

        it('should create a recipe for a modifier option', async () => {
            const payload = {
                name: 'Honey 50% Recipe',
                description: 'Recipe for half honey sweetener',
                ingredients: [
                    {
                        ingredientId: testIngredientId,
                        quantity: 15.0,
                        ingredientUnitId: testUnitId
                    }
                ]
            };

            const res = await request(app).post(`/modifiers/options/${recipeOptionId}/recipe`).send(payload);

            expect(res.status).toBe(201);
            expect(res.body).toHaveProperty('id');
            expect(res.body.name).toBe('Honey 50% Recipe');
            expect(res.body.ingredients).toHaveLength(1);
            expect(res.body.ingredients[0].ingredientId).toBe(testIngredientId);

            testRecipeId = res.body.id;
        });

        it('should get the recipe for a modifier option', async () => {
            const res = await request(app).get(`/modifiers/options/${recipeOptionId}/recipe`);

            expect(res.status).toBe(200);
            expect(res.body.id).toBe(testRecipeId);
            expect(res.body.name).toBe('Honey 50% Recipe');
        });

        it('should update the recipe for a modifier option', async () => {
            const payload = {
                name: 'Honey 50% Updated Recipe',
                description: 'Updated description'
            };

            const res = await request(app).put(`/modifiers/options/${recipeOptionId}/recipe`).send(payload);

            expect(res.status).toBe(200);
            expect(res.body.name).toBe('Honey 50% Updated Recipe');
        });

        it('should soft-delete the recipe for a modifier option', async () => {
            const res = await request(app).delete(`/modifiers/options/${recipeOptionId}/recipe`);

            expect(res.status).toBe(200);
            expect(res.body.message).toContain('soft-deleted successfully');
        });

        it('should restore the soft-deleted recipe for a modifier option', async () => {
            const res = await request(app).patch(`/modifiers/options/${recipeOptionId}/recipe/restore`);

            expect(res.status).toBe(200);
            expect(res.body.id).toBe(testRecipeId);
        });
    });
});
