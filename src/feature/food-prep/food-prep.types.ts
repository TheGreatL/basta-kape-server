import { z } from 'zod';

export const PreparedBatchStatusEnum = z.enum(['FRESH', 'NEAR_EXPIRY', 'EXPIRED', 'DEPLETED', 'DISPOSED']);
export type TPreparedBatchStatus = z.infer<typeof PreparedBatchStatusEnum>;

export const PreparedAdjustmentTypeEnum = z.enum(['SALE', 'EXPIRED', 'SPOILED', 'WASTE', 'SAMPLING', 'DISPOSED', 'CORRECTION']);
export type TPreparedAdjustmentType = z.infer<typeof PreparedAdjustmentTypeEnum>;

// Query Schemas
export const GetPreparedBatchListQuerySchema = z.object({
    page: z.coerce.number().min(1).default(1).optional(),
    limit: z.coerce.number().min(1).max(100).default(10).optional(),
    search: z.string().optional(),
    productVariantId: z.string().uuid().optional(),
    productId: z.string().uuid().optional(),
    status: PreparedBatchStatusEnum.optional(),
    expiringWithinMinutes: z.coerce.number().min(1).optional()
});

export type TGetPreparedBatchListQuery = z.infer<typeof GetPreparedBatchListQuerySchema>;

// Batch Creation Schema
export const CreatePreparedBatchSchema = z.object({
    productVariantId: z.string().uuid(),
    quantity: z.number().positive().min(1),
    shelfLifeMinutes: z.number().int().positive().optional(),
    notes: z.string().max(500).optional().nullable()
});

export type TCreatePreparedBatch = z.infer<typeof CreatePreparedBatchSchema>;

// Batch Disposal / Spoilage Schema
export const DisposePreparedBatchSchema = z.object({
    quantity: z.number().positive(),
    reason: PreparedAdjustmentTypeEnum.default('EXPIRED'),
    notes: z.string().max(500).optional().nullable()
});

export type TDisposePreparedBatch = z.infer<typeof DisposePreparedBatchSchema>;

// Response Schemas
export const PreparedItemTransactionResponseSchema = z.object({
    id: z.string(),
    batchId: z.string(),
    quantityChange: z.number(),
    type: PreparedAdjustmentTypeEnum,
    reason: z.string().nullable(),
    orderId: z.string().nullable(),
    createdAt: z.date().or(z.string())
});

export const PreparedBatchResponseSchema = z.object({
    id: z.string(),
    productVariantId: z.string(),
    productId: z.string(),
    batchNumber: z.string(),
    quantityPrepared: z.number(),
    currentQuantity: z.number(),
    preparedAt: z.date().or(z.string()),
    shelfLifeMinutes: z.number(),
    expiresAt: z.date().or(z.string()),
    status: PreparedBatchStatusEnum,
    notes: z.string().nullable(),
    product: z.object({
        id: z.string(),
        name: z.string(),
        photo: z.string().nullable()
    }),
    productVariant: z.object({
        id: z.string(),
        sku: z.string().nullable(),
        price: z.number(),
        attributes: z.array(
            z.object({
                id: z.string(),
                attributeValue: z.object({
                    value: z.string(),
                    attribute: z.object({
                        name: z.string()
                    })
                })
            })
        )
    }),
    transactions: z.array(PreparedItemTransactionResponseSchema).optional(),
    createdAt: z.date().or(z.string()),
    updatedAt: z.date().or(z.string())
});

export const PaginatedPreparedBatchResponseSchema = z.object({
    data: z.array(PreparedBatchResponseSchema),
    meta: z.object({
        total: z.number(),
        pageCount: z.number(),
        count: z.number(),
        currentPage: z.number(),
        hasMore: z.boolean()
    })
});

export const DisplayStockItemSummarySchema = z.object({
    productVariantId: z.string(),
    productId: z.string(),
    productName: z.string(),
    sku: z.string().nullable(),
    price: z.number(),
    variantLabel: z.string(),
    totalFreshQuantity: z.number(),
    totalNearExpiryQuantity: z.number(),
    totalExpiredQuantity: z.number(),
    earliestExpiry: z.date().or(z.string()).nullable(),
    activeBatchesCount: z.number()
});

export const DisplayStockSummaryResponseSchema = z.object({
    items: z.array(DisplayStockItemSummarySchema),
    totalFreshUnits: z.number(),
    totalExpiringSoonUnits: z.number(),
    totalExpiredUnits: z.number()
});
