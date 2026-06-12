import { z } from 'zod';
import { DiscountType } from '@prisma/client';

export const DiscountTypeEnum = z.nativeEnum(DiscountType);

export const CreateDiscountSchema = z.object({
    name: z.string().min(1, 'Discount name is required').max(100),
    type: DiscountTypeEnum.default(DiscountType.PERCENTAGE),
    value: z.number().nonnegative('Discount value must be greater than or equal to zero'),
    code: z.string().max(50).optional().nullable(),
    isActive: z.boolean().default(true).optional()
});

export type TCreateDiscount = z.infer<typeof CreateDiscountSchema>;

export const UpdateDiscountSchema = CreateDiscountSchema.partial();

export type TUpdateDiscount = z.infer<typeof UpdateDiscountSchema>;

export const ApplyDiscountSchema = z.object({
    discountId: z.string().uuid('Invalid discount ID'),
    referenceId: z.string().max(100).optional().nullable(),
    referenceName: z.string().max(100).optional().nullable()
});

export type TApplyDiscount = z.infer<typeof ApplyDiscountSchema>;

export const DiscountResponseSchema = z.object({
    id: z.string().uuid(),
    name: z.string(),
    type: DiscountTypeEnum,
    value: z.number(),
    code: z.string().nullable(),
    isActive: z.boolean(),
    createdAt: z.date().or(z.string()),
    updatedAt: z.date().or(z.string()),
    deletedAt: z.date().or(z.string()).nullable()
});

export type TDiscountResponse = z.infer<typeof DiscountResponseSchema>;

export const OrderDiscountResponseSchema = z.object({
    id: z.string().uuid(),
    orderId: z.string().uuid(),
    discountId: z.string().uuid(),
    amount: z.number(),
    referenceId: z.string().nullable(),
    referenceName: z.string().nullable(),
    createdAt: z.date().or(z.string())
});

export type TOrderDiscountResponse = z.infer<typeof OrderDiscountResponseSchema>;
