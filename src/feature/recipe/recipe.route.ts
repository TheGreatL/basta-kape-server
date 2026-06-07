import { Router, Request, Response, NextFunction } from 'express';
import { registry } from '@/docs/swagger';
import { RecipeService } from './recipe.service';
import { requireAccess } from '@/middleware/rbac.middleware';
import { appModules, appPermissions } from '@/constant';
import { CreateRecipeSchema, UpdateRecipeSchema, RecipeResponseSchema } from './recipe.types';

const router = Router();
const service = new RecipeService();

// ============================================================================
// RECIPE ENDPOINTS (mounted at /products/variants)
// ============================================================================

// GET /products/variants/:variantId/recipe
registry.registerPath({
    method: 'get',
    path: '/products/variants/{variantId}/recipe',
    tags: ['Recipes'],
    summary: 'Get recipe for a product variant by variant ID',
    security: [{ bearerAuth: [] }],
    responses: {
        200: {
            description: 'Recipe retrieved successfully',
            content: { 'application/json': { schema: RecipeResponseSchema } }
        }
    }
});

router.get(
    '/:variantId/recipe',
    requireAccess(appModules.PRODUCTS_MANAGEMENT, appPermissions.READ),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await service.getRecipeByVariantId(req.params.variantId as string);
            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

// POST /products/variants/:variantId/recipe
registry.registerPath({
    method: 'post',
    path: '/products/variants/{variantId}/recipe',
    tags: ['Recipes'],
    summary: 'Create recipe for a product variant',
    security: [{ bearerAuth: [] }],
    request: {
        body: {
            content: {
                'application/json': {
                    schema: CreateRecipeSchema
                }
            }
        }
    },
    responses: {
        201: {
            description: 'Recipe created successfully',
            content: { 'application/json': { schema: RecipeResponseSchema } }
        }
    }
});

router.post(
    '/:variantId/recipe',
    requireAccess(appModules.PRODUCTS_MANAGEMENT, appPermissions.CREATE),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const body = CreateRecipeSchema.parse(req.body);
            const result = await service.createRecipe(req.params.variantId as string, body, req.user!.sub);
            res.status(201).json(result);
        } catch (error) {
            next(error);
        }
    }
);

// PUT /products/variants/:variantId/recipe
registry.registerPath({
    method: 'put',
    path: '/products/variants/{variantId}/recipe',
    tags: ['Recipes'],
    summary: 'Update recipe and ingredients for a product variant',
    security: [{ bearerAuth: [] }],
    request: {
        body: {
            content: {
                'application/json': {
                    schema: UpdateRecipeSchema
                }
            }
        }
    },
    responses: {
        200: {
            description: 'Recipe updated successfully',
            content: { 'application/json': { schema: RecipeResponseSchema } }
        }
    }
});

router.put(
    '/:variantId/recipe',
    requireAccess(appModules.PRODUCTS_MANAGEMENT, appPermissions.UPDATE),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const body = UpdateRecipeSchema.parse(req.body);
            const result = await service.updateRecipe(req.params.variantId as string, body, req.user!.sub);
            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

// DELETE /products/variants/:variantId/recipe
registry.registerPath({
    method: 'delete',
    path: '/products/variants/{variantId}/recipe',
    tags: ['Recipes'],
    summary: 'Soft-delete recipe for a product variant',
    security: [{ bearerAuth: [] }],
    responses: {
        200: {
            description: 'Recipe soft-deleted successfully'
        }
    }
});

router.delete(
    '/:variantId/recipe',
    requireAccess(appModules.PRODUCTS_MANAGEMENT, appPermissions.DELETE),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            await service.deleteRecipe(req.params.variantId as string, req.user!.sub);
            res.json({ message: 'Recipe soft-deleted successfully' });
        } catch (error) {
            next(error);
        }
    }
);

export default router;
