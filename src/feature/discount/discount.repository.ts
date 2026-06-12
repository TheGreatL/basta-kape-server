import { prisma } from '@/lib/prisma';
import { BaseRepository } from '@/repository/base.repository';
import type { TCreateDiscount, TUpdateDiscount } from './discount.types';

export class DiscountRepository extends BaseRepository {
    async createDiscount(data: TCreateDiscount) {
        return prisma.discount.create({
            data: {
                name: data.name,
                type: data.type,
                value: data.value,
                code: data.code ?? null,
                isActive: data.isActive ?? true
            }
        });
    }

    async findDiscountById(id: string) {
        return prisma.discount.findFirst({
            where: { id, deletedAt: null }
        });
    }

    async findDiscountByCode(code: string) {
        return prisma.discount.findFirst({
            where: { code, deletedAt: null }
        });
    }

    async listDiscounts() {
        return prisma.discount.findMany({
            where: { deletedAt: null },
            orderBy: { createdAt: 'desc' }
        });
    }

    async updateDiscount(id: string, data: TUpdateDiscount) {
        return prisma.discount.update({
            where: { id },
            data: {
                name: data.name,
                type: data.type,
                value: data.value,
                code: data.code !== undefined ? data.code : undefined,
                isActive: data.isActive
            }
        });
    }

    async deleteDiscount(id: string) {
        return prisma.discount.update({
            where: { id },
            data: { deletedAt: new Date() }
        });
    }

    async findOrderById(orderId: string) {
        return prisma.order.findUnique({
            where: { id: orderId },
            include: {
                items: true,
                payments: true,
                discounts: {
                    include: {
                        discount: true
                    }
                }
            }
        });
    }

    async applyDiscountToOrder(
        orderId: string,
        discountId: string,
        discountAmount: number,
        taxAmount: number,
        netTotal: number,
        referenceId: string | null,
        referenceName: string | null,
        actorId: string
    ) {
        return prisma.$transaction(async (tx) => {
            // 1. Enforce No-Double-Discounting by removing any existing discounts on this order
            await tx.orderDiscount.deleteMany({
                where: { orderId }
            });

            // 2. Create the new discount link
            const orderDiscount = await tx.orderDiscount.create({
                data: {
                    orderId,
                    discountId,
                    amount: discountAmount,
                    referenceId: referenceId ?? null,
                    referenceName: referenceName ?? null
                },
                include: {
                    discount: true
                }
            });

            // 3. Update the Order table totals
            await tx.order.update({
                where: { id: orderId },
                data: {
                    discountAmount,
                    taxAmount,
                    netTotal
                }
            });

            // 4. Log status history log
            await tx.orderStatusHistory.create({
                data: {
                    orderId,
                    status: 'PENDING', // Keep status same, but record discount update
                    notes: `Applied discount: ${orderDiscount.discount.name} (PHP ${discountAmount.toFixed(2)} off)`,
                    changedById: actorId
                }
            });

            return orderDiscount;
        });
    }

    async removeDiscountFromOrder(orderId: string, taxAmount: number, netTotal: number, actorId: string) {
        return prisma.$transaction(async (tx) => {
            // 1. Delete order discount entries
            await tx.orderDiscount.deleteMany({
                where: { orderId }
            });

            // 2. Reset order table totals
            await tx.order.update({
                where: { id: orderId },
                data: {
                    discountAmount: 0,
                    taxAmount,
                    netTotal
                }
            });

            // 3. Log status history log
            await tx.orderStatusHistory.create({
                data: {
                    orderId,
                    status: 'PENDING',
                    notes: 'Removed all discounts from order',
                    changedById: actorId
                }
            });
        });
    }
}
