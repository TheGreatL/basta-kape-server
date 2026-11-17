import { z } from 'zod';

export const CreateStoreSettingSchema = z.object({
    storeName: z.string().min(1).max(100),
    address: z.string().min(1).max(500),
    contactNumber: z.string().max(50).optional().nullable(),
    openingTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Time must be in HH:MM format'),
    closingTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Time must be in HH:MM format'),
    vatRate: z.number().nonnegative().default(12.0),
    serviceCharge: z.number().nonnegative().default(0.0),
    deliveryBaseFare: z.number().nonnegative().default(49.0),
    deliveryBaseDistanceKm: z.number().nonnegative().default(2.0),
    deliveryRatePerKm: z.number().nonnegative().default(10.0),
    deliveryMaxDistanceKm: z.number().positive().default(10.0),
    storeLatitude: z.number().default(14.6288),
    storeLongitude: z.number().default(121.0422)
});

export type TCreateStoreSetting = z.infer<typeof CreateStoreSettingSchema>;

export const UpdateStoreSettingSchema = z.object({
    storeName: z.string().min(1).max(100).optional(),
    address: z.string().min(1).max(500).optional(),
    contactNumber: z.string().max(50).optional().nullable(),
    openingTime: z
        .string()
        .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Time must be in HH:MM format')
        .optional(),
    closingTime: z
        .string()
        .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Time must be in HH:MM format')
        .optional(),
    vatRate: z.number().nonnegative().optional(),
    serviceCharge: z.number().nonnegative().optional(),
    deliveryBaseFare: z.number().nonnegative().optional(),
    deliveryBaseDistanceKm: z.number().nonnegative().optional(),
    deliveryRatePerKm: z.number().nonnegative().optional(),
    deliveryMaxDistanceKm: z.number().positive().optional(),
    storeLatitude: z.number().optional(),
    storeLongitude: z.number().optional()
});

export type TUpdateStoreSetting = z.infer<typeof UpdateStoreSettingSchema>;

export const StoreSettingResponseSchema = z.object({
    id: z.string(),
    storeName: z.string(),
    address: z.string(),
    contactNumber: z.string().nullable(),
    openingTime: z.string(),
    closingTime: z.string(),
    vatRate: z.number(),
    serviceCharge: z.number(),
    deliveryBaseFare: z.number(),
    deliveryBaseDistanceKm: z.number(),
    deliveryRatePerKm: z.number(),
    deliveryMaxDistanceKm: z.number(),
    storeLatitude: z.number(),
    storeLongitude: z.number(),
    updatedAt: z.date().or(z.string())
});

export type TStoreSettingResponse = z.infer<typeof StoreSettingResponseSchema>;
