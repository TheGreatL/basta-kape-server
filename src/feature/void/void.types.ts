import { z } from 'zod';

export const VoidOrderSchema = z.object({
    reason: z.string().min(3, 'Reason must be at least 3 characters long').max(1000, 'Reason cannot exceed 1000 characters')
});

export type TVoidOrder = z.infer<typeof VoidOrderSchema>;

export const OrderVoidLogResponseSchema = z.object({
    id: z.string().uuid(),
    orderId: z.string().uuid(),
    reason: z.string(),
    voidedById: z.string().uuid(),
    createdAt: z.date().or(z.string()),
    voidedBy: z
        .object({
            id: z.string().uuid(),
            username: z.string(),
            firstName: z.string(),
            lastName: z.string()
        })
        .optional(),
    order: z
        .object({
            id: z.string().uuid(),
            queueNumber: z.string().nullable().optional(),
            customerName: z.string().nullable().optional(),
            netTotal: z.number().optional()
        })
        .optional()
});

export type TOrderVoidLogResponse = z.infer<typeof OrderVoidLogResponseSchema>;
