import { z } from 'zod';
import { PurchaseOrderStatus } from '@prisma/client';

export const CreatePurchaseOrderItemSchema = z.object({
    ingredientId: z.string().uuid('Invalid ingredient ID'),
    quantity: z.number().positive('Quantity must be greater than zero'),
    unitCost: z.number().nonnegative('Unit cost cannot be negative')
});

export const CreatePurchaseOrderSchema = z.object({
    supplierId: z.string().uuid('Invalid supplier ID'),
    notes: z.string().max(500, 'Notes must not exceed 500 characters').optional(),
    items: z.array(CreatePurchaseOrderItemSchema).min(1, 'Purchase order must contain at least 1 item')
});

export const UpdatePurchaseOrderStatusSchema = z.object({
    status: z.nativeEnum(PurchaseOrderStatus)
});

export type TCreatePurchaseOrder = z.infer<typeof CreatePurchaseOrderSchema>;
export type TUpdatePurchaseOrderStatus = z.infer<typeof UpdatePurchaseOrderStatusSchema>;
