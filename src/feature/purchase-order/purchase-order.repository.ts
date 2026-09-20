import { prisma } from '@/lib/prisma';
import { BaseRepository } from '@/repository/base.repository';
import { PurchaseOrderStatus, InventoryStatus, Prisma } from '@prisma/client';
import { TCreatePurchaseOrder, TUpdatePurchaseOrder } from './purchase-order.types';

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
            const totalAmount = data.items.reduce((sum, item) => sum + item.quantity * (item.unitCost ?? 0), 0);

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
                        create: data.items.map((item) => {
                            const unitCost = item.unitCost ?? 0;
                            return {
                                ingredientId: item.ingredientId,
                                quantity: item.quantity,
                                unitCost,
                                totalCost: item.quantity * unitCost
                            };
                        })
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
                batches: true
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

    async updatePurchaseOrderStatus(
        id: string,
        status: PurchaseOrderStatus,
        actorId: string,
        itemsPayload?: { ingredientId: string; unitCost?: number }[]
    ) {
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

                const ingredientIds = po.items.map((item) => item.ingredientId);
                const inventories = await tx.ingredientInventory.findMany({
                    where: { ingredientId: { in: ingredientIds }, deletedAt: null }
                });
                const inventoryByIngredient = new Map(inventories.map((inventory) => [inventory.ingredientId, inventory]));

                // Look up supplier ingredient catalog prices
                const supplierIngredients = await tx.supplierIngredient.findMany({
                    where: {
                        supplierId: po.supplierId,
                        ingredientId: { in: ingredientIds }
                    }
                });
                const supplierPriceMap = new Map(supplierIngredients.map((si) => [si.ingredientId, si.unitCost ?? 0]));

                let computedTotalAmount = 0;

                // Generate deliveries and increment stock levels
                for (const item of po.items) {
                    // Resolve unitCost:
                    // 1. Explicitly passed in itemsPayload (if provided)
                    // 2. From supplier catalog (SupplierIngredient)
                    // 3. Fallback to existing item.unitCost or 0
                    const customPrice = itemsPayload?.find((p) => p.ingredientId === item.ingredientId);
                    const unitCost =
                        customPrice?.unitCost !== undefined ? customPrice.unitCost : (supplierPriceMap.get(item.ingredientId) ?? item.unitCost ?? 0);
                    const totalCost = item.quantity * unitCost;

                    computedTotalAmount += totalCost;

                    // Update PurchaseOrderItem with resolved pricing
                    await tx.purchaseOrderItem.update({
                        where: { id: item.id },
                        data: {
                            unitCost,
                            totalCost
                        }
                    });

                    // 1. Create batch
                    const batch = await tx.ingredientBatch.create({
                        data: {
                            ingredientId: item.ingredientId,
                            supplierId: po.supplierId,
                            quantityReceived: item.quantity,
                            currentQuantity: item.quantity,
                            unitCost,
                            totalCost,
                            batchNumber: po.poNumber, // Use PO Number as batch number
                            purchaseOrderId: po.id,
                            createdById: actorId,
                            updatedById: actorId
                        }
                    });

                    // Log stock transaction
                    await tx.stockTransaction.create({
                        data: {
                            batchId: batch.id,
                            quantityChange: item.quantity,
                            type: 'DELIVERY',
                            reason: `Received from Purchase Order ${po.poNumber}`,
                            createdById: actorId
                        }
                    });

                    // 2. Adjust stock & status
                    let inventory = inventoryByIngredient.get(item.ingredientId);

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
                        inventoryByIngredient.set(item.ingredientId, inventory);
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

                updates.totalAmount = computedTotalAmount;
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

    async updatePurchaseOrder(id: string, data: TUpdatePurchaseOrder) {
        return prisma.$transaction(async (tx) => {
            const updates: Prisma.PurchaseOrderUpdateInput = {
                updatedAt: new Date()
            };

            if (data.notes !== undefined) {
                updates.notes = data.notes;
            }

            if (data.supplierId) {
                updates.supplier = { connect: { id: data.supplierId } };
            }

            if (data.items) {
                // Compute new total amount
                const totalAmount = data.items.reduce((sum, item) => sum + item.quantity * (item.unitCost ?? 0), 0);
                updates.totalAmount = totalAmount;

                // Delete existing items
                await tx.purchaseOrderItem.deleteMany({
                    where: { purchaseOrderId: id }
                });

                // Recreate items
                updates.items = {
                    create: data.items.map((item) => {
                        const unitCost = item.unitCost ?? 0;
                        return {
                            ingredientId: item.ingredientId,
                            quantity: item.quantity,
                            unitCost,
                            totalCost: item.quantity * unitCost
                        };
                    })
                };
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
