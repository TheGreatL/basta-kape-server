import { prisma } from '@/lib/prisma';
import { BaseRepository } from '@/repository/base.repository';
import { Prisma, PreparedBatchStatus } from '@prisma/client';
import { InventoryRepository } from '@/feature/inventory/inventory.repository';
import { BadRequestException, NotFoundException } from '@/exceptions';
import { UnitConversionService } from '@/feature/unit-conversion/unit-conversion.service';
import type { TCreatePreparedBatch, TDisposePreparedBatch, TGetPreparedBatchListQuery } from './food-prep.types';

export class FoodPrepRepository extends BaseRepository {
    private inventoryRepo: InventoryRepository;

    constructor() {
        super();
        this.inventoryRepo = new InventoryRepository();
    }

    /**
     * Creates a new prepared display batch, deducting raw recipe ingredients from inventory immediately.
     */
    async createBatch(data: TCreatePreparedBatch, actorId: string) {
        return prisma.$transaction(async (tx) => {
            // 1. Fetch Variant with Product and Recipe
            const variant = await tx.productVariant.findUnique({
                where: { id: data.productVariantId, deletedAt: null },
                include: {
                    product: true,
                    recipe: {
                        where: { deletedAt: null },
                        include: {
                            ingredients: {
                                where: { deletedAt: null },
                                include: {
                                    ingredient: true,
                                    unit: true
                                }
                            }
                        }
                    },
                    attributes: {
                        where: { deletedAt: null },
                        include: {
                            attributeValue: {
                                include: {
                                    attribute: true
                                }
                            }
                        }
                    }
                }
            });

            if (!variant) {
                throw new NotFoundException(`Product variant with ID "${data.productVariantId}" not found`);
            }

            if (!variant.recipe || variant.recipe.ingredients.length === 0) {
                throw new BadRequestException(`Cannot prepare batch for "${variant.product.name}": No recipe configured for this variant.`);
            }

            // 2. Calculate required raw ingredient quantities
            const activeConversions = await tx.unitConversion.findMany({
                where: { deletedAt: null },
                include: {
                    fromUnit: { select: { name: true, abbreviation: true } },
                    toUnit: { select: { name: true, abbreviation: true } },
                    ingredient: { select: { name: true } }
                }
            });
            const converter = UnitConversionService.createConverter(activeConversions);

            const ingredientRequirements = new Map<string, number>();
            for (const item of variant.recipe.ingredients) {
                const baseQuantity = converter(
                    item.ingredientUnitId,
                    item.ingredient.ingredientUnitId,
                    item.quantity * data.quantity,
                    item.ingredientId
                );
                ingredientRequirements.set(item.ingredientId, (ingredientRequirements.get(item.ingredientId) ?? 0) + baseQuantity);
            }

            // 3. Verify stock availability
            const stockCheck = await this.inventoryRepo.checkIngredientStockAvailability(tx, ingredientRequirements);
            if (!stockCheck.sufficient) {
                const details = stockCheck.insufficientIngredients
                    .map((i) => `${i.ingredientName} (Required: ${i.required}${i.unit}, Available: ${i.available}${i.unit})`)
                    .join(', ');
                throw new BadRequestException(`Insufficient raw ingredients to prepare batch: ${details}`);
            }

            // 4. Determine shelf life (Use custom, or fallback to product default, or 1440 mins / 24 hours)
            const shelfLifeMinutes = data.shelfLifeMinutes ?? variant.product.defaultShelfLife ?? 1440;
            const preparedAt = new Date();
            const expiresAt = new Date(preparedAt.getTime() + shelfLifeMinutes * 60 * 1000);

            // 5. Generate unique batch number
            const baseSku = (variant.sku || variant.product.name.replace(/\s+/g, '-').toUpperCase()).slice(0, 12);
            const dateStr = preparedAt.toISOString().slice(0, 10).replace(/-/g, '');
            const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
            const batchNumber = `PREP-${baseSku}-${dateStr}-${randomSuffix}`;

            // 6. Create PreparedItemBatch
            const batch = await tx.preparedItemBatch.create({
                data: {
                    productVariantId: variant.id,
                    productId: variant.productId,
                    batchNumber,
                    quantityPrepared: data.quantity,
                    currentQuantity: data.quantity,
                    preparedAt,
                    shelfLifeMinutes,
                    expiresAt,
                    status: PreparedBatchStatus.FRESH,
                    notes: data.notes ?? null,
                    createdById: actorId,
                    updatedById: actorId,
                    transactions: {
                        create: {
                            quantityChange: data.quantity,
                            type: 'CORRECTION',
                            reason: `Initial batch preparation (${data.quantity} units)`,
                            createdById: actorId
                        }
                    }
                },
                include: {
                    product: { select: { id: true, name: true, photo: true } },
                    productVariant: {
                        select: {
                            id: true,
                            sku: true,
                            price: true,
                            attributes: {
                                include: {
                                    attributeValue: {
                                        include: { attribute: true }
                                    }
                                }
                            }
                        }
                    },
                    transactions: true
                }
            });

            // 7. Deduct raw recipe ingredients
            for (const [ingredientId, qty] of ingredientRequirements.entries()) {
                await this.inventoryRepo.deductIngredientStockFEFO(
                    tx,
                    ingredientId,
                    qty,
                    'SALE',
                    `Ingredient deduction for Food Preparation Batch ${batchNumber} (${data.quantity} units)`,
                    actorId
                );
            }

            return batch;
        });
    }

