import { prisma } from '@/lib/prisma';
import { BaseRepository } from '@/repository/base.repository';
import { PurchaseOrderStatus, InventoryStatus, Prisma } from '@prisma/client';
import { TCreatePurchaseOrder, TUpdatePurchaseOrder, TUpdatePurchaseOrderStatus } from './purchase-order.types';

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
                batches: {
                    where: { deletedAt: null },
                    include: {
                        ingredient: {
                            include: {
                                defaultUnit: true
                            }
                        },
                        createdBy: {
                            select: {
                                id: true,
                                username: true,
                                firstName: true,
                                lastName: true
                            }
                        }
                    },
                    orderBy: { receivedAt: 'desc' }
                }
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

    async updatePurchaseOrderStatus(id: string, status: PurchaseOrderStatus, actorId: string, options?: TUpdatePurchaseOrderStatus) {
        return prisma.$transaction(async (tx) => {
            const po = await tx.purchaseOrder.findUnique({
                where: { id, deletedAt: null },
                include: {
                    items: {
                        include: {
                            ingredient: true
                        }
                    },
                    batches: {
                        where: { deletedAt: null }
                    }
                }
            });

            if (!po) {
                throw new Error('Purchase Order not found');
            }

            const updates: Prisma.PurchaseOrderUpdateInput = {
                updatedAt: new Date()
            };

            if (status === PurchaseOrderStatus.DRAFT) {
                updates.status = PurchaseOrderStatus.DRAFT;
            } else if (status === PurchaseOrderStatus.FINAL_DRAFT) {
                updates.status = PurchaseOrderStatus.FINAL_DRAFT;
            } else if (status === PurchaseOrderStatus.SENT) {
                updates.status = PurchaseOrderStatus.SENT;
                updates.orderedAt = new Date();
            } else if (status === PurchaseOrderStatus.CANCELLED) {
                updates.status = PurchaseOrderStatus.CANCELLED;
            } else if (status === PurchaseOrderStatus.RECEIVED || status === PurchaseOrderStatus.PARTIALLY_RECEIVED) {
                // Calculate existing received quantities per ingredient from prior batches
                const existingReceivedMap = new Map<string, number>();
                for (const b of po.batches) {
                    const prev = existingReceivedMap.get(b.ingredientId) || 0;
                    existingReceivedMap.set(b.ingredientId, prev + b.quantityReceived);
                }

                // Determine which items to receive in this delivery attempt
                const itemsToReceive: {
                    ingredientId: string;
                    quantityReceived: number;
                    unitCost?: number;
                    batchNumber?: string | null;
                    expiryDate?: string | null;
                }[] =
                    options?.items && options.items.length > 0
                        ? options.items
                              .map((item) => ({
                                  ingredientId: item.ingredientId,
                                  quantityReceived:
                                      item.quantityReceived !== undefined
                                          ? item.quantityReceived
                                          : Math.max(
                                                0,
                                                (po.items.find((pi) => pi.ingredientId === item.ingredientId)?.quantity ?? 0) -
                                                    (existingReceivedMap.get(item.ingredientId) ?? 0)
                                            ),
                                  unitCost: item.unitCost,
                                  batchNumber: item.batchNumber,
                                  expiryDate: item.expiryDate
                              }))
                              .filter((item) => item.quantityReceived > 0)
                        : po.items
                              .map((poItem) => ({
                                  ingredientId: poItem.ingredientId,
                                  quantityReceived: Math.max(0, poItem.quantity - (existingReceivedMap.get(poItem.ingredientId) || 0)),
                                  unitCost: poItem.unitCost && Number(poItem.unitCost) > 0 ? Number(poItem.unitCost) : undefined,
                                  batchNumber: undefined,
                                  expiryDate: undefined
                              }))
                              .filter((item) => item.quantityReceived > 0);

                if (itemsToReceive.length > 0) {
                    const allIncomingIngredientIds = itemsToReceive.map((i) => i.ingredientId);
                    const inventories = await tx.ingredientInventory.findMany({
                        where: { ingredientId: { in: allIncomingIngredientIds }, deletedAt: null }
                    });
                    const inventoryByIngredient = new Map(inventories.map((inventory) => [inventory.ingredientId, inventory]));

                    const supplierIngredients = await tx.supplierIngredient.findMany({
                        where: {
                            supplierId: po.supplierId,
                            ingredientId: { in: allIncomingIngredientIds }
                        }
                    });
                    const supplierPriceMap = new Map<string, number>();
                    for (const si of supplierIngredients) {
                        if (si.unitCost !== null && si.unitCost !== undefined && Number(si.unitCost) > 0) {
                            supplierPriceMap.set(si.ingredientId, Number(si.unitCost));
                        }
                    }

                    const allIngredients = await tx.ingredient.findMany({
                        where: { id: { in: allIncomingIngredientIds } }
                    });
                    const ingredientMap = new Map(allIngredients.map((i) => [i.id, i]));

                    const nextDeliveryIndex = po.batches.length + 1;
                    const defaultBatchNum = options?.deliveryBatchNumber || `${po.poNumber}-D${nextDeliveryIndex}`;

                    for (const item of itemsToReceive) {
                        const poItem = po.items.find((p) => p.ingredientId === item.ingredientId);
                        const unitCost =
                            item.unitCost !== undefined
                                ? item.unitCost
                                : (supplierPriceMap.get(item.ingredientId) ?? (poItem && Number(poItem.unitCost) > 0 ? Number(poItem.unitCost) : 0));
                        const totalCost = item.quantityReceived * unitCost;
                        const batchNumber = item.batchNumber || defaultBatchNum;

                        const batch = await tx.ingredientBatch.create({
                            data: {
                                ingredientId: item.ingredientId,
                                supplierId: po.supplierId,
                                quantityReceived: item.quantityReceived,
                                currentQuantity: item.quantityReceived,
                                unitCost,
                                totalCost,
                                batchNumber,
                                expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
                                purchaseOrderId: po.id,
                                createdById: actorId,
                                updatedById: actorId
                            }
                        });

                        await tx.stockTransaction.create({
                            data: {
                                batchId: batch.id,
                                quantityChange: item.quantityReceived,
                                type: 'DELIVERY',
                                reason: `Received from Purchase Order ${po.poNumber}`,
                                createdById: actorId
                            }
                        });

                        const ingredientMeta = ingredientMap.get(item.ingredientId);
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

                        const newQuantity = Math.max(0, inventory.currentQuantity + item.quantityReceived);
                        let newStatus: InventoryStatus = InventoryStatus.SAFE;
                        if (newQuantity <= 0) {
                            newStatus = InventoryStatus.OUT_OF_STOCK;
                        } else if (ingredientMeta && newQuantity <= ingredientMeta.reorderPoint) {
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

                        // If item was on the PO, update its unitCost and totalCost if not set
                        if (poItem) {
                            await tx.purchaseOrderItem.update({
                                where: { id: poItem.id },
                                data: {
                                    unitCost,
                                    totalCost: (poItem.quantity || item.quantityReceived) * unitCost
                                }
                            });
                        } else {
                            // Extra / free item: create PO line item so it displays on the order breakdown
                            await tx.purchaseOrderItem.create({
                                data: {
                                    purchaseOrderId: po.id,
                                    ingredientId: item.ingredientId,
                                    quantity: item.quantityReceived,
                                    unitCost,
                                    totalCost
                                }
                            });
                        }
                    }
                }

                // Query all batches now attached to this PO to evaluate cumulative fulfillment & total cost
                const updatedBatches = await tx.ingredientBatch.findMany({
                    where: { purchaseOrderId: po.id, deletedAt: null }
                });

                const cumulativeMap = new Map<string, number>();
                let computedTotalAmount = 0;
                for (const b of updatedBatches) {
                    const prev = cumulativeMap.get(b.ingredientId) || 0;
                    cumulativeMap.set(b.ingredientId, prev + b.quantityReceived);
                    computedTotalAmount += b.totalCost;
                }

                const updatedPoItems = await tx.purchaseOrderItem.findMany({
                    where: { purchaseOrderId: po.id, deletedAt: null }
                });

                const isFullyFulfilled =
                    updatedPoItems.length > 0 && updatedPoItems.every((pi) => (cumulativeMap.get(pi.ingredientId) || 0) >= pi.quantity);

                if (options?.closeOrder || isFullyFulfilled) {
                    updates.status = PurchaseOrderStatus.RECEIVED;
                    updates.receivedAt = po.receivedAt || new Date();
                } else {
                    updates.status = PurchaseOrderStatus.PARTIALLY_RECEIVED;
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
                    },
                    batches: {
                        where: { deletedAt: null },
                        include: {
                            ingredient: {
                                include: {
                                    defaultUnit: true
                                }
                            },
                            createdBy: {
                                select: {
                                    id: true,
                                    username: true,
                                    firstName: true,
                                    lastName: true
                                }
                            }
                        },
                        orderBy: { receivedAt: 'desc' }
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
