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
                                            ingredient: { select: { id: true, name: true } },
                                            unit: { select: { id: true, name: true, abbreviation: true } }
                                        }
                                    }
                                }
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
                                        ingredient: { select: { id: true, name: true } },
                                        unit: { select: { id: true, name: true, abbreviation: true } }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });
    }

    async getCategoryList() {
        return prisma.productCategory.findMany({
            where: { deletedAt: null },
            orderBy: { name: 'asc' },
            select: { id: true, name: true, description: true }
        });
    }

    async getTypeList() {
        return prisma.productType.findMany({
            where: { deletedAt: null },
            orderBy: { name: 'asc' },
            select: { id: true, name: true, description: true }
        });
    }
}
