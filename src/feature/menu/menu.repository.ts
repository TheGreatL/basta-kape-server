import { prisma } from '@/lib/prisma';
import { BaseRepository } from '@/repository/base.repository';
import { Prisma, OrderStatus, PaymentStatus } from '@prisma/client';
import type { IPaginatedResult } from '@/types/base.types';
import type { TGetMenuQuery, TGetBestSellersQuery } from './menu.types';

export class MenuRepository extends BaseRepository {
    async getMenuList(params: TGetMenuQuery): Promise<IPaginatedResult<unknown>> {
        const { skip, take, page } = this.normalizePagination(params);
        const where: Prisma.ProductWhereInput = {
            deletedAt: null
        };

        if (params.productCategoryId) {
            where.productCategoryId = params.productCategoryId;
        }

        if (params.productTypeId) {
            where.productTypeId = params.productTypeId;
        }

        if (params.search) {
            where.OR = [{ name: { contains: params.search } }, { description: { contains: params.search } }];
        }

        const [data, totalRows] = await Promise.all([
            prisma.product.findMany({
                where,
                skip,
                take,
                orderBy: { name: 'asc' },
                include: {
                    category: { select: { id: true, name: true, description: true } },
                    type: { select: { id: true, name: true, description: true } },
                    variants: {
                        where: { deletedAt: null },
                        include: {
                            attributes: {
                                where: { deletedAt: null },
                                include: {
                                    attributeValue: {
                                        include: {
                                            attribute: { select: { id: true, name: true } }
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
                                                select: {
                                                    id: true,
                                                    name: true,
                                                    type: true,
                                                    ingredientUnitId: true,
                                                    inventories: {
                                                        where: { deletedAt: null },
                                                        select: { currentQuantity: true }
                                                    }
                                                }
                                            },
                                            unit: { select: { id: true, name: true, abbreviation: true } }
                                        }
                                    }
                                }
                            },
                            preparedBatches: {
                                where: {
                                    deletedAt: null,
                                    currentQuantity: { gt: 0 },
                                    expiresAt: { gt: new Date() }
                                },
                                select: { currentQuantity: true }
                            }
                        }
                    }
                }
            }),
            prisma.product.count({ where })
        ]);

