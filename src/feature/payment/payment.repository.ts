import { prisma } from '@/lib/prisma';
import { BaseRepository } from '@/repository/base.repository';
import { PaymentMethod, PaymentStatus, OrderStatus, Prisma } from '@prisma/client';

export class PaymentRepository extends BaseRepository {
    async findOrderById(orderId: string) {
        return prisma.order.findUnique({
            where: { id: orderId }
        });
    }

    async findPaidPaymentByOrderId(orderId: string) {
        return prisma.orderPayment.findFirst({
            where: {
                orderId,
                paymentStatus: PaymentStatus.PAID
            }
        });
    }

    async findPaymentsByOrderId(orderId: string) {
        return prisma.orderPayment.findMany({
            where: { orderId },
            orderBy: { createdAt: 'desc' }
        });
    }

    async createPayment(
        orderId: string,
        data: {
            paymentMethod: PaymentMethod;
            paymentStatus: PaymentStatus;
            amount: number;
            amountTendered?: number | null;
            amountChange?: number | null;
            gcashReferenceNumber?: string | null;
            paymentProofPhoto?: string | null;
        },
        actorId: string
    ) {
        return prisma.$transaction(async (tx) => {
            const payment = await tx.orderPayment.create({
                data: {
                    orderId,
                    paymentMethod: data.paymentMethod,
                    paymentStatus: data.paymentStatus,
                    amount: data.amount,
                    amountTendered: data.amountTendered ?? null,
                    amountChange: data.amountChange ?? null,
                    gcashReferenceNumber: data.gcashReferenceNumber ?? null,
                    paymentProofPhoto: data.paymentProofPhoto ?? null
                }
            });

            const order = await tx.order.findUnique({
                where: { id: orderId },
                select: { status: true }
            });

            if (order && order.status === OrderStatus.PENDING) {
                await tx.order.update({
                    where: { id: orderId },
                    data: { status: OrderStatus.PREPARING }
                });

                await tx.orderStatusHistory.create({
                    data: {
                        orderId,
                        status: OrderStatus.PREPARING,
                        notes: `Paid via ${data.paymentMethod}. Status updated to PREPARING.`,
                        changedById: actorId
                    }
                });
            }

            return payment;
        });
    }

    async getPaymentList(params: {
        page: number;
        limit: number;
        search?: string;
        paymentMethod?: PaymentMethod;
        paymentStatus?: PaymentStatus;
        dateFrom?: string;
        dateTo?: string;
    }) {
        const { page, limit } = params;
        const skip = (page - 1) * limit;

        const where: Prisma.OrderPaymentWhereInput = {};

        if (params.paymentMethod) {
            where.paymentMethod = params.paymentMethod;
        }

        if (params.paymentStatus) {
            where.paymentStatus = params.paymentStatus;
        }

        if (params.search) {
            where.OR = [
                { gcashReferenceNumber: { contains: params.search } },
                { order: { queueNumber: { contains: params.search } } },
                { order: { customerName: { contains: params.search } } }
            ];
        }

        if (params.dateFrom || params.dateTo) {
            where.createdAt = {};
            if (params.dateFrom) where.createdAt.gte = new Date(params.dateFrom);
            if (params.dateTo) {
                const end = new Date(params.dateTo);
                end.setHours(23, 59, 59, 999);
                where.createdAt.lte = end;
            }
        }

        const [data, total] = await Promise.all([
            prisma.orderPayment.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    order: {
                        select: {
                            id: true,
                            queueNumber: true,
                            customerName: true,
                            netTotal: true,
                            status: true,
                            orderType: true,
                            orderSource: true,
                            cashierSessionId: true
                        }
                    }
                }
            }),
            prisma.orderPayment.count({ where })
        ]);

        const pageCount = Math.ceil(total / limit) || 1;

        return {
            data,
            meta: {
                total,
                page,
                limit,
                pageCount,
                hasMore: page * limit < total
            }
        };
    }

    async updatePaymentReceipt(paymentId: string, data: { paymentProofPhoto?: string; gcashReferenceNumber?: string }, actorId: string) {
        return prisma.$transaction(async (tx) => {
            const payment = await tx.orderPayment.update({
                where: { id: paymentId },
                data: {
                    paymentProofPhoto: data.paymentProofPhoto,
                    gcashReferenceNumber: data.gcashReferenceNumber,
                    paymentStatus: PaymentStatus.PAID
                },
                include: {
                    order: true
                }
            });

            if (payment.order && payment.order.status === OrderStatus.PENDING) {
                await tx.order.update({
                    where: { id: payment.orderId },
                    data: { status: OrderStatus.PREPARING }
                });

                await tx.orderStatusHistory.create({
                    data: {
                        orderId: payment.orderId,
                        status: OrderStatus.PREPARING,
                        notes: `Digital payment proof uploaded. Status updated to PREPARING.`,
                        changedById: actorId
                    }
                });
            }

            return payment;
        });
    }
}
