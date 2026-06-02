import { z } from 'zod';

// Pagination and List Queries for Products
export const GetProductListQuerySchema = z.object({
    page: z.coerce.number().min(1).default(1).optional(),
    limit: z.coerce.number().min(1).max(100).default(10).optional(),
    search: z.string().optional(),
    productCategoryId: z.string().uuid().optional(),
    productTypeId: z.string().uuid().optional(),
    status: z.enum(['active', 'archive']).default('active').optional()
});

export type TGetProductListQuery = z.infer<typeof GetProductListQuerySchema>;

// Product CRUD Schemas
export const CreateProductSchema = z.object({
    name: z.string().min(2).max(100),
    photo: z.string().url().or(z.string().max(2048)).optional().nullable(),
    description: z.string().max(1000).optional().nullable(),
    productCategoryId: z.string().uuid().optional().nullable(),
    productTypeId: z.string().uuid().optional().nullable()
});

export type TCreateProduct = z.infer<typeof CreateProductSchema>;

export const UpdateProductSchema = z.object({
    name: z.string().min(2).max(100).optional(),
    photo: z.string().url().or(z.string().max(2048)).optional().nullable(),
    description: z.string().max(1000).optional().nullable(),
    productCategoryId: z.string().uuid().optional().nullable(),
    productTypeId: z.string().uuid().optional().nullable()
});

export type TUpdateProduct = z.infer<typeof UpdateProductSchema>;

// Product Variant CRUD Schemas
export const CreateProductVariantSchema = z.object({
    sku: z.string().min(2).max(50).optional().nullable(),
    price: z.number().nonnegative().default(0),
    attributeValueIds: z.array(z.string().uuid()).default([]) // attribute values mapping (e.g. Medium, Oat Milk)
});

export type TCreateProductVariant = z.infer<typeof CreateProductVariantSchema>;

export const UpdateProductVariantSchema = z.object({
    sku: z.string().min(2).max(50).optional().nullable(),
    price: z.number().nonnegative().optional(),
    attributeValueIds: z.array(z.string().uuid()).optional() // will fully re-sync join table attributes
});

export type TUpdateProductVariant = z.infer<typeof UpdateProductVariantSchema>;

// Response Schemas for API Documentation
export const ProductVariantAttributeResponseSchema = z.object({
    id: z.string(),
    productVariantId: z.string(),
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
});

export const ProductVariantResponseSchema = z.object({
    id: z.string(),
    productId: z.string(),
    sku: z.string().nullable(),
    price: z.number(),
    attributes: z.array(ProductVariantAttributeResponseSchema),
    createdAt: z.date().or(z.string()),
    updatedAt: z.date().or(z.string()),
    deletedAt: z.date().nullable().or(z.string().nullable())
});

export const ProductResponseSchema = z.object({
    id: z.string(),
    name: z.string(),
    photo: z.string().nullable(),
    description: z.string().nullable(),
    productCategoryId: z.string().nullable(),
    productTypeId: z.string().nullable(),
    category: z
        .object({
            id: z.string(),
            name: z.string()
        })
        .nullable()
        .optional(),
    type: z
        .object({
            id: z.string(),
            name: z.string()
        })
        .nullable()
        .optional(),
    variants: z.array(ProductVariantResponseSchema).optional(),
    createdAt: z.date().or(z.string()),
    updatedAt: z.date().or(z.string()),
    deletedAt: z.date().nullable().or(z.string().nullable())
});

export const PaginatedProductResponseSchema = z.object({
    data: z.array(ProductResponseSchema),
    meta: z.object({
        total: z.number(),
        pageCount: z.number(),
        count: z.number(),
        currentPage: z.number(),
        hasMore: z.boolean()
    })
});
