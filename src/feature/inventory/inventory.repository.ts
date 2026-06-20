import { prisma } from '@/lib/prisma';
import { BaseRepository } from '@/repository/base.repository';
import { Prisma, InventoryStatus, TransactionType } from '@prisma/client';
import { auditSelect, type IPaginatedResult } from '@/types/base.types';
import type {
    TCreateIngredientUnit,
    TUpdateIngredientUnit,
    TCreateIngredient,
    TUpdateIngredient,
    TCreateBatch,
    TCreateAdjustment,
    TGetListQuery,
    TGetStockLevelListQuery
} from './inventory.types';

export class InventoryRepository extends BaseRepository {
    // ==========================================
    // 1. INGREDIENT UNIT CRUD
    // ==========================================

    async createUnit(data: TCreateIngredientUnit, actorId: string) {
        return prisma.ingredientUnit.create({
            data: {
                name: data.name,
                abbreviation: data.abbreviation,
                createdById: actorId,
                updatedById: actorId
            },
            include: {
                createdBy: { select: auditSelect },
                updatedBy: { select: auditSelect }
            }
        });
    }

    async updateUnit(id: string, data: TUpdateIngredientUnit, actorId: string) {
        return prisma.ingredientUnit.update({
            where: { id },
            data: {
                ...data,
                updatedById: actorId
            },
            include: {
                createdBy: { select: auditSelect },
                updatedBy: { select: auditSelect }
            }
        });
    }

    async softDeleteUnit(id: string, actorId: string) {
        return prisma.ingredientUnit.update({
            where: { id },
            data: {
                deletedAt: new Date(),
                updatedById: actorId
            }
        });
    }

    async findUnitById(id: string) {
        return prisma.ingredientUnit.findFirst({
            where: { id, deletedAt: null },
            include: {
                createdBy: { select: auditSelect },
                updatedBy: { select: auditSelect }
            }
        });
    }

    async findUnitByNameOrAbbrev(name: string, abbreviation?: string | null) {
        const OR: Prisma.IngredientUnitWhereInput[] = [{ name }];
        if (abbreviation) {
            OR.push({ abbreviation });
        }
        return prisma.ingredientUnit.findFirst({
            where: {
                OR,
                deletedAt: null
            }
        });
    }

    async getUnitList(params: TGetListQuery): Promise<IPaginatedResult<unknown>> {
        const { skip, take, page } = this.normalizePagination(params);
        const where: Prisma.IngredientUnitWhereInput = {};

        if (params.status === 'active') {
            where.deletedAt = null;
        } else if (params.status === 'archive') {
            where.deletedAt = { not: null };
        }

        if (params.search) {
            where.OR = [{ name: { contains: params.search } }, { abbreviation: { contains: params.search } }];
        }

        const [data, totalRows] = await Promise.all([
            prisma.ingredientUnit.findMany({
                where,
                skip,
                take,
                orderBy: { name: 'asc' },
                include: {
                    createdBy: { select: auditSelect },
                    updatedBy: { select: auditSelect }
                }
            }),
            prisma.ingredientUnit.count({ where })
        ]);

        return this.formatPaginatedResult(data, totalRows, page, take);
    }

    // ==========================================
    // 2. INGREDIENT CRUD & CREATOR
    // ==========================================