        return this.formatPaginatedResult(data, totalRows, page, take);
    }

    async getMenuProductById(id: string) {
        return prisma.product.findFirst({
            where: { id, deletedAt: null },
            include: {
                category: { select: { id: true, name: true, description: true } },
                type: { select: { id: true, name: true, description: true } },
                variants: {
                    where: { deletedAt: null },
                    include: {
                        attributes: {
                            where: { deletedAt: null },
                            include: {
                                attributeValue: {
                                    include: {
                                        attribute: { select: { id: true, name: true } }
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
                                            select: {
                                                id: true,
                                                name: true,
                                                type: true,
                                                ingredientUnitId: true,
                                                inventories: {
                                                    where: { deletedAt: null },
                                                    select: { currentQuantity: true }
                                                }
                                            }
                                        },
                                        unit: { select: { id: true, name: true, abbreviation: true } }
                                    }
                                }
                            }
                        },
                        preparedBatches: {
                            where: {
                                deletedAt: null,
                                currentQuantity: { gt: 0 },
                                expiresAt: { gt: new Date() }
                            },
                            select: { currentQuantity: true }
                        }
                    }
                }
            }
        });
    }

    async getCategoryList(productTypeId?: string) {
        const where: Prisma.ProductCategoryWhereInput = {
            deletedAt: null
        };
        if (productTypeId) {
            where.productTypeId = productTypeId;
        }

        return prisma.productCategory.findMany({
            where,
            orderBy: { name: 'asc' },
            include: {
                type: { select: { id: true, name: true } }
            }
        });
    }

    async getTypeList() {
        return prisma.productType.findMany({
            where: { deletedAt: null },
            orderBy: { name: 'asc' },
            include: {
                categories: {
                    where: { deletedAt: null },
                    select: { id: true, name: true, description: true }
                }
            }
        });
    }

    async getBestSellingProducts(params: TGetBestSellersQuery) {
        const limit = params.limit ?? 10;

        const orderWhere: Prisma.OrderWhereInput = {
            deletedAt: null,
            status: { not: OrderStatus.CANCELLED },
            OR: [{ paymentStatus: PaymentStatus.PAID }, { status: OrderStatus.COMPLETED }]
        };

        if (params.dateFrom || params.dateTo) {
            orderWhere.createdAt = {};
            if (params.dateFrom) {
                const from = new Date(params.dateFrom);
                if (!isNaN(from.getTime())) {
                    from.setHours(0, 0, 0, 0);
                    orderWhere.createdAt.gte = from;
                }
            }
            if (params.dateTo) {
                const to = new Date(params.dateTo);
                if (!isNaN(to.getTime())) {
                    to.setHours(23, 59, 59, 999);
                    orderWhere.createdAt.lte = to;
                }
            }
        }

        const productWhere: Prisma.ProductWhereInput = {
            deletedAt: null
        };

        if (params.productCategoryId) {
            productWhere.productCategoryId = params.productCategoryId;
        }

        if (params.productTypeId) {
            productWhere.productTypeId = params.productTypeId;
        }

        const qualifyingOrderItems = await prisma.orderItem.findMany({
            where: {
                deletedAt: null,
                order: {
                    is: orderWhere
                },
                variant: {
                    deletedAt: null,
                    product: {
                        is: productWhere
                    }
                }
            },
            select: {
                quantity: true,
                totalPrice: true,
                variant: {
                    select: {
                        productId: true
                    }
                }
            }
        });

        const salesMap = new Map<string, { totalQuantitySold: number; totalRevenue: number }>();

        for (const item of qualifyingOrderItems) {
            const productId = item.variant?.productId;
            if (!productId) continue;

            const existing = salesMap.get(productId) || { totalQuantitySold: 0, totalRevenue: 0 };
            existing.totalQuantitySold += item.quantity;
            existing.totalRevenue += item.totalPrice;
            salesMap.set(productId, existing);
        }

        const sortedProductEntries = Array.from(salesMap.entries())
            .sort((a, b) => b[1].totalQuantitySold - a[1].totalQuantitySold || b[1].totalRevenue - a[1].totalRevenue)
            .slice(0, limit);

        if (sortedProductEntries.length === 0) {
            return [];
        }

        const topProductIds = sortedProductEntries.map(([productId]) => productId);

        const products = await prisma.product.findMany({
            where: {
                id: { in: topProductIds },
                deletedAt: null
            },
            include: {
                category: { select: { id: true, name: true, description: true } },
                type: { select: { id: true, name: true, description: true } },
                variants: {
                    where: { deletedAt: null },
                    include: {
                        attributes: {
                            where: { deletedAt: null },
                            include: {
                                attributeValue: {
                                    include: {
                                        attribute: { select: { id: true, name: true } }
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
                                            select: {
                                                id: true,
                                                name: true,
                                                type: true,
                                                ingredientUnitId: true,
                                                inventories: {
                                                    where: { deletedAt: null },
                                                    select: { currentQuantity: true }
                                                }
                                            }
                                        },
                                        unit: { select: { id: true, name: true, abbreviation: true } }
                                    }
                                }
                            }
                        },
                        preparedBatches: {
                            where: {
                                deletedAt: null,
                                currentQuantity: { gt: 0 },
                                expiresAt: { gt: new Date() }
                            },
                            select: { currentQuantity: true }
                        }
                    }
                }
            }
        });

        const productMap = new Map(products.map((p) => [p.id, p]));

        const result = [];
        for (const [productId, stats] of sortedProductEntries) {
            const product = productMap.get(productId);
            if (product) {
                result.push({
                    product,
                    totalQuantitySold: stats.totalQuantitySold,
                    totalRevenue: Math.round(stats.totalRevenue * 100) / 100
                });
            }
        }

        return result;
    }
}
