import { Router, Request, Response, NextFunction } from 'express';
import { registry } from '@/docs/swagger';
import { ModifierService } from './modifier.service';
import { requireAccess, authenticate } from '@/middleware/rbac.middleware';
import { appModules, appPermissions } from '@/constant';
import { RecipeService } from '@/feature/recipe/recipe.service';
import { CreateRecipeSchema, UpdateRecipeSchema, RecipeResponseSchema } from '@/feature/recipe/recipe.types';
import {
    CreateModifierGroupSchema,
    UpdateModifierGroupSchema,
    CreateModifierOptionSchema,
    UpdateModifierOptionSchema,
    GetModifierGroupListQuerySchema,
    ModifierGroupResponseSchema
} from './modifier.types';

const router = Router();
const service = new ModifierService();
const recipeService = new RecipeService();

// ============================================================================
// MODIFIERS ENDPOINTS
// ============================================================================

// GET /modifiers/groups
registry.registerPath({
    method: 'get',
    path: '/modifiers/groups',
    tags: ['Modifiers'],
    summary: 'Get paginated list of modifier groups',
    security: [{ bearerAuth: [] }],
    request: {
        query: GetModifierGroupListQuerySchema
    },
    responses: {
        200: {
            description: 'Modifier groups retrieved successfully'
        }
    }
});

router.get('/groups', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const query = GetModifierGroupListQuerySchema.parse(req.query);
        const result = await service.getModifierGroupList(query);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

// GET /modifiers/groups/:id
registry.registerPath({
    method: 'get',
    path: '/modifiers/groups/{id}',
    tags: ['Modifiers'],
    summary: 'Get modifier group details by ID',
    security: [{ bearerAuth: [] }],
    responses: {
        200: {
            description: 'Modifier group retrieved successfully',
            content: { 'application/json': { schema: ModifierGroupResponseSchema } }
        }
    }
});

router.get('/groups/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await service.getModifierGroupById(req.params.id as string);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

// POST /modifiers/groups
registry.registerPath({
    method: 'post',
    path: '/modifiers/groups',
    tags: ['Modifiers'],
    summary: 'Create a new modifier group',
    security: [{ bearerAuth: [] }],
    request: {
        body: {
            content: {
                'application/json': {
                    schema: CreateModifierGroupSchema
                }
            }
        }
    },
    responses: {
        201: {
            description: 'Modifier group created successfully',
            content: { 'application/json': { schema: ModifierGroupResponseSchema } }
        }
    }
});

router.post(
    '/groups',
    requireAccess(appModules.PRODUCTS_MANAGEMENT, appPermissions.CREATE),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const body = CreateModifierGroupSchema.parse(req.body);
            const result = await service.createModifierGroup(body, req.user!.sub);
            res.status(201).json(result);
        } catch (error) {
            next(error);
        }
    }
);

// PUT /modifiers/groups/:id
registry.registerPath({
    method: 'put',
    path: '/modifiers/groups/{id}',
    tags: ['Modifiers'],
    summary: 'Update modifier group by ID',
    security: [{ bearerAuth: [] }],
    request: {
        body: {
            content: {
                'application/json': {
                    schema: UpdateModifierGroupSchema
                }
            }
        }
    },
    responses: {
        200: {
            description: 'Modifier group updated successfully',
            content: { 'application/json': { schema: ModifierGroupResponseSchema } }
        }
    }
});

router.put(
    '/groups/:id',
    requireAccess(appModules.PRODUCTS_MANAGEMENT, appPermissions.UPDATE),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const body = UpdateModifierGroupSchema.parse(req.body);
            const result = await service.updateModifierGroup(req.params.id as string, body, req.user!.sub);
            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

// DELETE /modifiers/groups/:id
registry.registerPath({
    method: 'delete',
    path: '/modifiers/groups/{id}',
    tags: ['Modifiers'],
    summary: 'Soft-delete modifier group by ID',
    security: [{ bearerAuth: [] }],
    responses: {
        200: {
            description: 'Modifier group deleted successfully'
        }
    }
});

router.delete(
    '/groups/:id',
    requireAccess(appModules.PRODUCTS_MANAGEMENT, appPermissions.DELETE),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            await service.deleteModifierGroup(req.params.id as string, req.user!.sub);
            res.json({ message: 'Modifier group deleted successfully' });
        } catch (error) {
            next(error);
        }
    }
);

// POST /modifiers/groups/:groupId/options
registry.registerPath({
    method: 'post',
    path: '/modifiers/groups/{groupId}/options',
    tags: ['Modifiers'],
    summary: 'Add an option choice to a modifier group',
    security: [{ bearerAuth: [] }],
    request: {
        body: {
            content: {
                'application/json': {
                    schema: CreateModifierOptionSchema
                }
            }
        }
    },
    responses: {
        201: {
            description: 'Modifier option created successfully'
        }
    }
});

router.post(
    '/groups/:groupId/options',
    requireAccess(appModules.PRODUCTS_MANAGEMENT, appPermissions.CREATE),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const body = CreateModifierOptionSchema.parse(req.body);
            const result = await service.createModifierOption(req.params.groupId as string, body, req.user!.sub);
            res.status(201).json(result);
        } catch (error) {
            next(error);
        }
    }
);

