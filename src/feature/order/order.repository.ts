import { prisma } from '@/lib/prisma';
import { BaseRepository } from '@/repository/base.repository';
import { Prisma, OrderStatus, OrderType, OrderSource } from '@prisma/client';
import type { TGetOrderListQuery } from './order.types';
import type { IPaginatedResult } from '@/types/base.types';

type TCreateOrderRepoData = {
    queueNumber: string;
    orderType: OrderType;
    orderSource: OrderSource;
    notes?: string | null;
    subtotal: number;
    taxAmount: number;
    netTotal: number;
    customerId?: string | null;
    customerName?: string | null;
    cashierSessionId?: string | null;
    actorId: string;
    items: {
        productVariantId: string;
        quantity: number;
        unitPrice: number;
        totalPrice: number;
        notes?: string | null;
        modifiers?: {
            modifierOptionId: string;
            price: number;
        }[];
    }[];
};

export class OrderRepository extends BaseRepository {
    async getOrdersCountToday(): Promise<number> {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(startOfDay);
        endOfDay.setDate(endOfDay.getDate() + 1);

        return prisma.order.count({
            where: {
                createdAt: {
                    gte: startOfDay,
                    lt: endOfDay
                }
            }
        });
    }

    async createOrder(data: TCreateOrderRepoData) {
        return prisma.$transaction(async (tx) => {
            const order = await tx.order.create({
                data: {
                    queueNumber: data.queueNumber,
                    orderType: data.orderType,
                    orderSource: data.orderSource,
                    notes: data.notes ?? null,
                    subtotal: data.subtotal,
                    taxAmount: data.taxAmount,
                    netTotal: data.netTotal,
                    customerId: data.customerId ?? null,
                    customerName: data.customerName ?? null,
                    cashierSessionId: data.cashierSessionId ?? null,
                    items: {
                        create: data.items.map((item) => ({
                            productVariantId: item.productVariantId,
                            quantity: item.quantity,
                            unitPrice: item.unitPrice,
                            totalPrice: item.totalPrice,
                            notes: item.notes ?? null,
                            modifiers: item.modifiers
                                ? {
                                      create: item.modifiers.map((m) => ({
                                          modifierOptionId: m.modifierOptionId,
                                          price: m.price
                                      }))
                                  }
                                : undefined
                        }))
                    }
                },
                include: {
                    items: {
                        include: {
                            modifiers: true
                        }
                    }
                }
            });

            await tx.orderStatusHistory.create({
                data: {
                    orderId: order.id,
                    status: OrderStatus.PENDING,
                    notes: 'Order placed',
                    changedById: data.actorId
                }
            });

            return order;
        });
    }

    async getOrderById(id: string) {
        return prisma.order.findUnique({
            where: { id },
            include: {
                items: {
                    include: {
                        variant: {
                            include: {
                                product: true
                            }
                        },
                        modifiers: {
                            include: {
                                modifierOption: {
                                    select: {
                                        name: true
                                    }
                                }
                            }
                        }
                    }
                },
                statusHistory: {
                    include: {
                        changedBy: {
                            select: {
                                username: true,
                                firstName: true,
                                lastName: true
                            }
                        }
                    },
                    orderBy: { createdAt: 'asc' }
                },
                payments: true
            }
        });
    }

