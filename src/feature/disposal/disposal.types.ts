import { z } from 'zod';

export const DisposalCategoryEnum = z.enum(['ALL', 'PREPARED_FOOD', 'RAW_INGREDIENT']);
export type TDisposalCategory = z.infer<typeof DisposalCategoryEnum>;

export const DisposalReasonEnum = z.enum([
    'ALL',
    'EXPIRED',
    'SPOILED',
    'WASTE',
    'SAMPLING',
    'THEFT',
    'PROMOTIONAL_USE',
    'DISPOSED',
    'PHYSICAL_COUNT_CORRECTION'
]);
export type TDisposalReason = z.infer<typeof DisposalReasonEnum>;

// Query schema for paginated list
export const GetDisposalListQuerySchema = z.object({
    page: z.coerce.number().min(1).default(1).optional(),
    limit: z.coerce.number().min(1).max(100).default(10).optional(),
    search: z.string().optional(),
    category: DisposalCategoryEnum.default('ALL').optional(),
    reason: DisposalReasonEnum.default('ALL').optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional()
});

export type TGetDisposalListQuery = z.infer<typeof GetDisposalListQuerySchema>;

// Query schema for summary statistics
export const GetDisposalSummaryQuerySchema = z.object({
    search: z.string().optional(),
    category: DisposalCategoryEnum.default('ALL').optional(),
    reason: DisposalReasonEnum.default('ALL').optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional()
});

export type TGetDisposalSummaryQuery = z.infer<typeof GetDisposalSummaryQuerySchema>;

// Actor info
export const DisposalActorSchema = z.object({
    id: z.string(),
    name: z.string(),
    username: z.string()
});

// Single normalized disposal record response
export const DisposalItemResponseSchema = z.object({
    id: z.string(),
    category: z.enum(['PREPARED_FOOD', 'RAW_INGREDIENT']),
    itemId: z.string(),
    itemName: z.string(),
    variantLabel: z.string().nullable().optional(),
    batchNumber: z.string(),
    quantity: z.number(),
    unit: z.string(),
    estimatedCostLoss: z.number(),
    reason: z.string(),
    notes: z.string().nullable().optional(),
    disposedAt: z.date().or(z.string()),
    disposedBy: DisposalActorSchema.nullable().optional()
});

export type TDisposalItemResponse = z.infer<typeof DisposalItemResponseSchema>;

// Paginated disposal response
export const PaginatedDisposalResponseSchema = z.object({
    data: z.array(DisposalItemResponseSchema),
    meta: z.object({
        total: z.number(),
        pageCount: z.number(),
        count: z.number(),
        currentPage: z.number(),
        hasMore: z.boolean()
    })
});

// Top wasted item breakdown
export const TopWastedItemSchema = z.object({
    itemName: z.string(),
    category: z.enum(['PREPARED_FOOD', 'RAW_INGREDIENT']),
    totalQuantity: z.number(),
    unit: z.string(),
    totalCostLoss: z.number()
});

// Summary KPI response
export const DisposalSummaryResponseSchema = z.object({
    totalWastedItemsCount: z.number(),
    totalFinancialLoss: z.number(),
    preparedFoodLoss: z.number(),
    rawIngredientLoss: z.number(),
    preparedFoodWastedCount: z.number(),
    rawIngredientWastedCount: z.number(),
    reasonBreakdown: z.record(z.string(), z.number()),
    topWastedItems: z.array(TopWastedItemSchema)
});

export type TDisposalSummaryResponse = z.infer<typeof DisposalSummaryResponseSchema>;