// PUT /modifiers/options/:id
registry.registerPath({
    method: 'put',
    path: '/modifiers/options/{id}',
    tags: ['Modifiers'],
    summary: 'Update modifier option by ID',
    security: [{ bearerAuth: [] }],
    request: {
        body: {
            content: {
                'application/json': {
                    schema: UpdateModifierOptionSchema
                }
            }
        }
    },
    responses: {
        200: {
            description: 'Modifier option updated successfully'
        }
    }
});

router.put(
    '/options/:id',
    requireAccess(appModules.PRODUCTS_MANAGEMENT, appPermissions.UPDATE),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const body = UpdateModifierOptionSchema.parse(req.body);
            const result = await service.updateModifierOption(req.params.id as string, body, req.user!.sub);
            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

// DELETE /modifiers/options/:id
registry.registerPath({
    method: 'delete',
    path: '/modifiers/options/{id}',
    tags: ['Modifiers'],
    summary: 'Soft-delete modifier option by ID',
    security: [{ bearerAuth: [] }],
    responses: {
        200: {
            description: 'Modifier option deleted successfully'
        }
    }
});

router.delete(
    '/options/:id',
    requireAccess(appModules.PRODUCTS_MANAGEMENT, appPermissions.DELETE),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            await service.deleteModifierOption(req.params.id as string, req.user!.sub);
            res.json({ message: 'Modifier option deleted successfully' });
        } catch (error) {
            next(error);
        }
    }
);

// ============================================================================
// MODIFIER OPTION RECIPE ENDPOINTS
// ============================================================================

// GET /modifiers/options/:optionId/recipe
registry.registerPath({
    method: 'get',
    path: '/modifiers/options/{optionId}/recipe',
    tags: ['Modifiers'],
    summary: 'Get recipe for a modifier option by option ID',
    security: [{ bearerAuth: [] }],
    responses: {
        200: {
            description: 'Modifier option recipe retrieved successfully',
            content: { 'application/json': { schema: RecipeResponseSchema } }
        }
    }
});

router.get(
    '/options/:optionId/recipe',
    requireAccess(appModules.PRODUCTS_MANAGEMENT, appPermissions.READ),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await recipeService.getRecipeByModifierOptionId(req.params.optionId as string);
            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

// POST /modifiers/options/:optionId/recipe
registry.registerPath({
    method: 'post',
    path: '/modifiers/options/{optionId}/recipe',
    tags: ['Modifiers'],
    summary: 'Create recipe for a modifier option',
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
            description: 'Modifier option recipe created successfully',
            content: { 'application/json': { schema: RecipeResponseSchema } }
        }
    }
});

router.post(
    '/options/:optionId/recipe',
    requireAccess(appModules.PRODUCTS_MANAGEMENT, appPermissions.CREATE),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const body = CreateRecipeSchema.parse(req.body);
            const result = await recipeService.createRecipeForModifierOption(req.params.optionId as string, body, req.user!.sub);
            res.status(201).json(result);
        } catch (error) {
            next(error);
        }
    }
);

// PUT /modifiers/options/:optionId/recipe
registry.registerPath({
    method: 'put',
    path: '/modifiers/options/{optionId}/recipe',
    tags: ['Modifiers'],
    summary: 'Update recipe and ingredients for a modifier option',
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
            description: 'Modifier option recipe updated successfully',
            content: { 'application/json': { schema: RecipeResponseSchema } }
        }
    }
});

router.put(
    '/options/:optionId/recipe',
    requireAccess(appModules.PRODUCTS_MANAGEMENT, appPermissions.UPDATE),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const body = UpdateRecipeSchema.parse(req.body);
            const result = await recipeService.updateRecipeForModifierOption(req.params.optionId as string, body, req.user!.sub);
            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

// DELETE /modifiers/options/:optionId/recipe
registry.registerPath({
    method: 'delete',
    path: '/modifiers/options/{optionId}/recipe',
    tags: ['Modifiers'],
    summary: 'Soft-delete recipe for a modifier option',
    security: [{ bearerAuth: [] }],
    responses: {
        200: {
            description: 'Modifier option recipe soft-deleted successfully'
        }
    }
});

router.delete(
    '/options/:optionId/recipe',
    requireAccess(appModules.PRODUCTS_MANAGEMENT, appPermissions.DELETE),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            await recipeService.deleteRecipeForModifierOption(req.params.optionId as string, req.user!.sub);
            res.json({ message: 'Modifier option recipe soft-deleted successfully' });
        } catch (error) {
            next(error);
        }
    }
);

// PATCH /modifiers/options/:optionId/recipe/restore
registry.registerPath({
    method: 'patch',
    path: '/modifiers/options/{optionId}/recipe/restore',
    tags: ['Modifiers'],
    summary: 'Restore soft-deleted recipe for a modifier option',
    security: [{ bearerAuth: [] }],
    responses: {
        200: {
            description: 'Modifier option recipe restored successfully',
            content: { 'application/json': { schema: RecipeResponseSchema } }
        }
    }
});

router.patch(
    '/options/:optionId/recipe/restore',
    requireAccess(appModules.PRODUCTS_MANAGEMENT, appPermissions.DELETE),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await recipeService.restoreRecipeForModifierOption(req.params.optionId as string, req.user!.sub);
            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

export default router;