    /**
     * Retrieves a prepared batch by ID.
     */
    async findBatchById(id: string) {
        return prisma.preparedItemBatch.findUnique({
            where: { id, deletedAt: null },
            include: {
                product: { select: { id: true, name: true, photo: true } },
                productVariant: {
                    select: {
                        id: true,
                        sku: true,
                        price: true,
                        attributes: {
                            include: {
                                attributeValue: {
                                    include: { attribute: true }
                                }
                            }
                        }
                    }
                },
                transactions: {
                    orderBy: { createdAt: 'desc' }
                }
            }
        });
    }

    /**
     * Lists prepared batches with filtering and pagination, automatically marking expired batches.
     */
    async getBatchList(params: TGetPreparedBatchListQuery) {
        const page = params.page || 1;
        const take = params.limit || 10;
        const skip = (page - 1) * take;

        const where: Prisma.PreparedItemBatchWhereInput = {
            deletedAt: null
        };

        if (params.productVariantId) {
            where.productVariantId = params.productVariantId;
        }

        if (params.productId) {
            where.productId = params.productId;
        }

        if (params.status) {
            where.status = params.status;
        }

        if (params.search) {
            where.OR = [
                { batchNumber: { contains: params.search } },
                { product: { name: { contains: params.search } } },
                { notes: { contains: params.search } }
            ];
        }

        if (params.expiringWithinMinutes) {
            const threshold = new Date(Date.now() + params.expiringWithinMinutes * 60 * 1000);
            where.expiresAt = {
                gte: new Date(),
                lte: threshold
            };
            where.currentQuantity = { gt: 0 };
        }

        const [data, totalRows] = await Promise.all([
            prisma.preparedItemBatch.findMany({
                where,
                skip,
                take,
                orderBy: { expiresAt: 'desc' },
                include: {
                    product: { select: { id: true, name: true, photo: true } },
                    productVariant: {
                        select: {
                            id: true,
                            sku: true,
                            price: true,
                            attributes: {
                                include: {
                                    attributeValue: {
                                        include: { attribute: true }
                                    }
                                }
                            }
                        }
                    },
                    transactions: {
                        orderBy: { createdAt: 'desc' }
                    }
                }
            }),
            prisma.preparedItemBatch.count({ where })
        ]);

        return this.formatPaginatedResult(data, totalRows, page, take);
    }

