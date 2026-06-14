import { prisma } from '@/lib/prisma';
import { BaseRepository } from '@/repository/base.repository';
import { Prisma } from '@prisma/client';
import type {
    TCreateModifierGroup,
    TUpdateModifierGroup,
    TCreateModifierOption,
    TUpdateModifierOption,
    TGetModifierGroupListQuery
} from './modifier.types';
import type { IPaginatedResult } from '@/types/base.types';

export class ModifierRepository extends BaseRepository {
    async getModifierGroupList(params: TGetModifierGroupListQuery): Promise<IPaginatedResult<unknown>> {
        const { skip, take, page } = this.normalizePagination(params);
        const where: Prisma.ModifierGroupWhereInput = {
            deletedAt: null
        };

        if (params.search) {
            where.name = { contains: params.search };
        }

        if (params.productId) {
            where.products = {
                some: {
                    id: params.productId,
                    deletedAt: null
                }
            };
        }

        const [data, totalRows] = await Promise.all([
            prisma.modifierGroup.findMany({
                where,
                skip,
                take,
                orderBy: [{ name: 'asc' }, { createdAt: 'asc' }],
                include: {
                    options: {
                        where: { deletedAt: null },
                        orderBy: { name: 'asc' }
                    },
                    products: {
                        where: { deletedAt: null }
                    }
                }
            }),
            prisma.modifierGroup.count({ where })
        ]);

        return this.formatPaginatedResult(data, totalRows, page, take);
    }

    async getModifierGroupById(id: string) {
        return prisma.modifierGroup.findFirst({
            where: { id, deletedAt: null },
            include: {
                options: {
                    where: { deletedAt: null },
                    orderBy: { name: 'asc' }
                },
                products: {
                    where: { deletedAt: null }
                }
            }
        });
    }

    async createModifierGroup(data: TCreateModifierGroup) {
        const { productIds, ...groupData } = data;

        return prisma.modifierGroup.create({
            data: {
                ...groupData,
                products: productIds
                    ? {
                          connect: productIds.map((id) => ({ id }))
                      }
                    : undefined
            },
            include: {
                options: true,
                products: true
            }
        });
    }

    async updateModifierGroup(id: string, data: TUpdateModifierGroup) {
        const { productIds, ...groupData } = data;

        return prisma.modifierGroup.update({
            where: { id },
            data: {
                ...groupData,
                products: productIds
                    ? {
                          set: productIds.map((id) => ({ id }))
                      }
                    : undefined
            },
            include: {
                options: {
                    where: { deletedAt: null }
                },
                products: true
            }
        });
    }

    async deleteModifierGroup(id: string) {
        return prisma.$transaction(async (tx) => {
            const now = new Date();

            await tx.modifierGroup.update({
                where: { id },
                data: { deletedAt: now }
            });

            await tx.modifierOption.updateMany({
                where: { modifierGroupId: id, deletedAt: null },
                data: { deletedAt: now }
            });
        });
    }

    async getModifierOptionById(id: string) {
        return prisma.modifierOption.findFirst({
            where: { id, deletedAt: null }
        });
    }

    async createModifierOption(groupId: string, data: TCreateModifierOption) {
        return prisma.modifierOption.create({
            data: {
                modifierGroupId: groupId,
                name: data.name,
                price: data.price
            }
        });
    }

    async updateModifierOption(id: string, data: TUpdateModifierOption) {
        return prisma.modifierOption.update({
            where: { id },
            data
        });
    }

    async deleteModifierOption(id: string) {
        return prisma.modifierOption.update({
            where: { id },
            data: { deletedAt: new Date() }
        });
    }
}
