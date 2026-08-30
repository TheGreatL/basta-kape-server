import { prisma } from '@/lib/prisma';
import { BaseRepository } from '@/repository/base.repository';
import { Prisma, TransactionType, PreparedAdjustmentType } from '@prisma/client';
import type { TGetDisposalListQuery, TGetDisposalSummaryQuery, TDisposalItemResponse, TDisposalSummaryResponse } from './disposal.types';
import type { IPaginatedResult } from '@/types/base.types';

const RAW_WASTE_TYPES: TransactionType[] = [
    TransactionType.WASTE,
    TransactionType.SPOILED,
    TransactionType.EXPIRED,
    TransactionType.THEFT,
    TransactionType.PROMOTIONAL_USE
];

const PREPARED_WASTE_TYPES: PreparedAdjustmentType[] = [
    PreparedAdjustmentType.EXPIRED,
    PreparedAdjustmentType.SPOILED,
    PreparedAdjustmentType.WASTE,
    PreparedAdjustmentType.SAMPLING,
    PreparedAdjustmentType.DISPOSED
];

export class DisposalRepository extends BaseRepository {
    /**
     * Retrieves unified paginated disposal and waste log across raw ingredients and prepared food.
     */
    async getDisposalLogs(params: TGetDisposalListQuery): Promise<IPaginatedResult<TDisposalItemResponse>> {
        const { page = 1, limit = 10, search, category = 'ALL', reason = 'ALL', startDate, endDate } = params;

        const allRecords = await this.fetchUnifiedDisposals({ search, category, reason, startDate, endDate });

        // Sort unified stream descending by timestamp
        allRecords.sort((a, b) => new Date(b.disposedAt).getTime() - new Date(a.disposedAt).getTime());

        const total = allRecords.length;
        const skip = (page - 1) * limit;
        const pagedData = allRecords.slice(skip, skip + limit);

        const pageCount = Math.ceil(total / limit) || 1;
        const hasMore = page < pageCount;

        return {
            data: pagedData,
            meta: {
                total,
                pageCount,
                count: pagedData.length,
                currentPage: page,
                hasMore
            }
        };
    }

    /**
     * Retrieves summary financial loss metrics and top wasted items.
     */
    async getDisposalSummary(params: TGetDisposalSummaryQuery): Promise<TDisposalSummaryResponse> {
        const records = await this.fetchUnifiedDisposals(params);

        let totalFinancialLoss = 0;
        let preparedFoodLoss = 0;
        let rawIngredientLoss = 0;
        let preparedFoodWastedCount = 0;
        let rawIngredientWastedCount = 0;
        const reasonBreakdown: Record<string, number> = {};

        const itemMap = new Map<
            string,
            { itemName: string; category: 'PREPARED_FOOD' | 'RAW_INGREDIENT'; totalQuantity: number; unit: string; totalCostLoss: number }
        >();

        for (const r of records) {
            totalFinancialLoss += r.estimatedCostLoss;
            reasonBreakdown[r.reason] = (reasonBreakdown[r.reason] || 0) + r.quantity;

            if (r.category === 'PREPARED_FOOD') {
                preparedFoodLoss += r.estimatedCostLoss;
                preparedFoodWastedCount += r.quantity;
            } else {
                rawIngredientLoss += r.estimatedCostLoss;
                rawIngredientWastedCount += r.quantity;
            }

            const itemKey = `${r.category}_${r.itemName}`;
            const existing = itemMap.get(itemKey);
            if (existing) {
                existing.totalQuantity += r.quantity;
                existing.totalCostLoss += r.estimatedCostLoss;
            } else {
                itemMap.set(itemKey, {
                    itemName: r.itemName,
                    category: r.category,
                    totalQuantity: r.quantity,
                    unit: r.unit,
                    totalCostLoss: r.estimatedCostLoss
                });
            }
        }

        // Top 5 wasted items by total cost loss
        const topWastedItems = Array.from(itemMap.values())
            .sort((a, b) => b.totalCostLoss - a.totalCostLoss)
            .slice(0, 5);

        return {
            totalWastedItemsCount: records.reduce((sum, r) => sum + r.quantity, 0),
            totalFinancialLoss: Math.round(totalFinancialLoss * 100) / 100,
            preparedFoodLoss: Math.round(preparedFoodLoss * 100) / 100,
            rawIngredientLoss: Math.round(rawIngredientLoss * 100) / 100,
            preparedFoodWastedCount,
            rawIngredientWastedCount,
            reasonBreakdown,
            topWastedItems
        };
    }