    async getOrderList(params: TGetOrderListQuery): Promise<IPaginatedResult<unknown>> {
        const { skip, take, page } = this.normalizePagination(params);
        const where: Prisma.OrderWhereInput = {};

        if (params.status) where.status = params.status;
        if (params.orderType) where.orderType = params.orderType;
        if (params.orderSource) where.orderSource = params.orderSource;

        if (params.search) {
            where.OR = [
                { queueNumber: { contains: params.search } },
                { customerName: { contains: params.search } },
                { notes: { contains: params.search } }
            ];
        }

        const [data, totalRows] = await Promise.all([
            prisma.order.findMany({
                where,
                skip,
                take,
                orderBy: { createdAt: 'desc' },
                include: {
                    items: {
                        include: {
                            variant: {
                                include: {
                                    product: true
                                }
                            },
                            modifiers: {
                                include: {
                                    modifierOption: {
                                        select: {
                                            name: true
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }),
            prisma.order.count({ where })
        ]);

        return this.formatPaginatedResult(data, totalRows, page, take);
    }

    async updateOrderStatus(orderId: string, status: OrderStatus, notes: string | null, actorId: string) {
        return prisma.$transaction(async (tx) => {
            const currentOrder = await tx.order.findUnique({
                where: { id: orderId },
                select: { status: true }
            });

            if (!currentOrder) {
                throw new Error('Order not found');
            }

            const order = await tx.order.update({
                where: { id: orderId },
                data: { status },
                include: {
                    items: {
                        include: {
                            modifiers: true
                        }
                    }
                }
            });

            await tx.orderStatusHistory.create({
                data: {
                    orderId,
                    status,
                    notes: notes ?? `Status changed to ${status}`,
                    changedById: actorId
                }
            });

            if (currentOrder.status !== OrderStatus.COMPLETED && status === OrderStatus.COMPLETED) {
                await this.deductInventoryForOrder(tx, order, actorId);
            }

            return order;
        });
    }

    private async deductInventoryForOrder(
        tx: Prisma.TransactionClient,
        order: Prisma.OrderGetPayload<{ include: { items: { include: { modifiers: true } } } }>,
        actorId: string
    ) {
        for (const item of order.items) {
            // 1. Variant recipe ingredients
            const variantRecipe = await tx.recipe.findFirst({
                where: { productVariantId: item.productVariantId, deletedAt: null },
                include: {
                    ingredients: {
                        where: { deletedAt: null }
                    }
                }
            });

            if (variantRecipe) {
                for (const ri of variantRecipe.ingredients) {
                    const deduction = ri.quantity * item.quantity;
                    await this.adjustStockAndStatusInTx(tx, ri.ingredientId, -deduction, actorId);
                }
            }

            // 2. Selected modifiers recipes ingredients
            for (const itemMod of item.modifiers) {
                const modRecipe = await tx.recipe.findFirst({
                    where: { modifierOptionId: itemMod.modifierOptionId, deletedAt: null },
                    include: {
                        ingredients: {
                            where: { deletedAt: null }
                        }
                    }
                });

                if (modRecipe) {
                    for (const ri of modRecipe.ingredients) {
                        const deduction = ri.quantity * item.quantity;
                        await this.adjustStockAndStatusInTx(tx, ri.ingredientId, -deduction, actorId);
                    }
                }
            }
        }
    }

    private async adjustStockAndStatusInTx(tx: Prisma.TransactionClient, ingredientId: string, quantityDiff: number, actorId: string) {
        const ingredient = await tx.ingredient.findFirst({
            where: { id: ingredientId, deletedAt: null }
        });
        if (!ingredient) return;

        let inventory = await tx.ingredientInventory.findFirst({
            where: { ingredientId, deletedAt: null }
        });

        if (!inventory) {
            inventory = await tx.ingredientInventory.create({
                data: {
                    ingredientId,
                    currentQuantity: 0,
                    status: 'OUT_OF_STOCK',
                    createdById: actorId,
                    updatedById: actorId
                }
            });
        }

        let newQuantity = inventory.currentQuantity + quantityDiff;
        if (newQuantity < 0) {
            newQuantity = 0;
        }

        let newStatus: 'SAFE' | 'CRITICAL' | 'OUT_OF_STOCK' = 'SAFE';
        if (newQuantity <= 0) {
            newStatus = 'OUT_OF_STOCK';
        } else if (newQuantity <= ingredient.reorderPoint) {
            newStatus = 'CRITICAL';
        }

        await tx.ingredientInventory.update({
            where: { id: inventory.id },
            data: {
                currentQuantity: newQuantity,
                status: newStatus,
                updatedById: actorId
            }
        });
    }
}
