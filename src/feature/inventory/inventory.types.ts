import { z } from 'zod';

// Pagination and List Queries
export const GetListQuerySchema = z.object({
    page: z.coerce.number().min(1).default(1).optional(),
    limit: z.coerce.number().min(1).max(100).default(10).optional(),
    search: z.string().optional(),
    status: z.enum(['active', 'archive']).default('active').optional()
});
export type TGetListQuery = z.infer<typeof GetListQuerySchema>;

export const GetStockLevelListQuerySchema = z.object({
    page: z.coerce.number().min(1).default(1).optional(),
    limit: z.coerce.number().min(1).max(100).default(10).optional(),
    search: z.string().optional(),
    status: z.enum(['SAFE', 'CRITICAL', 'OUT_OF_STOCK']).optional(),
    recordStatus: z.enum(['active', 'archive']).default('active').optional()
});
export type TGetStockLevelListQuery = z.infer<typeof GetStockLevelListQuerySchema>;

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
// 4. INGREDIENT BATCHES & STOCK TRANSACTIONS SCHEMAS
// ==========================================
export const CreateBatchSchema = z.object({
    ingredientId: z.string().uuid(),
    supplierId: z.string().uuid().optional().nullable(),
    quantityReceived: z.number().positive(),
    unitCost: z.number().nonnegative(),
    batchNumber: z.string().max(100).optional().nullable(),
    expiryDate: z.string().datetime().or(z.string().date()).optional().nullable()
});
export type TCreateBatch = z.infer<typeof CreateBatchSchema>;

export const BatchResponseSchema = z.object({
    id: z.string(),
    ingredientId: z.string(),
    supplierId: z.string().nullable(),
    quantityReceived: z.number(),
    currentQuantity: z.number(),
    unitCost: z.number(),
    totalCost: z.number(),
    batchNumber: z.string().nullable(),
    expiryDate: z.date().nullable().or(z.string().nullable()),
    receivedAt: z.date().or(z.string()),
    createdAt: z.date().or(z.string()),
    updatedAt: z.date().or(z.string()),
    deletedAt: z.date().nullable().or(z.string().nullable())
});

export const PaginatedBatchResponseSchema = z.object({
    data: z.array(BatchResponseSchema),
    meta: z.object({
        total: z.number(),
        pageCount: z.number(),
        count: z.number(),
        currentPage: z.number(),
        hasMore: z.boolean()
    })
});

export const StockTransactionResponseSchema = z.object({
    id: z.string(),
    batchId: z.string(),
    quantityChange: z.number(),
    type: z.enum(['DELIVERY', 'SALE', 'WASTE', 'SPOILED', 'EXPIRED', 'THEFT', 'PROMOTIONAL_USE', 'PHYSICAL_COUNT_CORRECTION']),
    reason: z.string().nullable(),
    createdAt: z.date().or(z.string())
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

// ==========================================
// 6. INVENTORY FORECAST SCHEMAS
// ==========================================
export const ForecastIngredientSchema = z.object({
    ingredientId: z.string(),
    name: z.string(),
    currentQuantity: z.number(),
    requiredQuantity: z.number(),
    unit: z.string(),
    canProduce: z.union([z.number(), z.string()])
});

export const ForecastVariantSchema = z.object({
    variantId: z.string(),
    productId: z.string(),
    name: z.string(),
    sku: z.string().nullable(),
    price: z.number(),
    hasRecipe: z.boolean(),
    maxProduceable: z.union([z.number(), z.string()]).nullable(),
    bottleneck: z
        .object({
            ingredientId: z.string(),
            name: z.string(),
            currentQuantity: z.number(),
            requiredQuantity: z.number(),
            unit: z.string()
        })
        .nullable(),
    ingredients: z.array(ForecastIngredientSchema)
});

export const InventoryForecastResponseSchema = z.array(ForecastVariantSchema);

// ==========================================
// 7. INVENTORY DASHBOARD SCHEMAS
// ==========================================
export const InventoryDashboardOverviewResponseSchema = z.object({
    totalIngredients: z.number(),
    lowStockCount: z.number(),
    outOfStockCount: z.number()
});

export const DashboardBatchSchema = z.object({
    id: z.string(),
    ingredientName: z.string(),
    supplierName: z.string().nullable(),
    quantityReceived: z.number(),
    currentQuantity: z.number(),
    unitAbbreviation: z.string().nullable(),
    totalCost: z.number(),
    receivedAt: z.date().or(z.string())
});

export const DashboardAdjustmentSchema = z.object({
    id: z.string(),
    ingredientName: z.string(),
    quantity: z.number(),
    unitAbbreviation: z.string().nullable(),
    type: z.string(),
    reason: z.string().nullable(),
    createdAt: z.date().or(z.string())
});

export const DashboardExpiringSoonSchema = z.object({
    id: z.string(),
    batchNumber: z.string().nullable(),
    expiryDate: z.date().or(z.string()),
    quantityReceived: z.number(),
    currentQuantity: z.number(),
    ingredientName: z.string(),
    unitAbbreviation: z.string().nullable()
});

export const DashboardWasteSummarySchema = z.object({
    type: z.string(),
    count: z.number(),
    totalQuantity: z.number()
});
