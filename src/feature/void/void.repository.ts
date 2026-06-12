import { prisma } from '@/lib/prisma';
import { BaseRepository } from '@/repository/base.repository';

export class VoidRepository extends BaseRepository {
    async findOrderById(orderId: string) {
        return prisma.order.findUnique({
            where: { id: orderId }
        });
    }

    async findUserWithRoles(userId: string) {
        return prisma.user.findUnique({
            where: { id: userId },
            include: {
                userRoles: {
                    include: {
                        role: true
                    }
                }
            }
        });
    }

    async createVoidLog(orderId: string, reason: string, voidedById: string) {
        return prisma.$transaction(async (tx) => {
            // 1. Create the OrderVoidLog record
            const voidLog = await tx.orderVoidLog.create({
                data: {
                    orderId,
                    reason,
                    voidedById
                },
                include: {
                    voidedBy: {
                        select: {
                            id: true,
                            username: true,
                            firstName: true,
                            lastName: true
                        }
                    },
                    order: {
                        select: {
                            id: true,
                            queueNumber: true,
                            customerName: true,
                            netTotal: true
                        }
                    }
                }
            });

            // 2. Update the Order status to CANCELLED
            await tx.order.update({
                where: { id: orderId },
                data: {
                    status: 'CANCELLED'
                }
            });

            // 3. Create OrderStatusHistory status log noting order was voided
            await tx.orderStatusHistory.create({
                data: {
                    orderId,
                    status: 'CANCELLED',
                    notes: `Order voided: ${reason}`,
                    changedById: voidedById
                }
            });

            return voidLog;
        });
    }

    async listVoidLogs() {
        return prisma.orderVoidLog.findMany({
            include: {
                voidedBy: {
                    select: {
                        id: true,
                        username: true,
                        firstName: true,
                        lastName: true
                    }
                },
                order: {
                    select: {
                        id: true,
                        queueNumber: true,
                        customerName: true,
                        netTotal: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
    }
}