    /**
     * Disposes or writes off spoiled/expired units from a prepared batch.
     */
    async disposeBatchStock(batchId: string, data: TDisposePreparedBatch, actorId: string) {
        return prisma.$transaction(async (tx) => {
            const batch = await tx.preparedItemBatch.findUnique({
                where: { id: batchId, deletedAt: null },
                include: { product: true }
            });

            if (!batch) {
                throw new NotFoundException(`Prepared item batch with ID "${batchId}" not found`);
            }

            if (batch.currentQuantity < data.quantity) {
                throw new BadRequestException(`Cannot dispose ${data.quantity} units. Only ${batch.currentQuantity} units remaining in batch.`);
            }

            const updatedQuantity = batch.currentQuantity - data.quantity;
            let newStatus: PreparedBatchStatus = batch.status;

            if (updatedQuantity === 0) {
                newStatus = data.reason === 'EXPIRED' ? PreparedBatchStatus.EXPIRED : PreparedBatchStatus.DISPOSED;
            }

            const updatedBatch = await tx.preparedItemBatch.update({
                where: { id: batchId },
                data: {
                    currentQuantity: updatedQuantity,
                    status: newStatus,
                    updatedById: actorId,
                    transactions: {
                        create: {
                            quantityChange: -data.quantity,
                            type: data.reason,
                            reason: data.notes ?? `Disposed ${data.quantity} units (${data.reason})`,
                            createdById: actorId
                        }
                    }
                },
                include: {
                    product: { select: { id: true, name: true, photo: true } },
                    productVariant: {
                        select: {
                            id: true,
                            sku: true,
                            price: true,
                            attributes: {
                                include: {
                                    attributeValue: {
                                        include: { attribute: true }
                                    }
                                }
                            }
                        }
                    },
                    transactions: true
                }
            });

            return updatedBatch;
        });
    }

    /**
     * Deducts prepared display stock using FEFO (First-Expiring, First-Out) upon customer order.
     */
    async deductPreparedStockFEFO(
        tx: Prisma.TransactionClient,
        productVariantId: string,
        quantity: number,
        orderId: string,
        queueNumber: string | null,
        actorId: string
    ) {
        const now = new Date();

        // 1. Fetch available fresh/near-expiry batches ordered by earliest expiry
        const batches = await tx.preparedItemBatch.findMany({
            where: {
                productVariantId,
                deletedAt: null,
                currentQuantity: { gt: 0 },
                expiresAt: { gt: now }
            },
            orderBy: { expiresAt: 'asc' }
        });

        const totalAvailable = batches.reduce((sum, b) => sum + b.currentQuantity, 0);
        if (totalAvailable < quantity) {
            throw new BadRequestException(`Insufficient fresh display stock for variant. Required: ${quantity}, Available: ${totalAvailable}`);
        }

        let remainingToDeduct = quantity;

        for (const batch of batches) {
            if (remainingToDeduct <= 0) break;

            const deductFromThisBatch = Math.min(batch.currentQuantity, remainingToDeduct);
            const newQuantity = batch.currentQuantity - deductFromThisBatch;
            const newStatus = newQuantity === 0 ? PreparedBatchStatus.DEPLETED : batch.status;

            await tx.preparedItemBatch.update({
                where: { id: batch.id },
                data: {
                    currentQuantity: newQuantity,
                    status: newStatus,
                    updatedById: actorId,
                    transactions: {
                        create: {
                            quantityChange: -deductFromThisBatch,
                            type: 'SALE',
                            reason: `Order ${queueNumber ?? orderId} sale deduction`,
                            orderId,
                            createdById: actorId
                        }
                    }
                }
            });

            remainingToDeduct -= deductFromThisBatch;
        }
    }

    /**
     * Restores prepared items back to batches when an order is cancelled.
     */
    async restorePreparedStockForOrder(tx: Prisma.TransactionClient, orderId: string, actorId: string) {
        const transactions = await tx.preparedItemTransaction.findMany({
            where: { orderId, type: 'SALE' },
            include: { batch: true }
        });

        for (const trx of transactions) {
            const qtyToRestore = Math.abs(trx.quantityChange);
            const newQuantity = trx.batch.currentQuantity + qtyToRestore;
            const now = new Date();
            const isFresh = trx.batch.expiresAt > now;

            await tx.preparedItemBatch.update({
                where: { id: trx.batchId },
                data: {
                    currentQuantity: newQuantity,
                    status: isFresh ? PreparedBatchStatus.FRESH : PreparedBatchStatus.EXPIRED,
                    updatedById: actorId,
                    transactions: {
                        create: {
                            quantityChange: qtyToRestore,
                            type: 'CORRECTION',
                            reason: `Restored stock from cancelled Order ID: ${orderId}`,
                            orderId,
                            createdById: actorId
                        }
                    }
                }
            });
        }
    }

