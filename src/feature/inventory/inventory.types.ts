import { z } from 'zod';

// Pagination and List Queries
export const GetListQuerySchema = z.object({
    page: z.coerce.number().min(1).default(1).optional(),
    limit: z.coerce.number().min(1).max(100).default(10).optional(),
    search: z.string().optional(),
    status: z.enum(['active', 'archive']).default('active').optional()
});
export type TGetListQuery = z.infer<typeof GetListQuerySchema>;

// ==========================================
// 1. INGREDIENT UNIT SCHEMAS
// ==========================================
export const CreateIngredientUnitSchema = z.object({
    name: z.string().min(2).max(100),
    abbreviation: z.string().max(20).optional().nullable()
});
export type TCreateIngredientUnit = z.infer<typeof CreateIngredientUnitSchema>;

export const UpdateIngredientUnitSchema = z.object({
    name: z.string().min(2).max(100).optional(),
    abbreviation: z.string().max(20).optional().nullable()
});
export type TUpdateIngredientUnit = z.infer<typeof UpdateIngredientUnitSchema>;

export const IngredientUnitResponseSchema = z.object({
    id: z.string(),
    name: z.string(),
    abbreviation: z.string().nullable(),
    createdAt: z.date().or(z.string()),
    updatedAt: z.date().or(z.string()),
    deletedAt: z.date().nullable().or(z.string().nullable())
});

export const PaginatedIngredientUnitResponseSchema = z.object({
    data: z.array(IngredientUnitResponseSchema),
    meta: z.object({
        total: z.number(),
        pageCount: z.number(),
        count: z.number(),
        currentPage: z.number(),
        hasMore: z.boolean()
    })
});

// ==========================================
// 2. INGREDIENT SCHEMAS
// ==========================================
export const CreateIngredientSchema = z.object({
    name: z.string().min(2).max(100),
    description: z.string().max(500).optional().nullable(),
    ingredientUnitId: z.string().uuid(),
    reorderPoint: z.number().min(0).default(0)
});
export type TCreateIngredient = z.infer<typeof CreateIngredientSchema>;

export const UpdateIngredientSchema = z.object({
    name: z.string().min(2).max(100).optional(),
    description: z.string().max(500).optional().nullable(),
    ingredientUnitId: z.string().uuid().optional(),
    reorderPoint: z.number().min(0).optional()
});
export type TUpdateIngredient = z.infer<typeof UpdateIngredientSchema>;

export const IngredientResponseSchema = z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    ingredientUnitId: z.string(),
    reorderPoint: z.number(),
    createdAt: z.date().or(z.string()),
    updatedAt: z.date().or(z.string()),
    deletedAt: z.date().nullable().or(z.string().nullable())
});

export const PaginatedIngredientResponseSchema = z.object({
    data: z.array(IngredientResponseSchema),
    meta: z.object({
        total: z.number(),
        pageCount: z.number(),
        count: z.number(),
        currentPage: z.number(),
        hasMore: z.boolean()
    })
});

// ==========================================
// 3. INGREDIENT INVENTORY (LEVELS) SCHEMAS
// ==========================================
export const UpdateInventoryCountSchema = z.object({
    currentQuantity: z.number().min(0)
});
export type TUpdateInventoryCount = z.infer<typeof UpdateInventoryCountSchema>;

export const InventoryLevelResponseSchema = z.object({
    id: z.string(),
    ingredientId: z.string(),
    currentQuantity: z.number(),
    lastPhysicalCount: z.date().nullable().or(z.string().nullable()),
    status: z.enum(['SAFE', 'CRITICAL', 'OUT_OF_STOCK']),
    ingredient: z.object({
        id: z.string(),
        name: z.string(),
        reorderPoint: z.number(),
        defaultUnit: z.object({
            id: z.string(),
            name: z.string(),
            abbreviation: z.string().nullable()
        })
    }),
    createdAt: z.date().or(z.string()),
    updatedAt: z.date().or(z.string()),
    deletedAt: z.date().nullable().or(z.string().nullable())
});

export const PaginatedInventoryLevelResponseSchema = z.object({
    data: z.array(InventoryLevelResponseSchema),
    meta: z.object({
        total: z.number(),
        pageCount: z.number(),
        count: z.number(),
        currentPage: z.number(),
        hasMore: z.boolean()
    })
});

// ==========================================
// 4. INGREDIENT DELIVERY (BATCHES) SCHEMAS
// ==========================================
export const CreateDeliverySchema = z.object({
    ingredientId: z.string().uuid(),
    supplierId: z.string().uuid().optional().nullable(),
    quantityReceived: z.number().positive(),
    unitCost: z.number().nonnegative(),
    batchNumber: z.string().max(100).optional().nullable(),
    expiryDate: z.string().datetime().or(z.string().date()).optional().nullable()
});
export type TCreateDelivery = z.infer<typeof CreateDeliverySchema>;

export const DeliveryResponseSchema = z.object({
    id: z.string(),
    ingredientId: z.string(),
    supplierId: z.string().nullable(),
    quantityReceived: z.number(),
    unitCost: z.number(),
    totalCost: z.number(),
    batchNumber: z.string().nullable(),
    expiryDate: z.date().nullable().or(z.string().nullable()),
    receivedAt: z.date().or(z.string()),
    createdAt: z.date().or(z.string()),
    updatedAt: z.date().or(z.string()),
    deletedAt: z.date().nullable().or(z.string().nullable())
});

export const PaginatedDeliveryResponseSchema = z.object({
    data: z.array(DeliveryResponseSchema),
    meta: z.object({
        total: z.number(),
        pageCount: z.number(),
        count: z.number(),
        currentPage: z.number(),
        hasMore: z.boolean()
    })
});

// ==========================================
// 5. INVENTORY ADJUSTMENT SCHEMAS
// ==========================================
export const CreateAdjustmentSchema = z.object({
    ingredientId: z.string().uuid(),
    quantity: z.number(), // Can be negative (waste) or positive (physical count correction)
    type: z.enum(['WASTE', 'SPOILED', 'EXPIRED', 'THEFT', 'PROMOTIONAL_USE', 'PHYSICAL_COUNT_DISCREPANCY']),
    reason: z.string().max(500).optional().nullable()
});
export type TCreateAdjustment = z.infer<typeof CreateAdjustmentSchema>;

export const AdjustmentResponseSchema = z.object({
    id: z.string(),
    ingredientId: z.string(),
    quantity: z.number(),
    type: z.enum(['WASTE', 'SPOILED', 'EXPIRED', 'THEFT', 'PROMOTIONAL_USE', 'PHYSICAL_COUNT_DISCREPANCY']),
    reason: z.string().nullable(),
    createdAt: z.date().or(z.string()),
    updatedAt: z.date().or(z.string()),
    deletedAt: z.date().nullable().or(z.string().nullable())
});

export const PaginatedAdjustmentResponseSchema = z.object({
    data: z.array(AdjustmentResponseSchema),
    meta: z.object({
        total: z.number(),
        pageCount: z.number(),
        count: z.number(),
        currentPage: z.number(),
        hasMore: z.boolean()
    })
});
