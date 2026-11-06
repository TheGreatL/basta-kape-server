import { z } from 'zod';
import { OrderPaymentResponseSchema, PaymentStatusEnum } from '@/feature/payment/payment.types';

export const OrderStatusEnum = z.enum(['PENDING', 'APPROVED', 'PREPARING', 'READY', 'DISPATCHED', 'COMPLETED', 'CANCELLED']);
export type TOrderStatus = z.infer<typeof OrderStatusEnum>;

export const OrderTypeEnum = z.enum(['DINE_IN', 'TAKE_OUT', 'DELIVERY']);
export type TOrderType = z.infer<typeof OrderTypeEnum>;

export const OrderSourceEnum = z.enum(['POS', 'WEBSITE']);
export type TOrderSource = z.infer<typeof OrderSourceEnum>;

export const RiderVehicleEnum = z.enum(['Bike', 'Motorcycle', 'Car', 'Other Transportation Service']);
export type TRiderVehicle = z.infer<typeof RiderVehicleEnum>;

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
        buzzerId: z.string().max(50).optional().nullable(),
        riderName: z.string().max(100).optional().nullable(),
        riderPlate: z.string().max(50).optional().nullable(),
        riderVehicle: RiderVehicleEnum.optional().nullable(),
        trackingLink: z.string().max(1000).optional().nullable(),
        paymentMethod: z.enum(['CASH', 'GCASH']).optional().nullable(),
        paymentReferenceNumber: z.string().max(100).optional().nullable(),
        paymentProofPhoto: z.string().max(1000).optional().nullable(),
        items: z.array(CreateOrderItemSchema).min(1, 'Order must contain at least one item')
    })
    .superRefine((data, ctx) => {
        if (data.orderType === 'DELIVERY') {
            if (data.orderSource === 'POS') {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'Delivery order type is only available for customer orders',
                    path: ['orderType']
                });
            }
            if (data.paymentMethod !== 'GCASH') {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'Only GCash payment is available for delivery orders',
                    path: ['paymentMethod']
                });
            }
        }

        if (data.paymentMethod === 'GCASH') {
            if (!data.paymentReferenceNumber || !data.paymentReferenceNumber.trim()) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'GCash reference number is required for GCash payments',
                    path: ['paymentReferenceNumber']
                });
            } else if (!/^\d{13}$/.test(data.paymentReferenceNumber.trim())) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'GCash reference number must be exactly 13 digits',
                    path: ['paymentReferenceNumber']
                });
            }
            if (data.orderSource === 'WEBSITE') {
                if (!data.paymentProofPhoto || !data.paymentProofPhoto.trim()) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: 'Payment proof photo is required for GCash payments from customer sources',
                        path: ['paymentProofPhoto']
                    });
                }
            }
        }
    });

export type TCreateOrder = z.infer<typeof CreateOrderSchema>;

export const UpdateOrderCourierSchema = z.object({
    riderName: z.string().trim().min(1, 'Rider name is required').max(100),
    riderPlate: z.string().trim().min(1, 'Plate number is required').max(50),
    riderVehicle: RiderVehicleEnum,
    trackingLink: z.string().trim().url('Please enter a valid tracking link URL').max(1000)
});

export type TUpdateOrderCourier = z.infer<typeof UpdateOrderCourierSchema>;

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
    referenceNumber: z.string().optional(),
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
    riderName: z.string().nullable().optional(),
    riderPlate: z.string().nullable().optional(),
    riderVehicle: z.string().nullable().optional(),
    trackingLink: z.string().nullable().optional(),
    paymentStatus: PaymentStatusEnum,
    totalPaid: z.number(),
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