    /**
     * Checks ready-to-serve stock for a list of variant items.
     */
    async checkPreparedStockAvailability(
        tx: Prisma.TransactionClient,
        variantRequirements: Map<string, number>
    ): Promise<{
        sufficient: boolean;
        insufficientItems: { variantId: string; required: number; available: number }[];
    }> {
        const now = new Date();
        const insufficientItems: { variantId: string; required: number; available: number }[] = [];

        for (const [variantId, requiredQty] of variantRequirements.entries()) {
            const batches = await tx.preparedItemBatch.findMany({
                where: {
                    productVariantId: variantId,
                    deletedAt: null,
                    currentQuantity: { gt: 0 },
                    expiresAt: { gt: now }
                }
            });

            const availableQty = batches.reduce((sum, b) => sum + b.currentQuantity, 0);
            if (availableQty < requiredQty) {
                insufficientItems.push({
                    variantId,
                    required: requiredQty,
                    available: availableQty
                });
            }
        }

        return {
            sufficient: insufficientItems.length === 0,
            insufficientItems
        };
    }

    /**
     * Retrieves a consolidated real-time summary of display stock across all prepared items.
     */
    async getDisplayStockSummary() {
        const now = new Date();
        const nearExpiryThreshold = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours

        const variants = await prisma.productVariant.findMany({
            where: {
                deletedAt: null,
                product: {
                    preparationType: 'PREPARED_DISPLAY',
                    deletedAt: null
                }
            },
            include: {
                product: true,
                attributes: {
                    where: { deletedAt: null },
                    include: {
                        attributeValue: {
                            include: { attribute: true }
                        }
                    }
                },
                preparedBatches: {
                    where: {
                        deletedAt: null,
                        currentQuantity: { gt: 0 }
                    }
                }
            }
        });

        let grandFreshUnits = 0;
        let grandExpiringSoonUnits = 0;
        let grandExpiredUnits = 0;

        const items = variants.map((v) => {
            let totalFresh = 0;
            let totalNearExpiry = 0;
            let totalExpired = 0;
            let earliestExpiry: Date | null = null;
            let activeBatchesCount = 0;

            for (const batch of v.preparedBatches) {
                activeBatchesCount++;
                if (batch.expiresAt <= now) {
                    totalExpired += batch.currentQuantity;
                } else if (batch.expiresAt <= nearExpiryThreshold) {
                    totalNearExpiry += batch.currentQuantity;
                    totalFresh += batch.currentQuantity;
                } else {
                    totalFresh += batch.currentQuantity;
                }

                if (batch.expiresAt > now) {
                    if (!earliestExpiry || batch.expiresAt < earliestExpiry) {
                        earliestExpiry = batch.expiresAt;
                    }
                }
            }

            grandFreshUnits += totalFresh;
            grandExpiringSoonUnits += totalNearExpiry;
            grandExpiredUnits += totalExpired;

            const attrLabels = v.attributes.map((a) => a.attributeValue.value).join(', ');
            const variantLabel = attrLabels ? `${v.product.name} (${attrLabels})` : v.product.name;

            return {
                productVariantId: v.id,
                productId: v.productId,
                productName: v.product.name,
                sku: v.sku,
                price: v.price,
                variantLabel,
                totalFreshQuantity: totalFresh,
                totalNearExpiryQuantity: totalNearExpiry,
                totalExpiredQuantity: totalExpired,
                earliestExpiry,
                activeBatchesCount
            };
        });

        return {
            items,
            totalFreshUnits: grandFreshUnits,
            totalExpiringSoonUnits: grandExpiringSoonUnits,
            totalExpiredUnits: grandExpiredUnits
        };
    }
}
