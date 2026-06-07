import { vi, describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// Mock rbac middleware to use a unique user ID and bypass checks
vi.mock('@/middleware/rbac.middleware', () => ({
    requireAccess: vi.fn(() => (req: Request, res: Response, next: NextFunction) => {
        req.user = {
            sub: 'test-recipe-user-id',
            email: 'testrecipe@example.com',
            username: 'testrecipeuser',
            roles: ['Manager']
        };
        req.rbacScope = 'All';
        next();
    }),
    authenticate: vi.fn((req: Request, res: Response, next: NextFunction) => {
        req.user = {
            sub: 'test-recipe-user-id',
            email: 'testrecipe@example.com',
            username: 'testrecipeuser',
            roles: ['Manager']
        };
        next();
    })
}));

import request from 'supertest';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import recipeRouter from '@/feature/recipe/recipe.route';
import { HttpException } from '@/exceptions/http.exception';

describe('Recipe Feature CRUD API', () => {
    let app: express.Application;
    let prisma: PrismaClient;

    // Seed variables for tests
    let testCategoryId: string;
    let testTypeId: string;
    let testProductId: string;
    let testVariantId: string;
    let testUnitId: string;
    let testIngredientId: string;
    let testSecondIngredientId: string;

    beforeAll(async () => {
        prisma = new PrismaClient();
        app = express();

        app.use(express.json());
        app.use('/products/variants', recipeRouter);

        // Error handler
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        app.use((err: HttpException, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
            const status = err.statusCode || 500;
            res.status(status).json({ error: err.message });
        });

        // 1. Ensure isolated mock user record exists for FK constraints
        await prisma.user.upsert({
            where: { id: 'test-recipe-user-id' },
            update: {},
            create: {
                id: 'test-recipe-user-id',
                email: 'testrecipe@example.com',
                username: 'testrecipeuser',
                password: 'hashedpassword123',
                firstName: 'Manager',
                lastName: 'User'
            }
        });

        // 2. Create isolated Category & Type setup records
        const category = await prisma.productCategory.create({
            data: {
                name: 'Test Recipe Category',
                description: 'For testing recipes',
                createdById: 'test-recipe-user-id',
                updatedById: 'test-recipe-user-id'
            }
        });
        testCategoryId = category.id;

        const ptype = await prisma.productType.create({
            data: {
                name: 'Test Recipe Type',
                description: 'For testing recipes',
                createdById: 'test-recipe-user-id',
                updatedById: 'test-recipe-user-id'
            }
        });
        testTypeId = ptype.id;

        // 3. Create active raw ingredient and unit
        const unit = await prisma.ingredientUnit.create({
            data: {
                name: 'Grams Recipe',
                abbreviation: 'g-rcp',
                createdById: 'test-recipe-user-id',
                updatedById: 'test-recipe-user-id'
            }
        });
        testUnitId = unit.id;

        const ingredient1 = await prisma.ingredient.create({
            data: {
                name: 'Recipe Cocoa Powder',
                ingredientUnitId: testUnitId,
                createdById: 'test-recipe-user-id',
                updatedById: 'test-recipe-user-id'
            }
        });
        testIngredientId = ingredient1.id;

        const ingredient2 = await prisma.ingredient.create({
            data: {
                name: 'Recipe White Sugar',
                ingredientUnitId: testUnitId,
                createdById: 'test-recipe-user-id',
                updatedById: 'test-recipe-user-id'
            }
        });
        testSecondIngredientId = ingredient2.id;

        // 4. Create active product and variant
        const product = await prisma.product.create({
            data: {
                name: 'Recipe Hot Cocoa',
                description: 'Tasty cocoa drink',
                productCategoryId: testCategoryId,
                productTypeId: testTypeId,
                createdById: 'test-recipe-user-id',
                updatedById: 'test-recipe-user-id'
            }
        });
        testProductId = product.id;

        const variant = await prisma.productVariant.create({
            data: {
                productId: testProductId,
                sku: 'TEST-RECIPE-COCOA',
                price: 150.0,
                createdById: 'test-recipe-user-id',
                updatedById: 'test-recipe-user-id'
            }
        });
        testVariantId = variant.id;
    });

    afterAll(async () => {
        // Cleanup all records created in correct dependency order
        await prisma.recipeIngredient.deleteMany({ where: { createdById: 'test-recipe-user-id' } });
        await prisma.recipe.deleteMany({ where: { createdById: 'test-recipe-user-id' } });
        await prisma.productVariant.deleteMany({ where: { createdById: 'test-recipe-user-id' } });
        await prisma.product.deleteMany({ where: { createdById: 'test-recipe-user-id' } });
        await prisma.ingredient.deleteMany({ where: { createdById: 'test-recipe-user-id' } });
        await prisma.ingredientUnit.deleteMany({ where: { createdById: 'test-recipe-user-id' } });
        await prisma.productCategory.deleteMany({ where: { createdById: 'test-recipe-user-id' } });
        await prisma.productType.deleteMany({ where: { createdById: 'test-recipe-user-id' } });
        await prisma.user.deleteMany({ where: { id: 'test-recipe-user-id' } });

        await prisma.$disconnect();
    });

    describe('Recipe API lifecycle endpoints', () => {
        it('should fail to get a recipe when none exists', async () => {
            const res = await request(app).get(`/products/variants/${testVariantId}/recipe`);
            expect(res.status).toBe(404);
            expect(res.body).toHaveProperty('error');
            expect(res.body.error).toMatch(/Recipe not found/);
        });

        it('should successfully create a new recipe', async () => {
            const recipeData = {
                name: 'Cocoa Standard Recipe',
                description: 'Original proportions',
                ingredients: [
                    {
                        ingredientId: testIngredientId,
                        quantity: 20.5,
                        ingredientUnitId: testUnitId
                    }
                ]
            };

            const res = await request(app).post(`/products/variants/${testVariantId}/recipe`).send(recipeData);

            expect(res.status).toBe(201);
            expect(res.body).toHaveProperty('id');
            expect(res.body.name).toBe('Cocoa Standard Recipe');
            expect(res.body.productVariantId).toBe(testVariantId);
            expect(res.body.ingredients).toHaveLength(1);
            expect(res.body.ingredients[0].ingredientId).toBe(testIngredientId);
            expect(res.body.ingredients[0].quantity).toBe(20.5);
            expect(res.body.ingredients[0].unit.abbreviation).toBe('g-rcp');
        });

        it('should fail to create duplicate recipe for the same variant', async () => {
            const recipeData = {
                name: 'Duplicate Recipe',
                ingredients: [
                    {
                        ingredientId: testIngredientId,
                        quantity: 10,
                        ingredientUnitId: testUnitId
                    }
                ]
            };

            const res = await request(app).post(`/products/variants/${testVariantId}/recipe`).send(recipeData);

            expect(res.status).toBe(409);
            expect(res.body).toHaveProperty('error');
            expect(res.body.error).toMatch(/Recipe already exists/);
        });

        it('should successfully retrieve the active recipe', async () => {
            const res = await request(app).get(`/products/variants/${testVariantId}/recipe`);
            expect(res.status).toBe(200);
            expect(res.body.name).toBe('Cocoa Standard Recipe');
            expect(res.body.ingredients).toHaveLength(1);
            expect(res.body.ingredients[0].ingredient.name).toBe('Recipe Cocoa Powder');
        });

        it('should successfully update recipe details and sync ingredients', async () => {
            const updateData = {
                name: 'Cocoa Sweet Recipe',
                ingredients: [
                    {
                        ingredientId: testIngredientId,
                        quantity: 15.0,
                        ingredientUnitId: testUnitId
                    },
                    {
                        ingredientId: testSecondIngredientId,
                        quantity: 5.0,
                        ingredientUnitId: testUnitId
                    }
                ]
            };

            const res = await request(app).put(`/products/variants/${testVariantId}/recipe`).send(updateData);

            expect(res.status).toBe(200);
            expect(res.body.name).toBe('Cocoa Sweet Recipe');
            expect(res.body.ingredients).toHaveLength(2);

            // Assert both ingredients exist in response
            const cocoa = res.body.ingredients.find((i: { ingredientId: string }) => i.ingredientId === testIngredientId);
            const sugar = res.body.ingredients.find((i: { ingredientId: string }) => i.ingredientId === testSecondIngredientId);

            expect(cocoa).toBeDefined();
            expect(cocoa.quantity).toBe(15.0);
            expect(sugar).toBeDefined();
            expect(sugar.quantity).toBe(5.0);
        });

        it('should successfully soft-delete the recipe', async () => {
            const deleteRes = await request(app).delete(`/products/variants/${testVariantId}/recipe`);
            expect(deleteRes.status).toBe(200);
            expect(deleteRes.body.message).toMatch(/soft-deleted successfully/);

            // Confirm it is not retrievable anymore
            const getRes = await request(app).get(`/products/variants/${testVariantId}/recipe`);
            expect(getRes.status).toBe(404);
        });
    });
});
