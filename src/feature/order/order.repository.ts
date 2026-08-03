import { prisma } from '@/lib/prisma';
import { BaseRepository } from '@/repository/base.repository';
import { Prisma, OrderStatus, OrderType, OrderSource, PaymentMethod } from '@prisma/client';
import type { TGetOrderListQuery } from './order.types';
import type { IPaginatedResult } from '@/types/base.types';
import { formatOrderWithReference, formatOrdersWithReference } from './order.utils';
import { InventoryRepository } from '@/feature/inventory/inventory.repository';
import { BadRequestException } from '@/exceptions';

type TCreateOrderRepoData = {
    queueNumber: string;
    buzzerId?: string | null;
    orderType: OrderType;
    orderSource: OrderSource;
    notes?: string | null;
    subtotal: number;
    taxAmount: number;
    netTotal: number;
    customerId?: string | null;
    customerName?: string | null;
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
        paymentReferenceNumber?: string | null;
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
        const createdOrder = await prisma.$transaction(async (tx) => {
            const inventoryRepo = new InventoryRepository();

            // 1. Calculate required ingredient stock for order items
            const ingredientRequirements = await this.calculateIngredientRequirements(tx, data.items);

            // 2. Check stock sufficiency before creating the order
            if (ingredientRequirements.size > 0) {
                const check = await inventoryRepo.checkIngredientStockAvailability(tx, ingredientRequirements);
                if (!check.sufficient) {
                    const details = check.insufficientIngredients
                        .map((i) => `${i.ingredientName} (Required: ${i.required}${i.unit}, Available: ${i.available}${i.unit})`)
                        .join(', ');
                    throw new BadRequestException(`Insufficient stock to complete order: ${details}`);
                }
            }

            // 3. Create the order in database
            const order = await tx.order.create({
                data: {
                    queueNumber: data.queueNumber,
                    buzzerId: data.buzzerId ?? null,
                    orderType: data.orderType,
                    orderSource: data.orderSource,
                    notes: data.notes ?? null,
                    subtotal: data.subtotal,
                    taxAmount: data.taxAmount,
                    netTotal: data.netTotal,
                    customerId: data.customerId ?? null,
                    customerName: data.customerName ?? null,
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
                        amount: data.netTotal,
                        paymentReferenceNumber: data.paymentDetails.paymentReferenceNumber ?? null,
                        paymentProofPhoto: data.paymentDetails.paymentProofPhoto ?? null
                    }
                });
            }

            // 4. Deduct ingredient stock immediately upon order creation (holding stock)
            for (const [ingredientId, quantity] of ingredientRequirements.entries()) {
                await inventoryRepo.deductIngredientStockFEFO(
                    tx,
                    ingredientId,
                    quantity,
                    'SALE',
                    `Order stock reservation for Order ${data.queueNumber}`,
                    data.actorId
                );
            }

            return order;
        });

        return formatOrderWithReference(createdOrder);
    }

    async getOrderById(id: string) {
        const order = await prisma.order.findUnique({
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
        return order ? formatOrderWithReference(order) : null;
    }

    async getOrderList(params: TGetOrderListQuery): Promise<IPaginatedResult<unknown>> {
        const { skip, take, page } = this.normalizePagination(params);
        const where: Prisma.OrderWhereInput = {};

        if (params.status) where.status = params.status;
        if (params.orderType) where.orderType = params.orderType;
        if (params.orderSource) where.orderSource = params.orderSource;

        if (params.search) {
            const refMatch = params.search.match(/^(\d{6}|\d{8})-(\d+)$/);
            if (refMatch) {
                const datePart = refMatch[1];
                const queuePart = refMatch[2];

                const yearStr = datePart.length === 6 ? datePart.slice(0, 2) : datePart.slice(0, 4);
                const monthStr = datePart.length === 6 ? datePart.slice(2, 4) : datePart.slice(4, 6);
                const dayStr = datePart.length === 6 ? datePart.slice(4, 6) : datePart.slice(6, 8);

                const yearNum = parseInt(datePart.length === 6 ? '20' + yearStr : yearStr, 10);
                const monthNum = parseInt(monthStr, 10) - 1;
                const dayNum = parseInt(dayStr, 10);

                const startOfDay = new Date(yearNum, monthNum, dayNum, 0, 0, 0, 0);
                const endOfDay = new Date(yearNum, monthNum, dayNum, 23, 59, 59, 999);

                where.createdAt = {
                    gte: startOfDay,
                    lte: endOfDay
                };
                where.queueNumber = `#${queuePart.padStart(3, '0')}`;
            } else {
                const searchLower = params.search.toLowerCase();
                where.OR = [
                    { id: { startsWith: searchLower } },
                    { queueNumber: { contains: params.search } },
                    { customerName: { contains: params.search } },
                    { notes: { contains: params.search } }
                ];
            }
        }

        const [data, totalRows] = await Promise.all([
            prisma.order.findMany({
                where,
                skip,
                take,
                orderBy: { createdAt: 'desc' },
                include: {
                    payments: true,
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

        const formattedData = formatOrdersWithReference(data);
        return this.formatPaginatedResult(formattedData, totalRows, page, take);
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

            const inventoryRepo = new InventoryRepository();

            // Handle Order Cancellation: Restore Stock
            if (currentOrder.status !== OrderStatus.CANCELLED && status === OrderStatus.CANCELLED) {
                await this.restoreInventoryForOrder(tx, order, actorId);
            }

            // Handle Re-opening a Cancelled Order: Re-check & Deduct Stock
            if (currentOrder.status === OrderStatus.CANCELLED && status !== OrderStatus.CANCELLED) {
                const ingredientRequirements = await this.calculateIngredientRequirements(tx, order.items);
                if (ingredientRequirements.size > 0) {
                    const check = await inventoryRepo.checkIngredientStockAvailability(tx, ingredientRequirements);
                    if (!check.sufficient) {
                        const details = check.insufficientIngredients
                            .map((i) => `${i.ingredientName} (Required: ${i.required}${i.unit}, Available: ${i.available}${i.unit})`)
                            .join(', ');
                        throw new BadRequestException(`Cannot re-open order due to insufficient stock: ${details}`);
                    }

                    for (const [ingredientId, quantity] of ingredientRequirements.entries()) {
                        await inventoryRepo.deductIngredientStockFEFO(
                            tx,
                            ingredientId,
                            quantity,
                            'SALE',
                            `Stock re-deducted for un-cancelled Order ${order.queueNumber}`,
                            actorId
                        );
                    }
                }
            }

            return order;
        });
    }

    private async calculateIngredientRequirements(
        tx: Prisma.TransactionClient,
        items: {
            productVariantId: string;
            quantity: number;
            modifiers?: { modifierOptionId: string }[];
        }[]
    ): Promise<Map<string, number>> {
        const variantIds = [...new Set(items.map((item) => item.productVariantId))];
        const modifierOptionIds = [...new Set(items.flatMap((item) => item.modifiers?.map((m) => m.modifierOptionId) ?? []))];

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

        const ingredientRequirements = new Map<string, number>();

        const accumulateRequirement = (ingredientId: string, quantity: number) => {
            ingredientRequirements.set(ingredientId, (ingredientRequirements.get(ingredientId) ?? 0) + quantity);
        };

        for (const item of items) {
            const variantRecipe = variantRecipes.find((recipe) => recipe.productVariantId === item.productVariantId);
            if (variantRecipe) {
                for (const ingredient of variantRecipe.ingredients) {
                    accumulateRequirement(ingredient.ingredientId, ingredient.quantity * item.quantity);
                }
            }

            if (item.modifiers) {
                for (const itemMod of item.modifiers) {
                    const modifierRecipe = modifierRecipes.find((recipe) => recipe.modifierOptionId === itemMod.modifierOptionId);
                    if (modifierRecipe) {
                        for (const ingredient of modifierRecipe.ingredients) {
                            accumulateRequirement(ingredient.ingredientId, ingredient.quantity * item.quantity);
                        }
                    }
                }
            }
        }

        return ingredientRequirements;
    }

    private async restoreInventoryForOrder(
        tx: Prisma.TransactionClient,
        order: Prisma.OrderGetPayload<{ include: { items: { include: { modifiers: true } } } }>,
        actorId: string
    ) {
        const ingredientRequirements = await this.calculateIngredientRequirements(tx, order.items);
        if (ingredientRequirements.size === 0) {
            return;
        }

        const inventoryRepo = new InventoryRepository();

        for (const [ingredientId, quantity] of ingredientRequirements.entries()) {
            await inventoryRepo.addIngredientStockLatest(
                tx,
                ingredientId,
                quantity,
                'PHYSICAL_COUNT_CORRECTION',
                `Stock returned for cancelled Order ${order.queueNumber}`,
                actorId
            );
        }
    }
}
