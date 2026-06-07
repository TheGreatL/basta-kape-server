import { vi, describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// Mock rbac middleware to use a unique user ID and prevent test collisions
vi.mock('@/middleware/rbac.middleware', () => ({
    requireAccess: vi.fn(() => (req: Request, res: Response, next: NextFunction) => {
        req.user = {
            sub: 'test-menu-user-id',
            email: 'testmenu@example.com',
            username: 'testmenuuser',
            roles: ['Customer']
        };
        req.rbacScope = 'All';
        next();
    }),
    authenticate: vi.fn((req: Request, res: Response, next: NextFunction) => {
        req.user = {
            sub: 'test-menu-user-id',
            email: 'testmenu@example.com',
            username: 'testmenuuser',
            roles: ['Customer']
        };
        next();
    })
}));

import request from 'supertest';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import menuRouter from '@/feature/menu/menu.route';
import { HttpException } from '@/exceptions/http.exception';

describe('Customer Menu Feature CRUD', () => {
    let app: express.Application;
    let prisma: PrismaClient;

    // Seed variables for tests
    let testCategoryId: string;
    let testTypeId: string;
    let testProductId: string;
    let testVariantId: string;
    let testRecipeId: string;
    let testUnitId: string;
    let testIngredientId: string;

    beforeAll(async () => {
        prisma = new PrismaClient();
        app = express();

        app.use(express.json());
        app.use('/menu', menuRouter);

        // Error handler
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        app.use((err: HttpException, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
            const status = err.statusCode || 500;
            res.status(status).json({ error: err.message });
        });

        // 1. Ensure isolated mock user record exists for FK constraints
        await prisma.user.upsert({
            where: { id: 'test-menu-user-id' },
            update: {},
            create: {
                id: 'test-menu-user-id',
                email: 'testmenu@example.com',
                username: 'testmenuuser',
                password: 'hashedpassword123',
                firstName: 'Customer',
                lastName: 'User'
            }
        });

        // 2. Create isolated Category & Type setup records
        const category = await prisma.productCategory.create({
            data: {
                name: 'Test Menu Category',
                description: 'For testing customer menu',
                createdById: 'test-menu-user-id',
                updatedById: 'test-menu-user-id'
            }
        });
        testCategoryId = category.id;

        const ptype = await prisma.productType.create({
            data: {
                name: 'Test Menu Type',
                description: 'For testing customer menu',
                createdById: 'test-menu-user-id',
                updatedById: 'test-menu-user-id'
            }
        });
        testTypeId = ptype.id;

        // 3. Create active raw ingredient and unit
        const unit = await prisma.ingredientUnit.create({
            data: {
                name: 'Grams Menu',
                abbreviation: 'gm',
                createdById: 'test-menu-user-id',
                updatedById: 'test-menu-user-id'
            }
        });
        testUnitId = unit.id;

        const ingredient = await prisma.ingredient.create({
            data: {
                name: 'Menu Espresso Beans',
                ingredientUnitId: testUnitId,
                createdById: 'test-menu-user-id',
                updatedById: 'test-menu-user-id'
            }
        });
        testIngredientId = ingredient.id;

        // 4. Create active product, variant, and recipe
        const product = await prisma.product.create({
            data: {
                name: 'Menu Cappuccino',
                description: 'Tasty hot espresso drink',
                productCategoryId: testCategoryId,
                productTypeId: testTypeId,
                createdById: 'test-menu-user-id',
                updatedById: 'test-menu-user-id'
            }
        });
        testProductId = product.id;

        const variant = await prisma.productVariant.create({
            data: {
                productId: testProductId,
                sku: 'TEST-MENU-CAP-LRG',
                price: 180.0,
                createdById: 'test-menu-user-id',
                updatedById: 'test-menu-user-id'
            }
        });
        testVariantId = variant.id;

        const recipe = await prisma.recipe.create({
            data: {
                name: 'Cappuccino Recipe',
                productVariantId: testVariantId,
                createdById: 'test-menu-user-id',
                updatedById: 'test-menu-user-id'
            }
        });
        testRecipeId = recipe.id;

        // Connect recipe ingredient
        await prisma.recipeIngredient.create({
            data: {
                recipeId: testRecipeId,
                ingredientId: testIngredientId,
                quantity: 15,
                ingredientUnitId: testUnitId,
                createdById: 'test-menu-user-id',
                updatedById: 'test-menu-user-id'
            }
        });
    });

    afterAll(async () => {
        // Cleanup all records created in correct dependency order
        await prisma.recipeIngredient.deleteMany({ where: { createdById: 'test-menu-user-id' } });
        await prisma.recipe.deleteMany({ where: { createdById: 'test-menu-user-id' } });
        await prisma.productVariant.deleteMany({ where: { createdById: 'test-menu-user-id' } });
        await prisma.product.deleteMany({ where: { createdById: 'test-menu-user-id' } });
        await prisma.ingredient.deleteMany({ where: { createdById: 'test-menu-user-id' } });
        await prisma.ingredientUnit.deleteMany({ where: { createdById: 'test-menu-user-id' } });
        await prisma.productCategory.deleteMany({ where: { createdById: 'test-menu-user-id' } });
        await prisma.productType.deleteMany({ where: { createdById: 'test-menu-user-id' } });
        await prisma.user.deleteMany({ where: { id: 'test-menu-user-id' } });

        await prisma.$disconnect();
    });

    // ========================================================================
    // CUSTOMER MENU TESTS
    // ========================================================================
    describe('Menu catalog lists and details endpoints', () => {
        it('should retrieve a paginated catalog list of active products', async () => {
            const res = await request(app).get('/menu?limit=5');
            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('data');
            expect(res.body).toHaveProperty('meta');
            expect(res.body.data.length).toBeGreaterThanOrEqual(1);

            const found = res.body.data.find((p: { id: string }) => p.id === testProductId);
            expect(found).toBeDefined();
            expect(found.name).toBe('Menu Cappuccino');
            expect(found.category.name).toBe('Test Menu Category');
            expect(found.type.name).toBe('Test Menu Type');
            expect(found.variants.length).toBe(1);
            expect(found.variants[0].sku).toBe('TEST-MENU-CAP-LRG');
            expect(found.variants[0].price).toBe(180.0);
            expect(found.variants[0].maxProduceable).toBe(0);
            expect(found.variants[0].recipe.name).toBe('Cappuccino Recipe');
            expect(found.variants[0].recipe.ingredients.length).toBe(1);
            expect(found.variants[0].recipe.ingredients[0].ingredient.name).toBe('Menu Espresso Beans');
        });

        it('should retrieve active menu details by product ID', async () => {
            const res = await request(app).get(`/menu/${testProductId}`);
            expect(res.status).toBe(200);
            expect(res.body.id).toBe(testProductId);
            expect(res.body.name).toBe('Menu Cappuccino');
            expect(res.body.category.name).toBe('Test Menu Category');
            expect(res.body.variants[0].recipe.ingredients[0].quantity).toBe(15);
            expect(res.body.variants[0].maxProduceable).toBe(0);
        });

        it('should retrieve active categories with no pagination', async () => {
            const res = await request(app).get('/menu/categories');
            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);

            const found = res.body.find((c: { name: string }) => c.name === 'Test Menu Category');
            expect(found).toBeDefined();
            expect(found.id).toBe(testCategoryId);
        });

        it('should retrieve active types with no pagination', async () => {
            const res = await request(app).get('/menu/types');
            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);

            const found = res.body.find((t: { name: string }) => t.name === 'Test Menu Type');
            expect(found).toBeDefined();
            expect(found.id).toBe(testTypeId);
        });
    });
});
