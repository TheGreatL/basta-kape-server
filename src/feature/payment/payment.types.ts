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
        paymentReferenceNumber: z.string().regex(/^\d{13}$/, 'GCash reference number must be exactly 13 digits'),
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
    paymentReferenceNumber: z.string().nullable(),
    paymentProofPhoto: z.string().nullable(),
    amountTendered: z.number().nullable(),
    amountChange: z.number().nullable(),
    createdAt: z.date().or(z.string()),
    updatedAt: z.date().or(z.string())
});

export type TOrderPaymentResponse = z.infer<typeof OrderPaymentResponseSchema>;
