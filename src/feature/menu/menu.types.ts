import { z } from 'zod';

// Pagination and List Queries for Menu
export const GetMenuQuerySchema = z.object({
    page: z.coerce.number().min(1).default(1).optional(),
    limit: z.coerce.number().min(1).max(100).default(10).optional(),
    search: z.string().optional(),
    productCategoryId: z.string().uuid().optional(),
    productTypeId: z.string().uuid().optional()
});

export type TGetMenuQuery = z.infer<typeof GetMenuQuerySchema>;

// Response Schemas for Menu API
export const MenuCategoryResponseSchema = z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable()
});

export const MenuTypeResponseSchema = z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable()
});

export const MenuRecipeIngredientResponseSchema = z.object({
    id: z.string(),
    ingredientId: z.string(),
    quantity: z.number(),
    ingredient: z.object({
        id: z.string(),
        name: z.string()
    }),
    unit: z.object({
        id: z.string(),
        name: z.string(),
        abbreviation: z.string().nullable()
    })
});

export const MenuProductVariantResponseSchema = z.object({
    id: z.string(),
    productId: z.string(),
    sku: z.string().nullable(),
    price: z.number(),
    attributes: z.array(
        z.object({
            id: z.string(),
            productAttributeValueId: z.string(),
            attributeValue: z.object({
                id: z.string(),
                productAttributeId: z.string(),
                value: z.string(),
                attribute: z.object({
                    id: z.string(),
                    name: z.string()
                })
            })
        })
    ),
    recipe: z
        .object({
            id: z.string(),
            name: z.string(),
            description: z.string().nullable(),
            ingredients: z.array(MenuRecipeIngredientResponseSchema)
        })
        .nullable()
});

export const MenuProductResponseSchema = z.object({
    id: z.string(),
    name: z.string(),
    photo: z.string().nullable(),
    description: z.string().nullable(),
    productCategoryId: z.string().nullable(),
    productTypeId: z.string().nullable(),
    category: MenuCategoryResponseSchema.nullable(),
    type: MenuTypeResponseSchema.nullable(),
    variants: z.array(MenuProductVariantResponseSchema)
});

export const PaginatedMenuResponseSchema = z.object({
    data: z.array(MenuProductResponseSchema),
    meta: z.object({
        total: z.number(),
        pageCount: z.number(),
        count: z.number(),
        currentPage: z.number(),
        hasMore: z.boolean()
    })
});
