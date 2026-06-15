import { prisma } from '@/lib/prisma';
import { BaseRepository } from '@/repository/base.repository';
import { Prisma, OrderStatus, OrderType, OrderSource, PaymentMethod, PaymentStatus } from '@prisma/client';
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
    paymentDetails?: {
        paymentMethod: PaymentMethod;
        gcashReferenceNumber?: string | null;
        paymentProofPhoto?: string | null;
    } | null;
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

            if (data.paymentDetails) {
                await tx.orderPayment.create({
                    data: {
                        orderId: order.id,
                        paymentMethod: data.paymentDetails.paymentMethod,
                        paymentStatus: PaymentStatus.PENDING,
                        amount: data.netTotal,
                        gcashReferenceNumber: data.paymentDetails.gcashReferenceNumber ?? null,
                        paymentProofPhoto: data.paymentDetails.paymentProofPhoto ?? null
                    }
                });
            }

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
                payments: true,
                discounts: {
                    include: {
                        discount: true
                    }
                },
                voidLogs: {
                    include: {
                        voidedBy: {
                            select: {
                                id: true,
                                username: true,
                                firstName: true,
                                lastName: true
                            }
                        }
                    }
                }
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
        const variantIds = [...new Set(order.items.map((item) => item.productVariantId))];
        const modifierOptionIds = [...new Set(order.items.flatMap((item) => item.modifiers.map((modifier) => modifier.modifierOptionId)))];

        const [variantRecipes, modifierRecipes] = await Promise.all([
            tx.recipe.findMany({
                where: { productVariantId: { in: variantIds }, deletedAt: null },
                include: {
                    ingredients: {
                        where: { deletedAt: null }
                    }
                }
            }),
            modifierOptionIds.length > 0
                ? tx.recipe.findMany({
                      where: { modifierOptionId: { in: modifierOptionIds }, deletedAt: null },
                      include: {
                          ingredients: {
                              where: { deletedAt: null }
                          }
                      }
                  })
                : Promise.resolve([])
        ]);

        const ingredientDeductions = new Map<string, number>();

        const accumulateDeduction = (ingredientId: string, quantity: number) => {
            ingredientDeductions.set(ingredientId, (ingredientDeductions.get(ingredientId) ?? 0) + quantity);
        };

        for (const item of order.items) {
            const variantRecipe = variantRecipes.find((recipe) => recipe.productVariantId === item.productVariantId);
            if (variantRecipe) {
                for (const ingredient of variantRecipe.ingredients) {
                    accumulateDeduction(ingredient.ingredientId, ingredient.quantity * item.quantity);
                }
            }

            for (const itemMod of item.modifiers) {
                const modifierRecipe = modifierRecipes.find((recipe) => recipe.modifierOptionId === itemMod.modifierOptionId);
                if (modifierRecipe) {
                    for (const ingredient of modifierRecipe.ingredients) {
                        accumulateDeduction(ingredient.ingredientId, ingredient.quantity * item.quantity);
                    }
                }
            }
        }

        if (ingredientDeductions.size === 0) {
            return;
        }

        const ingredientIds = Array.from(ingredientDeductions.keys());
        const [ingredients, inventories] = await Promise.all([
            tx.ingredient.findMany({
                where: { id: { in: ingredientIds }, deletedAt: null }
            }),
            tx.ingredientInventory.findMany({
                where: { ingredientId: { in: ingredientIds }, deletedAt: null }
            })
        ]);

        const inventoryByIngredientId = new Map(inventories.map((inventory) => [inventory.ingredientId, inventory]));

        for (const [ingredientId, deductionQuantity] of ingredientDeductions.entries()) {
            const ingredient = ingredients.find((item) => item.id === ingredientId);
            if (!ingredient) {
                continue;
            }

            let inventory = inventoryByIngredientId.get(ingredientId);
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

            const newQuantity = Math.max(0, inventory.currentQuantity - deductionQuantity);
            const newStatus = newQuantity <= 0 ? 'OUT_OF_STOCK' : newQuantity <= ingredient.reorderPoint ? 'CRITICAL' : 'SAFE';

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
}