    async createIngredient(data: TCreateIngredient, actorId: string) {
        return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            const ingredient = await tx.ingredient.create({
                data: {
                    name: data.name,
                    description: data.description,
                    ingredientUnitId: data.ingredientUnitId,
                    reorderPoint: data.reorderPoint,
                    createdById: actorId,
                    updatedById: actorId
                },
                include: {
                    createdBy: { select: auditSelect },
                    updatedBy: { select: auditSelect }
                }
            });

            // Initialize empty inventory for this ingredient
            await tx.ingredientInventory.create({
                data: {
                    ingredientId: ingredient.id,
                    currentQuantity: 0,
                    status: InventoryStatus.OUT_OF_STOCK, // Initially zero stock
                    createdById: actorId,
                    updatedById: actorId
                }
            });

            return ingredient;
        });
    }

    async updateIngredient(id: string, data: TUpdateIngredient, actorId: string) {
        return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            const updated = await tx.ingredient.update({
                where: { id },
                data: {
                    ...data,
                    updatedById: actorId
                },
                include: {
                    createdBy: { select: auditSelect },
                    updatedBy: { select: auditSelect }
                }
            });

            // If reorderPoint or unit changes, recalculate status
            if (data.reorderPoint !== undefined) {
                const inv = await tx.ingredientInventory.findFirst({
                    where: { ingredientId: id }
                });

                if (inv) {
                    const status = this.calculateInventoryStatus(inv.currentQuantity, updated.reorderPoint);
                    await tx.ingredientInventory.update({
                        where: { id: inv.id },
                        data: { status }
                    });
                }
            }

            return updated;
        });
    }

    async softDeleteIngredient(id: string, actorId: string) {
        return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            const updated = await tx.ingredient.update({
                where: { id },
                data: {
                    deletedAt: new Date(),
                    updatedById: actorId
                }
            });

            // Soft-delete corresponding inventory record
            await tx.ingredientInventory.updateMany({
                where: { ingredientId: id },
                data: {
                    deletedAt: new Date(),
                    updatedById: actorId
                }
            });

            return updated;
        });
    }

    async findIngredientById(id: string) {
        return prisma.ingredient.findFirst({
            where: { id, deletedAt: null },
            include: {
                defaultUnit: true,
                createdBy: { select: auditSelect },
                updatedBy: { select: auditSelect }
            }
        });
    }

    async findIngredientByName(name: string) {
        return prisma.ingredient.findFirst({
            where: { name, deletedAt: null }
        });
    }

    async getIngredientList(params: TGetListQuery): Promise<IPaginatedResult<unknown>> {
        const { skip, take, page } = this.normalizePagination(params);
        const where: Prisma.IngredientWhereInput = {};

        if (params.status === 'active') {
            where.deletedAt = null;
        } else if (params.status === 'archive') {
            where.deletedAt = { not: null };
        }

        if (params.search) {
            where.OR = [{ name: { contains: params.search } }, { description: { contains: params.search } }];
        }

        const [data, totalRows] = await Promise.all([
            prisma.ingredient.findMany({
                where,
                skip,
                take,
                orderBy: { name: 'asc' },
                include: {
                    defaultUnit: true,
                    createdBy: { select: auditSelect },
                    updatedBy: { select: auditSelect }
                }
            }),
            prisma.ingredient.count({ where })
        ]);

        return this.formatPaginatedResult(data, totalRows, page, take);
    }

    // ==========================================
    // 3. INGREDIENT INVENTORY (LEVELS) QUERIES
    // ==========================================

    async getInventoryLevelByIngredientId(ingredientId: string) {
        return prisma.ingredientInventory.findFirst({
            where: { ingredientId, deletedAt: null },
            include: {
                ingredient: {
                    include: { defaultUnit: true }
                },
                createdBy: { select: auditSelect },
                updatedBy: { select: auditSelect }
            }
        });
    }

    async getInventoryLevelsList(params: TGetStockLevelListQuery): Promise<IPaginatedResult<unknown>> {
        const { skip, take, page } = this.normalizePagination(params);
        const where: Prisma.IngredientInventoryWhereInput = {};

        if (params.recordStatus === 'active') {
            where.deletedAt = null;
        } else if (params.recordStatus === 'archive') {
            where.deletedAt = { not: null };
        }

        if (params.status) {
            where.status = params.status;
        }

        if (params.search) {
            where.ingredient = {
                name: { contains: params.search }
            };
        }

        const [data, totalRows] = await Promise.all([
            prisma.ingredientInventory.findMany({
                where,
                skip,
                take,
                orderBy: { currentQuantity: 'asc' }, // Rank critical items first
                include: {
                    ingredient: {
                        include: { defaultUnit: true }
                    },
                    createdBy: { select: auditSelect },
                    updatedBy: { select: auditSelect }
                }
            }),
            prisma.ingredientInventory.count({ where })
        ]);

        return this.formatPaginatedResult(data, totalRows, page, take);
    }

    // ==========================================
    // 4. TRANSACTION: SYNC STOCK & STATUS ALERTS
    // ==========================================

    async deductIngredientStockFEFO(
        tx: Prisma.TransactionClient,
        ingredientId: string,
        quantityToDeduct: number,
        type: TransactionType,
        reason: string | null,
        actorId: string
    ) {
        if (quantityToDeduct <= 0) return;

        // 1. Fetch active batches
        const batches = await tx.ingredientBatch.findMany({
            where: {
                ingredientId,
                currentQuantity: { gt: 0 },
                deletedAt: null
            },
            orderBy: { receivedAt: 'asc' }
        });

        // Sort in memory: null expiryDate last, others by date ASC
        batches.sort((a, b) => {
            if (a.expiryDate && b.expiryDate) {
                return a.expiryDate.getTime() - b.expiryDate.getTime();
            }
            if (a.expiryDate && !b.expiryDate) {
                return -1;
            }
            if (!a.expiryDate && b.expiryDate) {
                return 1;
            }
            return a.receivedAt.getTime() - b.receivedAt.getTime();
        });

        let remainingToDeduct = quantityToDeduct;

        for (const batch of batches) {
            if (remainingToDeduct <= 0) break;

            const deductFromThisBatch = Math.min(batch.currentQuantity, remainingToDeduct);
            const newBatchQty = batch.currentQuantity - deductFromThisBatch;
            remainingToDeduct -= deductFromThisBatch;

            await tx.ingredientBatch.update({
                where: { id: batch.id },
                data: {
                    currentQuantity: newBatchQty,
                    updatedById: actorId
                }
            });

            await tx.stockTransaction.create({
                data: {
                    batchId: batch.id,
                    quantityChange: -deductFromThisBatch,
                    type,
                    reason,
                    createdById: actorId
                }
            });
        }

        if (remainingToDeduct > 0) {
            if (batches.length > 0) {
                const lastBatch = batches[batches.length - 1];
                await tx.ingredientBatch.update({
                    where: { id: lastBatch.id },
                    data: {
                        currentQuantity: lastBatch.currentQuantity - remainingToDeduct,
                        updatedById: actorId
                    }
                });

                await tx.stockTransaction.create({
                    data: {
                        batchId: lastBatch.id,
                        quantityChange: -remainingToDeduct,
                        type,
                        reason: (reason || '') + ' (Excess deduction over batch stock)',
                        createdById: actorId
                    }
                });
            } else {
                const dummyBatch = await tx.ingredientBatch.create({
                    data: {
                        ingredientId,
                        quantityReceived: 0,
                        currentQuantity: -remainingToDeduct,
                        unitCost: 0,
                        totalCost: 0,
                        batchNumber: 'OVERFLOW-BATCH',
                        expiryDate: null,
                        createdById: actorId,
                        updatedById: actorId
                    }
                });

                await tx.stockTransaction.create({
                    data: {
                        batchId: dummyBatch.id,
                        quantityChange: -remainingToDeduct,
                        type,
                        reason: (reason || '') + ' (Excess deduction with no active batches)',
                        createdById: actorId
                    }
                });
            }
        }

        // 2. Fetch the ingredient for reorderPoint
        const ingredient = await tx.ingredient.findUniqueOrThrow({
            where: { id: ingredientId }
        });

        // 3. Update global IngredientInventory
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

        const newQuantity = Math.max(0, inventory.currentQuantity - quantityToDeduct);
        const newStatus = this.calculateInventoryStatus(newQuantity, ingredient.reorderPoint);

        await tx.ingredientInventory.update({
            where: { id: inventory.id },
            data: {
                currentQuantity: newQuantity,
                status: newStatus,
                updatedById: actorId
            }
        });
    }

    async addIngredientStockLatest(
        tx: Prisma.TransactionClient,
        ingredientId: string,
        quantityToAdd: number,
        type: TransactionType,
        reason: string | null,
        actorId: string
    ) {
        if (quantityToAdd <= 0) return;

        const latestBatch = await tx.ingredientBatch.findFirst({
            where: {
                ingredientId,
                deletedAt: null
            },
            orderBy: { receivedAt: 'desc' }
        });

        if (latestBatch) {
            await tx.ingredientBatch.update({
                where: { id: latestBatch.id },
                data: {
                    currentQuantity: latestBatch.currentQuantity + quantityToAdd,
                    updatedById: actorId
                }
            });

            await tx.stockTransaction.create({
                data: {
                    batchId: latestBatch.id,
                    quantityChange: quantityToAdd,
                    type,
                    reason,
                    createdById: actorId
                }
            });
        } else {
            const newBatch = await tx.ingredientBatch.create({
                data: {
                    ingredientId,
                    quantityReceived: quantityToAdd,
                    currentQuantity: quantityToAdd,
                    unitCost: 0,
                    totalCost: 0,
                    batchNumber: 'ADJUSTMENT-BATCH',
                    expiryDate: null,
                    createdById: actorId,
                    updatedById: actorId
                }
            });

            await tx.stockTransaction.create({
                data: {
                    batchId: newBatch.id,
                    quantityChange: quantityToAdd,
                    type,
                    reason,
                    createdById: actorId
                }
            });
        }

        // Update global IngredientInventory
        const ingredient = await tx.ingredient.findUniqueOrThrow({
            where: { id: ingredientId }
        });

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

        const newQuantity = inventory.currentQuantity + quantityToAdd;
        const newStatus = this.calculateInventoryStatus(newQuantity, ingredient.reorderPoint);

        await tx.ingredientInventory.update({
            where: { id: inventory.id },
            data: {
                currentQuantity: newQuantity,
                status: newStatus,
                updatedById: actorId
            }
        });
    }

    async adjustStockAndStatus(
        ingredientId: string,
        quantityDiff: number,
        isPhysicalCount: boolean,
        actorId: string,
        transactionType?: TransactionType,
        reason?: string | null,
        skipBatchAdjustment = false
    ) {
        return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            const ingredient = await tx.ingredient.findFirst({
                where: { id: ingredientId, deletedAt: null }
            });
            if (!ingredient) {
                throw new Error('Ingredient not found');
            }

            let inventory = await tx.ingredientInventory.findFirst({
                where: { ingredientId, deletedAt: null }
            });

            if (!inventory) {
                inventory = await tx.ingredientInventory.create({
                    data: {
                        ingredientId,
                        currentQuantity: 0,
                        status: InventoryStatus.OUT_OF_STOCK,
                        createdById: actorId,
                        updatedById: actorId
                    }
                });
            }

            if (!skipBatchAdjustment) {
                if (isPhysicalCount) {
                    const discrepancy = quantityDiff - inventory.currentQuantity;
                    if (discrepancy < 0) {
                        await this.deductIngredientStockFEFO(
                            tx,
                            ingredientId,
                            Math.abs(discrepancy),
                            'PHYSICAL_COUNT_CORRECTION',
                            reason || 'Deduction via Physical Inventory Count',
                            actorId
                        );
                    } else if (discrepancy > 0) {
                        await this.addIngredientStockLatest(
                            tx,
                            ingredientId,
                            discrepancy,
                            'PHYSICAL_COUNT_CORRECTION',
                            reason || 'Addition via Physical Inventory Count',
                            actorId
                        );
                    }
                } else {
                    const type = transactionType || (quantityDiff < 0 ? 'WASTE' : 'PHYSICAL_COUNT_CORRECTION');
                    if (quantityDiff < 0) {
                        await this.deductIngredientStockFEFO(tx, ingredientId, Math.abs(quantityDiff), type, reason ?? null, actorId);
                    } else if (quantityDiff > 0) {
                        await this.addIngredientStockLatest(tx, ingredientId, quantityDiff, type, reason ?? null, actorId);
                    }
                }
            }

            if (isPhysicalCount) {
                await tx.ingredientInventory.updateMany({
                    where: { ingredientId, deletedAt: null },
                    data: {
                        lastPhysicalCount: new Date(),
                        updatedById: actorId
                    }
                });
            }

            if (skipBatchAdjustment) {
                const newQuantity = Math.max(0, inventory.currentQuantity + quantityDiff);
                const newStatus = this.calculateInventoryStatus(newQuantity, ingredient.reorderPoint);
                await tx.ingredientInventory.update({
                    where: { id: inventory.id },
                    data: {
                        currentQuantity: newQuantity,
                        status: newStatus,
                        updatedById: actorId
                    }
                });
            }

            return tx.ingredientInventory.findFirstOrThrow({
                where: { ingredientId, deletedAt: null },
                include: {
                    ingredient: {
                        include: { defaultUnit: true }
                    },
                    createdBy: { select: auditSelect },
                    updatedBy: { select: auditSelect }
                }
            });
        });
    }

    private calculateInventoryStatus(quantity: number, reorderPoint: number): InventoryStatus {
        if (quantity <= 0) {
            return InventoryStatus.OUT_OF_STOCK;
        }
        if (quantity <= reorderPoint) {
            return InventoryStatus.CRITICAL;
        }
        return InventoryStatus.SAFE;
    }

    // ==========================================
    // 5. INGREDIENT BATCH CRUD
    // ==========================================

    async createBatch(data: TCreateBatch & { totalCost: number }, actorId: string) {
        return prisma.$transaction(async (tx) => {
            const batch = await tx.ingredientBatch.create({
                data: {
                    ingredientId: data.ingredientId,
                    supplierId: data.supplierId,
                    quantityReceived: data.quantityReceived,
                    currentQuantity: data.quantityReceived,
                    unitCost: data.unitCost,
                    totalCost: data.totalCost,
                    batchNumber: data.batchNumber,
                    expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
                    createdById: actorId,
                    updatedById: actorId
                },
                include: {
                    createdBy: { select: auditSelect },
                    updatedBy: { select: auditSelect }
                }
            });

            await tx.stockTransaction.create({
                data: {
                    batchId: batch.id,
                    quantityChange: data.quantityReceived,
                    type: 'DELIVERY',
                    reason: `Received delivery batch ${data.batchNumber || 'N/A'}`,
                    createdById: actorId
                }
            });

            return batch;
        });
    }

    async getBatchList(params: TGetListQuery): Promise<IPaginatedResult<unknown>> {
        const { skip, take, page } = this.normalizePagination(params);
        const where: Prisma.IngredientBatchWhereInput = {};

        if (params.status === 'active') {
            where.deletedAt = null;
        } else if (params.status === 'archive') {
            where.deletedAt = { not: null };
        }

        if (params.search) {
            where.OR = [
                { batchNumber: { contains: params.search } },
                {
                    ingredient: {
                        name: { contains: params.search }
                    }
                }
            ];
        }

        const [data, totalRows] = await Promise.all([
            prisma.ingredientBatch.findMany({
                where,
                skip,
                take,
                orderBy: { receivedAt: 'desc' },
                include: {
                    ingredient: {
                        include: { defaultUnit: true }
                    },
                    supplier: true,
                    createdBy: { select: auditSelect },
                    updatedBy: { select: auditSelect }
                }
            }),
            prisma.ingredientBatch.count({ where })
        ]);

        return this.formatPaginatedResult(data, totalRows, page, take);
    }

    // ==========================================
    // 6. INVENTORY ADJUSTMENTS CRUD
    // ==========================================

    async createAdjustment(data: TCreateAdjustment, actorId: string) {
        return prisma.inventoryAdjustment.create({
            data: {
                ingredientId: data.ingredientId,
                quantity: data.quantity,
                type: data.type,
                reason: data.reason,
                createdById: actorId,
                updatedById: actorId
            },
            include: {
                createdBy: { select: auditSelect },
                updatedBy: { select: auditSelect }
            }
        });
    }

    async getAdjustmentList(params: TGetListQuery): Promise<IPaginatedResult<unknown>> {
        const { skip, take, page } = this.normalizePagination(params);
        const where: Prisma.InventoryAdjustmentWhereInput = {};

        if (params.status === 'active') {
            where.deletedAt = null;
        } else if (params.status === 'archive') {
            where.deletedAt = { not: null };
        }

        if (params.search) {
            where.OR = [
                { reason: { contains: params.search } },
                {
                    ingredient: {
                        name: { contains: params.search }
                    }
                }
            ];
        }

        const [data, totalRows] = await Promise.all([
            prisma.inventoryAdjustment.findMany({
                where,
                skip,
                take,
                orderBy: { createdAt: 'desc' },
                include: {
                    ingredient: {
                        include: { defaultUnit: true }
                    },
                    createdBy: { select: auditSelect },
                    updatedBy: { select: auditSelect }
                }
            }),
            prisma.inventoryAdjustment.count({ where })
        ]);

        return this.formatPaginatedResult(data, totalRows, page, take);
    }

    async getVariantsWithRecipes() {
        return prisma.productVariant.findMany({
            where: { deletedAt: null },
            include: {
                product: {
                    select: { id: true, name: true }
                },
                attributes: {
                    where: { deletedAt: null },
                    include: {
                        attributeValue: {
                            include: {
                                attribute: { select: { name: true } }
                            }
                        }
                    }
                },
                recipe: {
                    where: { deletedAt: null },
                    include: {
                        ingredients: {
                            where: { deletedAt: null },
                            include: {
                                ingredient: {
                                    include: {
                                        inventories: {
                                            where: { deletedAt: null }
                                        },
                                        defaultUnit: true
                                    }
                                },
                                unit: true
                            }
                        }
                    }
                }
            }
        });
    }

    // ==========================================
    // 7. RESTORE & FIND INCLUDING DELETED METHODS
    // ==========================================

    async restoreUnit(id: string, actorId: string) {
        return prisma.ingredientUnit.update({
            where: { id },
            data: {
                deletedAt: null,
                updatedById: actorId
            }
        });
    }

    async findUnitByIdIncludingDeleted(id: string) {
        return prisma.ingredientUnit.findFirst({
            where: { id },
            include: {
                createdBy: { select: auditSelect },
                updatedBy: { select: auditSelect }
            }
        });
    }

    async restoreIngredient(id: string, actorId: string) {
        const ingredient = await prisma.ingredient.findUniqueOrThrow({
            where: { id }
        });

        if (!ingredient.deletedAt) {
            return ingredient;
        }

        const deleteTime = ingredient.deletedAt;
        const timeWindowStart = new Date(deleteTime.getTime() - 5000);
        const timeWindowEnd = new Date(deleteTime.getTime() + 5000);

        return prisma.$transaction(async (tx) => {
            const restoredIngredient = await tx.ingredient.update({
                where: { id },
                data: {
                    deletedAt: null,
                    updatedById: actorId
                }
            });

            await tx.ingredientInventory.updateMany({
                where: {
                    ingredientId: id,
                    deletedAt: {
                        gte: timeWindowStart,
                        lte: timeWindowEnd
                    }
                },
                data: {
                    deletedAt: null,
                    updatedById: actorId
                }
            });

            return restoredIngredient;
        });
    }

    async findIngredientByIdIncludingDeleted(id: string) {
        return prisma.ingredient.findFirst({
            where: { id },
            include: {
                defaultUnit: true,
                createdBy: { select: auditSelect },
                updatedBy: { select: auditSelect }
            }
        });
    }

    async getModifierOptionsWithRecipes() {
        return prisma.modifierOption.findMany({
            where: { deletedAt: null },
            include: {
                group: {
                    select: { id: true, name: true }
                },
                recipe: {
                    where: { deletedAt: null },
                    include: {
                        ingredients: {
                            where: { deletedAt: null },
                            include: {
                                ingredient: {
                                    include: {
                                        inventories: {
                                            where: { deletedAt: null }
                                        },
                                        defaultUnit: true
                                    }
                                },
                                unit: true
                            }
                        }
                    }
                }
            }
        });
    }

    // ==========================================
    // 8. DASHBOARD METHODS
    // ==========================================

    async getDashboardOverview() {
        const [totalIngredients, lowStockCount, outOfStockCount] = await Promise.all([
            prisma.ingredient.count({
                where: { deletedAt: null }
            }),
            prisma.ingredientInventory.count({
                where: { status: InventoryStatus.CRITICAL, deletedAt: null }
            }),
            prisma.ingredientInventory.count({
                where: { status: InventoryStatus.OUT_OF_STOCK, deletedAt: null }
            })
        ]);

        return {
            totalIngredients,
            lowStockCount,
            outOfStockCount
        };
    }

    async getDashboardRecentDeliveries() {
        const deliveries = await prisma.ingredientBatch.findMany({
            where: { deletedAt: null },
            orderBy: { receivedAt: 'desc' },
            take: 5,
            include: {
                ingredient: {
                    select: {
                        name: true,
                        defaultUnit: { select: { abbreviation: true } }
                    }
                },
                supplier: {
                    select: { name: true }
                }
            }
        });

        return deliveries.map((d) => ({
            id: d.id,
            ingredientName: d.ingredient?.name || '—',
            supplierName: d.supplier?.name || null,
            quantityReceived: d.quantityReceived,
            currentQuantity: d.currentQuantity,
            unitAbbreviation: d.ingredient?.defaultUnit?.abbreviation || null,
            totalCost: d.totalCost,
            receivedAt: d.receivedAt
        }));
    }

    async getDashboardRecentAdjustments() {
        const adjustments = await prisma.inventoryAdjustment.findMany({
            where: { deletedAt: null },
            orderBy: { createdAt: 'desc' },
            take: 5,
            include: {
                ingredient: {
                    select: {
                        name: true,
                        defaultUnit: { select: { abbreviation: true } }
                    }
                }
            }
        });

        return adjustments.map((a) => ({
            id: a.id,
            ingredientName: a.ingredient?.name || '—',
            quantity: a.quantity,
            unitAbbreviation: a.ingredient?.defaultUnit?.abbreviation || null,
            type: a.type,
            reason: a.reason,
            createdAt: a.createdAt
        }));
    }

    async getDashboardExpiringSoon() {
        const now = new Date();
        const next30Days = new Date();
        next30Days.setDate(next30Days.getDate() + 30);

        const expiring = await prisma.ingredientBatch.findMany({
            where: {
                deletedAt: null,
                currentQuantity: { gt: 0 },
                expiryDate: {
                    gte: now,
                    lte: next30Days
                }
            },
            orderBy: { expiryDate: 'asc' },
            take: 5,
            include: {
                ingredient: {
                    select: {
                        name: true,
                        defaultUnit: { select: { abbreviation: true } }
                    }
                }
            }
        });

        return expiring.map((e) => ({
            id: e.id,
            batchNumber: e.batchNumber,
            expiryDate: e.expiryDate!,
            quantityReceived: e.quantityReceived,
            currentQuantity: e.currentQuantity,
            ingredientName: e.ingredient?.name || '—',
            unitAbbreviation: e.ingredient?.defaultUnit?.abbreviation || null
        }));
    }

    async getDashboardWasteSummary() {
        const last30Days = new Date();
        last30Days.setDate(last30Days.getDate() - 30);

        const adjustments = await prisma.inventoryAdjustment.findMany({
            where: {
                createdAt: { gte: last30Days },
                deletedAt: null
            },
            select: {
                type: true,
                quantity: true
            }
        });

        // Group by type
        const groups: Record<string, { count: number; totalQuantity: number }> = {};
        for (const adj of adjustments) {
            if (!groups[adj.type]) {
                groups[adj.type] = { count: 0, totalQuantity: 0 };
            }
            groups[adj.type].count += 1;
            groups[adj.type].totalQuantity += Math.abs(adj.quantity);
        }

        return Object.entries(groups).map(([type, summary]) => ({
            type,
            count: summary.count,
            totalQuantity: summary.totalQuantity
        }));
    }
}
