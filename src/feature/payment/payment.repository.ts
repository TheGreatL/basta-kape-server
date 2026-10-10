import { prisma } from '@/lib/prisma';
import { BaseRepository } from '@/repository/base.repository';
import { PaymentMethod, PaymentStatus, OrderStatus, Prisma } from '@prisma/client';
import { parseLocalStartDate, parseLocalEndDate } from '@/utils/date.utils';

export class PaymentRepository extends BaseRepository {
    async findOrderById(orderId: string) {
        return prisma.order.findUnique({
            where: { id: orderId }
        });
    }

    async findPaidPaymentByOrderId(orderId: string) {
        const order = await prisma.order.findUnique({
            where: { id: orderId }
        });
        if (order?.paymentStatus === PaymentStatus.PAID) {
            return prisma.orderPayment.findFirst({
                where: { orderId }
            });
        }
        return null;
    }

    async findPaymentsByOrderId(orderId: string) {
        const payments = await prisma.orderPayment.findMany({
            where: { orderId },
            include: { order: { select: { paymentStatus: true } } },
            orderBy: { createdAt: 'desc' }
        });
        return payments.map((p) => ({
            ...p,
            paymentStatus: p.order.paymentStatus
        }));
    }

    async createPayment(
        orderId: string,
        data: {
            paymentMethod: PaymentMethod;
            paymentStatus: PaymentStatus;
            amount: number;
            amountTendered?: number | null;
            amountChange?: number | null;
            paymentReferenceNumber?: string | null;
            paymentProofPhoto?: string | null;
        },
        actorId: string
    ) {
        return prisma.$transaction(async (tx) => {
            const payment = await tx.orderPayment.create({
                data: {
                    orderId,
                    paymentMethod: data.paymentMethod,
                    amount: data.amount,
                    amountTendered: data.amountTendered ?? null,
                    amountChange: data.amountChange ?? null,
                    paymentReferenceNumber: data.paymentReferenceNumber ?? null,
                    paymentProofPhoto: data.paymentProofPhoto ?? null
                }
            });

            await tx.order.update({
                where: { id: orderId },
                data: {
                    paymentStatus: data.paymentStatus,
                    totalPaid: { increment: data.amount }
                }
            });

            const order = await tx.order.findUnique({
                where: { id: orderId },
                select: { status: true }
            });

            if (order && order.status === OrderStatus.PENDING) {
                await tx.order.update({
                    where: { id: orderId },
                    data: { status: OrderStatus.APPROVED }
                });

                await tx.orderStatusHistory.create({
                    data: {
                        orderId,
                        status: OrderStatus.APPROVED,
                        notes: `Paid via ${data.paymentMethod}. Status updated to APPROVED.`,
                        changedById: actorId
                    }
                });
            }

            return {
                ...payment,
                paymentStatus: data.paymentStatus
            };
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
            where.order = {
                paymentStatus: params.paymentStatus
            };
        }

        if (params.search) {
            where.OR = [
                { paymentReferenceNumber: { contains: params.search } },
                { order: { queueNumber: { contains: params.search } } },
                { order: { customerName: { contains: params.search } } }
            ];
        }

        if (params.dateFrom || params.dateTo) {
            where.createdAt = {};
            if (params.dateFrom) where.createdAt.gte = parseLocalStartDate(params.dateFrom);
            if (params.dateTo) where.createdAt.lte = parseLocalEndDate(params.dateTo);
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
                            paymentStatus: true
                        }
                    }
                }
            }),
            prisma.orderPayment.count({ where })
        ]);

        const pageCount = Math.ceil(total / limit) || 1;

        const mappedData = data.map((p) => ({
            ...p,
            paymentStatus: p.order.paymentStatus
        }));

        return {
            data: mappedData,
            meta: {
                total,
                page,
                limit,
                pageCount,
                hasMore: page * limit < total
            }
        };
    }

    async updatePaymentReceipt(paymentId: string, data: { paymentProofPhoto?: string; paymentReferenceNumber?: string }, actorId: string) {
        return prisma.$transaction(async (tx) => {
            const payment = await tx.orderPayment.update({
                where: { id: paymentId },
                data: {
                    paymentProofPhoto: data.paymentProofPhoto,
                    paymentReferenceNumber: data.paymentReferenceNumber
                },
                include: {
                    order: true
                }
            });

            await tx.order.update({
                where: { id: payment.orderId },
                data: {
                    paymentStatus: PaymentStatus.PAID,
                    totalPaid: { increment: payment.amount }
                }
            });

            if (payment.order && payment.order.status === OrderStatus.PENDING) {
                await tx.order.update({
                    where: { id: payment.orderId },
                    data: { status: OrderStatus.APPROVED }
                });

                await tx.orderStatusHistory.create({
                    data: {
                        orderId: payment.orderId,
                        status: OrderStatus.APPROVED,
                        notes: `Digital payment proof uploaded. Status updated to APPROVED.`,
                        changedById: actorId
                    }
                });
            }

            return {
                ...payment,
                paymentStatus: PaymentStatus.PAID
            };
        });
    }
}
