import { z } from 'zod';
import { OrderPaymentResponseSchema } from '@/feature/payment/payment.types';

export const OrderStatusEnum = z.enum(['PENDING', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED']);
export type TOrderStatus = z.infer<typeof OrderStatusEnum>;

export const OrderTypeEnum = z.enum(['DINE_IN', 'TAKE_OUT', 'DELIVERY']);
export type TOrderType = z.infer<typeof OrderTypeEnum>;

export const OrderSourceEnum = z.enum(['POS', 'MOBILE_APP', 'WEBSITE', 'DELIVERY_PARTNER']);
export type TOrderSource = z.infer<typeof OrderSourceEnum>;

export const CreateOrderItemSchema = z.object({
    productVariantId: z.string().uuid(),
    quantity: z.number().int().positive().default(1),
    notes: z.string().max(500).optional().nullable(),
    modifierOptionIds: z.array(z.string().uuid()).default([])
});

export type TCreateOrderItem = z.infer<typeof CreateOrderItemSchema>;

export const CreateOrderSchema = z
    .object({
        orderType: OrderTypeEnum.default('DINE_IN'),
        orderSource: OrderSourceEnum.default('POS'),
        notes: z.string().max(1000).optional().nullable(),
        customerId: z.string().uuid().optional().nullable(),
        customerName: z.string().max(100).optional().nullable(),
        paymentMethod: z.enum(['CASH', 'GCASH', 'PAYMAYA']).optional().nullable(),
        gcashReferenceNumber: z.string().max(100).optional().nullable(),
        paymentProofPhoto: z.string().max(1000).optional().nullable(),
        items: z.array(CreateOrderItemSchema).min(1, 'Order must contain at least one item')
    })
    .superRefine((data, ctx) => {
        if (data.paymentMethod === 'GCASH' || data.paymentMethod === 'PAYMAYA') {
            if (!data.gcashReferenceNumber || !data.gcashReferenceNumber.trim()) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'Reference number is required for GCash/Maya payments',
                    path: ['gcashReferenceNumber']
                });
            }
            if (data.orderSource === 'WEBSITE' || data.orderSource === 'MOBILE_APP') {
                if (!data.paymentProofPhoto || !data.paymentProofPhoto.trim()) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: 'Payment proof photo is required for GCash/Maya payments from customer sources',
                        path: ['paymentProofPhoto']
                    });
                }
            }
        }
    });

export type TCreateOrder = z.infer<typeof CreateOrderSchema>;

export const UpdateOrderStatusSchema = z.object({
    status: OrderStatusEnum,
    notes: z.string().max(1000).optional().nullable()
});

export type TUpdateOrderStatus = z.infer<typeof UpdateOrderStatusSchema>;

export const GetOrderListQuerySchema = z.object({
    page: z.coerce.number().min(1).default(1).optional(),
    limit: z.coerce.number().min(1).max(100).default(10).optional(),
    search: z.string().optional(),
    status: OrderStatusEnum.optional(),
    orderType: OrderTypeEnum.optional(),
    orderSource: OrderSourceEnum.optional()
});

export type TGetOrderListQuery = z.infer<typeof GetOrderListQuerySchema>;

export const OrderItemResponseSchema = z.object({
    id: z.string(),
    productVariantId: z.string(),
    quantity: z.number(),
    unitPrice: z.number(),
    totalPrice: z.number(),
    notes: z.string().nullable(),
    modifiers: z
        .array(
            z.object({
                id: z.string(),
                modifierOptionId: z.string(),
                price: z.number(),
                modifierOption: z.object({
                    name: z.string()
                })
            })
        )
        .optional()
});

export const OrderResponseSchema = z.object({
    id: z.string(),
    queueNumber: z.string().nullable(),
    buzzerId: z.string().nullable(),
    status: OrderStatusEnum,
    orderType: OrderTypeEnum,
    orderSource: OrderSourceEnum,
    notes: z.string().nullable(),
    subtotal: z.number(),
    taxAmount: z.number(),
    discountAmount: z.number(),
    netTotal: z.number(),
    customerId: z.string().nullable(),
    customerName: z.string().nullable(),
    cashierSessionId: z.string().nullable(),
    createdAt: z.date().or(z.string()),
    updatedAt: z.date().or(z.string()),
    items: z.array(OrderItemResponseSchema).optional(),
    payments: z.array(OrderPaymentResponseSchema).optional(),
    discounts: z
        .array(
            z.object({
                id: z.string(),
                orderId: z.string(),
                discountId: z.string(),
                amount: z.number(),
                referenceId: z.string().nullable(),
                referenceName: z.string().nullable(),
                createdAt: z.date().or(z.string()),
                discount: z.object({
                    id: z.string(),
                    name: z.string(),
                    type: z.string(),
                    value: z.number()
                })
            })
        )
        .optional(),
    voidLogs: z
        .array(
            z.object({
                id: z.string(),
                orderId: z.string(),
                reason: z.string(),
                voidedById: z.string(),
                createdAt: z.date().or(z.string()),
                voidedBy: z.object({
                    id: z.string(),
                    username: z.string(),
                    firstName: z.string(),
                    lastName: z.string()
                })
            })
        )
        .optional()
});

export type TOrderResponse = z.infer<typeof OrderResponseSchema>;
