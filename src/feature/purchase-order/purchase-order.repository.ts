import { prisma } from '@/lib/prisma';
import { BaseRepository } from '@/repository/base.repository';
import { PurchaseOrderStatus, InventoryStatus, Prisma } from '@prisma/client';
import { TCreatePurchaseOrder } from './purchase-order.types';

export class PurchaseOrderRepository extends BaseRepository {
    async createPurchaseOrder(data: TCreatePurchaseOrder, actorId: string) {
        return prisma.$transaction(async (tx) => {
            // 1. Generate unique PO number (PO-YYYYMMDD-XXXX)
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);

            const countToday = await tx.purchaseOrder.count({
                where: {
                    createdAt: {
                        gte: today,
                        lt: tomorrow
                    }
                }
            });

            const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');
            const sequence = String(countToday + 1).padStart(4, '0');
            const poNumber = `PO-${dateStr}-${sequence}`;

            // 2. Compute total amount of PO
            const totalAmount = data.items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);

            // 3. Create PO record
            return tx.purchaseOrder.create({
                data: {
                    poNumber,
                    status: PurchaseOrderStatus.DRAFT,
                    notes: data.notes,
                    totalAmount,
                    supplierId: data.supplierId,
                    createdById: actorId,
                    items: {
                        create: data.items.map((item) => ({
                            ingredientId: item.ingredientId,
                            quantity: item.quantity,
                            unitCost: item.unitCost,
                            totalCost: item.quantity * item.unitCost
                        }))
                    }
                },
                include: {
                    supplier: true,
                    createdBy: {
                        select: {
                            id: true,
                            username: true,
                            firstName: true,
                            lastName: true
                        }
                    },
                    items: {
                        include: {
                            ingredient: {
                                include: {
                                    defaultUnit: true
                                }
                            }
                        }
                    }
                }
            });
        });
    }

    async getPurchaseOrderById(id: string) {
        return prisma.purchaseOrder.findUnique({
            where: { id, deletedAt: null },
            include: {
                supplier: true,
                createdBy: {
                    select: {
                        id: true,
                        username: true,
                        firstName: true,
                        lastName: true
                    }
                },
                items: {
                    include: {
                        ingredient: {
                            include: {
                                defaultUnit: true
                            }
                        }
                    }
                },
                deliveries: true
            }
        });
    }

    async getPurchaseOrderList(params: {
        page: number;
        limit: number;
        search?: string;
        status?: PurchaseOrderStatus;
        supplierId?: string;
        dateFrom?: string;
        dateTo?: string;
    }) {
        const { page, limit } = params;
        const skip = (page - 1) * limit;

        const where: Prisma.PurchaseOrderWhereInput = { deletedAt: null };

        if (params.status) {
            where.status = params.status;
        }

        if (params.supplierId) {
            where.supplierId = params.supplierId;
        }

        if (params.search) {
            where.poNumber = { contains: params.search };
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
            prisma.purchaseOrder.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    supplier: true,
                    createdBy: {
                        select: {
                            id: true,
                            username: true,
                            firstName: true,
                            lastName: true
                        }
                    },
                    _count: { select: { items: true } }
                }
            }),
            prisma.purchaseOrder.count({ where })
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

    async updatePurchaseOrderStatus(id: string, status: PurchaseOrderStatus, actorId: string) {
        return prisma.$transaction(async (tx) => {
            const po = await tx.purchaseOrder.findUnique({
                where: { id, deletedAt: null },
                include: {
                    items: {
                        include: {
                            ingredient: true
                        }
                    }
                }
            });

            if (!po) {
                throw new Error('Purchase Order not found');
            }

            const updates: Prisma.PurchaseOrderUpdateInput = {
                status,
                updatedAt: new Date()
            };

            if (status === PurchaseOrderStatus.SENT) {
                updates.orderedAt = new Date();
            } else if (status === PurchaseOrderStatus.RECEIVED) {
                updates.receivedAt = new Date();

                // Generate deliveries and increment stock levels
                for (const item of po.items) {
                    // 1. Create delivery batch
                    await tx.ingredientDelivery.create({
                        data: {
                            ingredientId: item.ingredientId,
                            supplierId: po.supplierId,
                            quantityReceived: item.quantity,
                            unitCost: item.unitCost,
                            totalCost: item.totalCost,
                            batchNumber: po.poNumber, // Use PO Number as batch number
                            purchaseOrderId: po.id,
                            createdById: actorId,
                            updatedById: actorId
                        }
                    });

                    // 2. Adjust stock & status
                    let inventory = await tx.ingredientInventory.findFirst({
                        where: { ingredientId: item.ingredientId, deletedAt: null }
                    });

                    if (!inventory) {
                        inventory = await tx.ingredientInventory.create({
                            data: {
                                ingredientId: item.ingredientId,
                                currentQuantity: 0,
                                status: InventoryStatus.OUT_OF_STOCK,
                                createdById: actorId,
                                updatedById: actorId
                            }
                        });
                    }

                    const newQuantity = Math.max(0, inventory.currentQuantity + item.quantity);
                    let newStatus: InventoryStatus = InventoryStatus.SAFE;
                    if (newQuantity <= 0) {
                        newStatus = InventoryStatus.OUT_OF_STOCK;
                    } else if (newQuantity <= item.ingredient.reorderPoint) {
                        newStatus = InventoryStatus.CRITICAL;
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

            return tx.purchaseOrder.update({
                where: { id },
                data: updates,
                include: {
                    supplier: true,
                    createdBy: {
                        select: {
                            id: true,
                            username: true,
                            firstName: true,
                            lastName: true
                        }
                    },
                    items: {
                        include: {
                            ingredient: {
                                include: {
                                    defaultUnit: true
                                }
                            }
                        }
                    }
                }
            });
        });
    }
}
