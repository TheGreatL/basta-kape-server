import { z } from 'zod';

// Pagination and List Queries
export const GetListQuerySchema = z.object({
    page: z.coerce.number().min(1).default(1).optional(),
    limit: z.coerce.number().min(1).max(100).default(10).optional(),
    search: z.string().optional(),
    status: z.enum(['active', 'archive']).default('active').optional()
});

export type TGetListQuery = z.infer<typeof GetListQuerySchema>;

// ProductCategory Zod Schemas
export const CreateCategorySchema = z.object({
    name: z.string().min(2).max(100),
    description: z.string().max(500).optional().nullable()
});
export type TCreateCategory = z.infer<typeof CreateCategorySchema>;

export const UpdateCategorySchema = z.object({
    name: z.string().min(2).max(100).optional(),
    description: z.string().max(500).optional().nullable()
});
export type TUpdateCategory = z.infer<typeof UpdateCategorySchema>;

export const CategoryResponseSchema = z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    createdAt: z.date().or(z.string()),
    updatedAt: z.date().or(z.string()),
    deletedAt: z.date().nullable().or(z.string().nullable())
});

export const PaginatedCategoryResponseSchema = z.object({
    data: z.array(CategoryResponseSchema),
    meta: z.object({
        total: z.number(),
        pageCount: z.number(),
        count: z.number(),
        currentPage: z.number(),
        hasMore: z.boolean()
    })
});

// ProductType Zod Schemas
export const CreateTypeSchema = z.object({
    name: z.string().min(2).max(100),
    description: z.string().max(500).optional().nullable()
});
export type TCreateType = z.infer<typeof CreateTypeSchema>;

export const UpdateTypeSchema = z.object({
    name: z.string().min(2).max(100).optional(),
    description: z.string().max(500).optional().nullable()
});
export type TUpdateType = z.infer<typeof UpdateTypeSchema>;

export const TypeResponseSchema = z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    createdAt: z.date().or(z.string()),
    updatedAt: z.date().or(z.string()),
    deletedAt: z.date().nullable().or(z.string().nullable())
});

export const PaginatedTypeResponseSchema = z.object({
    data: z.array(TypeResponseSchema),
    meta: z.object({
        total: z.number(),
        pageCount: z.number(),
        count: z.number(),
        currentPage: z.number(),
        hasMore: z.boolean()
    })
});

// ProductAttribute Zod Schemas
export const CreateAttributeSchema = z.object({
    name: z.string().min(2).max(100),
    description: z.string().max(500).optional().nullable()
});
export type TCreateAttribute = z.infer<typeof CreateAttributeSchema>;

export const UpdateAttributeSchema = z.object({
    name: z.string().min(2).max(100).optional(),
    description: z.string().max(500).optional().nullable()
});
export type TUpdateAttribute = z.infer<typeof UpdateAttributeSchema>;

export const AttributeResponseSchema = z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    createdAt: z.date().or(z.string()),
    updatedAt: z.date().or(z.string()),
    deletedAt: z.date().nullable().or(z.string().nullable())
});

export const PaginatedAttributeResponseSchema = z.object({
    data: z.array(AttributeResponseSchema),
    meta: z.object({
        total: z.number(),
        pageCount: z.number(),
        count: z.number(),
        currentPage: z.number(),
        hasMore: z.boolean()
    })
});

// ProductAttributeValue Zod Schemas
export const CreateAttributeValueSchema = z.object({
    productAttributeId: z.string().uuid(),
    value: z.string().min(1).max(100)
});
export type TCreateAttributeValue = z.infer<typeof CreateAttributeValueSchema>;

export const UpdateAttributeValueSchema = z.object({
    value: z.string().min(1).max(100)
});
export type TUpdateAttributeValue = z.infer<typeof UpdateAttributeValueSchema>;

export const AttributeValueResponseSchema = z.object({
    id: z.string(),
    productAttributeId: z.string(),
    value: z.string(),
    createdAt: z.date().or(z.string()),
    updatedAt: z.date().or(z.string()),
    deletedAt: z.date().nullable().or(z.string().nullable())
});

export const PaginatedAttributeValueResponseSchema = z.object({
    data: z.array(AttributeValueResponseSchema),
    meta: z.object({
        total: z.number(),
        pageCount: z.number(),
        count: z.number(),
        currentPage: z.number(),
        hasMore: z.boolean()
    })
});