    /**
     * Internal helper to fetch and normalize records from both StockTransaction and PreparedItemTransaction.
     */
    private async fetchUnifiedDisposals(params: {
        search?: string;
        category?: string;
        reason?: string;
        startDate?: string;
        endDate?: string;
    }): Promise<TDisposalItemResponse[]> {
        const { search, category = 'ALL', reason = 'ALL', startDate, endDate } = params;

        const dateFilter: Prisma.DateTimeFilter = {};
        if (startDate) dateFilter.gte = new Date(startDate);
        if (endDate) dateFilter.lte = new Date(endDate);
        const hasDateFilter = Object.keys(dateFilter).length > 0;

        const promises: Promise<TDisposalItemResponse[]>[] = [];

        // 1. Fetch Raw Ingredient Waste
        if (category === 'ALL' || category === 'RAW_INGREDIENT') {
            const rawWhere: Prisma.StockTransactionWhereInput = {
                quantityChange: { lt: 0 }
            };

            if (reason !== 'ALL') {
                if (RAW_WASTE_TYPES.includes(reason as TransactionType)) {
                    rawWhere.type = reason as TransactionType;
                } else {
                    // Filter requested reason not applicable to raw ingredients
                    rawWhere.type = { in: [] };
                }
            } else {
                rawWhere.type = { in: RAW_WASTE_TYPES };
            }

            if (hasDateFilter) {
                rawWhere.createdAt = dateFilter;
            }

            if (search) {
                rawWhere.OR = [
                    { reason: { contains: search } },
                    { batch: { ingredient: { name: { contains: search } } } },
                    { batch: { batchNumber: { contains: search } } }
                ];
            }

            const rawPromise = prisma.stockTransaction
                .findMany({
                    where: rawWhere,
                    include: {
                        batch: {
                            include: {
                                ingredient: {
                                    include: { defaultUnit: true }
                                }
                            }
                        },
                        createdBy: {
                            select: { id: true, firstName: true, lastName: true, username: true }
                        }
                    }
                })
                .then((rows) =>
                    rows.map((row): TDisposalItemResponse => {
                        const qty = Math.abs(row.quantityChange);
                        const unitCost = row.batch.unitCost ?? 0;
                        const costLoss = Math.round(qty * unitCost * 100) / 100;
                        const unitName = row.batch.ingredient.defaultUnit.abbreviation || row.batch.ingredient.defaultUnit.name || 'units';

                        return {
                            id: row.id,
                            category: 'RAW_INGREDIENT',
                            itemId: row.batch.ingredientId,
                            itemName: row.batch.ingredient.name,
                            variantLabel: null,
                            batchNumber: row.batch.batchNumber || 'N/A',
                            quantity: qty,
                            unit: unitName,
                            estimatedCostLoss: costLoss,
                            reason: row.type,
                            notes: row.reason,
                            disposedAt: row.createdAt,
                            disposedBy: row.createdBy
                                ? {
                                      id: row.createdBy.id,
                                      name: `${row.createdBy.firstName} ${row.createdBy.lastName}`.trim(),
                                      username: row.createdBy.username
                                  }
                                : null
                        };
                    })
                );

            promises.push(rawPromise);
        }

        // 2. Fetch Prepared / Finished Food Disposals
        if (category === 'ALL' || category === 'PREPARED_FOOD') {
            const prepWhere: Prisma.PreparedItemTransactionWhereInput = {
                quantityChange: { lt: 0 }
            };

            if (reason !== 'ALL') {
                if (PREPARED_WASTE_TYPES.includes(reason as PreparedAdjustmentType)) {
                    prepWhere.type = reason as PreparedAdjustmentType;
                } else {
                    // Filter requested reason not applicable to prepared food
                    prepWhere.type = { in: [] };
                }
            } else {
                prepWhere.type = { in: PREPARED_WASTE_TYPES };
            }

            if (hasDateFilter) {
                prepWhere.createdAt = dateFilter;
            }

            if (search) {
                prepWhere.OR = [
                    { reason: { contains: search } },
                    { batch: { product: { name: { contains: search } } } },
                    { batch: { batchNumber: { contains: search } } }
                ];
            }

            const prepPromise = prisma.preparedItemTransaction
                .findMany({
                    where: prepWhere,
                    include: {
                        batch: {
                            include: {
                                product: true,
                                productVariant: {
                                    include: {
                                        attributes: {
                                            include: {
                                                attributeValue: {
                                                    include: { attribute: true }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        createdBy: {
                            select: { id: true, firstName: true, lastName: true, username: true }
                        }
                    }
                })
                .then((rows) =>
                    rows.map((row): TDisposalItemResponse => {
                        const qty = Math.abs(row.quantityChange);
                        const price = row.batch.productVariant.price ?? 0;
                        const costLoss = Math.round(qty * price * 100) / 100;

                        const attrValues =
                            row.batch.productVariant.attributes
                                ?.map((a) => a.attributeValue?.value)
                                .filter(Boolean)
                                .join(' / ') || '';
                        const variantLabel = attrValues ? `${row.batch.product.name} (${attrValues})` : row.batch.product.name;

                        return {
                            id: row.id,
                            category: 'PREPARED_FOOD',
                            itemId: row.batch.productVariantId,
                            itemName: row.batch.product.name,
                            variantLabel,
                            batchNumber: row.batch.batchNumber,
                            quantity: qty,
                            unit: 'pcs',
                            estimatedCostLoss: costLoss,
                            reason: row.type,
                            notes: row.reason,
                            disposedAt: row.createdAt,
                            disposedBy: row.createdBy
                                ? {
                                      id: row.createdBy.id,
                                      name: `${row.createdBy.firstName} ${row.createdBy.lastName}`.trim(),
                                      username: row.createdBy.username
                                  }
                                : null
                        };
                    })
                );

            promises.push(prepPromise);
        }

        const results = await Promise.all(promises);
        return results.flat();
    }
}
