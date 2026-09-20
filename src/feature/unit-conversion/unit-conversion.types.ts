import { z } from 'zod';

export const UnitConversionItemUnitSchema = z.object({
    id: z.string(),
    name: z.string(),
    abbreviation: z.string().nullable().optional()
});

export const UnitConversionItemIngredientSchema = z.object({
    id: z.string(),
    name: z.string()
});

export const UnitConversionResponseSchema = z.object({
    id: z.string(),
    fromUnitId: z.string(),
    fromUnit: UnitConversionItemUnitSchema,
    toUnitId: z.string(),
    toUnit: UnitConversionItemUnitSchema,
    factor: z.number(),
    ingredientId: z.string().nullable().optional(),
    ingredient: UnitConversionItemIngredientSchema.nullable().optional(),
    createdAt: z.date().or(z.string()),
    updatedAt: z.date().or(z.string())
});

export type TUnitConversionResponse = z.infer<typeof UnitConversionResponseSchema>;

export const PaginatedUnitConversionResponseSchema = z.object({
    data: z.array(UnitConversionResponseSchema),
    meta: z.object({
        total: z.number(),
        pageCount: z.number(),
        count: z.number(),
        currentPage: z.number(),
        hasMore: z.boolean()
    })
});

export type TPaginatedUnitConversionResponse = z.infer<typeof PaginatedUnitConversionResponseSchema>;

export const CreateUnitConversionSchema = z
    .object({
        fromUnitId: z.string().min(1, 'From unit is required'),
        toUnitId: z.string().min(1, 'To unit is required'),
        factor: z.number().positive('Factor must be greater than 0'),
        ingredientId: z.string().nullable().optional()
    })
    .refine((data) => data.fromUnitId !== data.toUnitId, {
        message: 'From unit and To unit cannot be the same',
        path: ['toUnitId']
    });

export type TCreateUnitConversion = z.infer<typeof CreateUnitConversionSchema>;

export const UpdateUnitConversionSchema = z.object({
    factor: z.number().positive('Factor must be greater than 0')
});

export type TUpdateUnitConversion = z.infer<typeof UpdateUnitConversionSchema>;

export const GetUnitConversionListQuerySchema = z.object({
    page: z.coerce.number().min(1).default(1).optional(),
    limit: z.coerce.number().min(1).max(100).default(10).optional(),
    fromUnitId: z.string().optional(),
    toUnitId: z.string().optional(),
    ingredientId: z.string().optional(),
    search: z.string().optional()
});

export type TGetUnitConversionListQuery = z.infer<typeof GetUnitConversionListQuerySchema>;

export const ConvertQuantityQuerySchema = z.object({
    fromUnitId: z.string().min(1, 'From unit is required'),
    toUnitId: z.string().min(1, 'To unit is required'),
    quantity: z.coerce.number().positive('Quantity must be greater than 0'),
    ingredientId: z.string().optional()
});

export type TConvertQuantityQuery = z.infer<typeof ConvertQuantityQuerySchema>;

export const ConvertQuantityResponseSchema = z.object({
    fromUnitId: z.string(),
    fromUnitName: z.string(),
    toUnitId: z.string(),
    toUnitName: z.string(),
    originalQuantity: z.number(),
    convertedQuantity: z.number(),
    factor: z.number(),
    ingredientId: z.string().nullable().optional(),
    ingredientName: z.string().nullable().optional()
});

export type TConvertQuantityResponse = z.infer<typeof ConvertQuantityResponseSchema>;
