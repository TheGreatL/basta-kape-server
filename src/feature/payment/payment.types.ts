import { z } from 'zod';
import { PaymentMethod, PaymentStatus } from '@prisma/client';

export const PaymentMethodEnum = z.nativeEnum(PaymentMethod);
export const PaymentStatusEnum = z.nativeEnum(PaymentStatus);

export const CreatePaymentSchema = z.discriminatedUnion('paymentMethod', [
    z.object({
        paymentMethod: z.literal(PaymentMethod.CASH),
        amountTendered: z.number().nonnegative('Amount tendered must be greater than or equal to zero')
    }),
    z.object({
        paymentMethod: z.literal(PaymentMethod.GCASH),
        gcashReferenceNumber: z.string().min(5, 'GCash reference number must be at least 5 characters'),
        paymentProofPhoto: z.string().max(1000).optional().nullable()
    }),
    z.object({
        paymentMethod: z.literal(PaymentMethod.PAYMAYA),
        gcashReferenceNumber: z.string().min(5, 'PayMaya reference number must be at least 5 characters'),
        paymentProofPhoto: z.string().max(1000).optional().nullable()
    }),
    z.object({
        paymentMethod: z.literal(PaymentMethod.CREDIT_CARD),
        gcashReferenceNumber: z.string().min(5, 'Credit Card reference/transaction number must be at least 5 characters'),
        paymentProofPhoto: z.string().max(1000).optional().nullable()
    })
]);

export type TCreatePayment = z.infer<typeof CreatePaymentSchema>;

export const OrderPaymentResponseSchema = z.object({
    id: z.string().uuid(),
    orderId: z.string().uuid(),
    paymentMethod: PaymentMethodEnum,
    paymentStatus: PaymentStatusEnum,
    amount: z.number(),
    gcashReferenceNumber: z.string().nullable(),
    paymentProofPhoto: z.string().nullable(),
    amountTendered: z.number().nullable(),
    amountChange: z.number().nullable(),
    createdAt: z.date().or(z.string()),
    updatedAt: z.date().or(z.string())
});

export type TOrderPaymentResponse = z.infer<typeof OrderPaymentResponseSchema>;
