import { z } from 'zod';

// Zod schemas for Recipe Ingredient Input
export const RecipeIngredientInputSchema = z.object({
    ingredientId: z.string().uuid('Invalid ingredient ID format'),
    quantity: z.number().positive('Quantity must be greater than zero'),
    ingredientUnitId: z.string().uuid('Invalid ingredient unit ID format')
});

export type TRecipeIngredientInput = z.infer<typeof RecipeIngredientInputSchema>;

// Schema for creating a recipe
export const CreateRecipeSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name must be at most 100 characters'),
    description: z.string().max(500, 'Description must be at most 500 characters').optional().nullable(),
    ingredients: z.array(RecipeIngredientInputSchema).min(1, 'A recipe must have at least one ingredient')
});

export type TCreateRecipe = z.infer<typeof CreateRecipeSchema>;

// Schema for updating a recipe
export const UpdateRecipeSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name must be at most 100 characters').optional(),
    description: z.string().max(500, 'Description must be at most 500 characters').optional().nullable(),
    ingredients: z.array(RecipeIngredientInputSchema).min(1, 'A recipe must have at least one ingredient').optional()
});

export type TUpdateRecipe = z.infer<typeof UpdateRecipeSchema>;

// Response schemas for API documentation / Swagger
export const RecipeIngredientResponseSchema = z.object({
    id: z.string(),
    recipeId: z.string(),
    ingredientId: z.string(),
    quantity: z.number(),
    ingredientUnitId: z.string(),
    ingredient: z.object({
        id: z.string(),
        name: z.string()
    }),
    unit: z.object({
        id: z.string(),
        name: z.string(),
        abbreviation: z.string().nullable()
    }),
    createdAt: z.date().or(z.string()),
    updatedAt: z.date().or(z.string()),
    deletedAt: z.date().nullable().or(z.string().nullable())
});

export const RecipeResponseSchema = z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    productVariantId: z.string(),
    ingredients: z.array(RecipeIngredientResponseSchema),
    createdAt: z.date().or(z.string()),
    updatedAt: z.date().or(z.string()),
    deletedAt: z.date().nullable().or(z.string().nullable())
});
