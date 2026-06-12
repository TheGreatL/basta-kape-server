import { prisma } from '@/lib/prisma';
import { BaseRepository } from '@/repository/base.repository';
import { PaymentMethod, PaymentStatus, OrderStatus } from '@prisma/client';

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
}
