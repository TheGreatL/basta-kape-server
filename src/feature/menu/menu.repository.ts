import { prisma } from '@/lib/prisma';
import { BaseRepository } from '@/repository/base.repository';
import { Prisma } from '@prisma/client';
import type { IPaginatedResult } from '@/types/base.types';
import type { TGetMenuQuery } from './menu.types';

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
}
