import { prisma } from '@/lib/prisma';
import { BaseRepository } from '@/repository/base.repository';
import { Prisma } from '@prisma/client';
import { auditSelect, type IPaginatedResult } from '@/types/base.types';
import type { TCreateUnitConversion, TUpdateUnitConversion, TGetUnitConversionListQuery } from './unit-conversion.types';

export const unitConversionInclude = {
    fromUnit: {
        select: {
            id: true,
            name: true,
            abbreviation: true
        }
    },
    toUnit: {
        select: {
            id: true,
            name: true,
            abbreviation: true
        }
    },
    ingredient: {
        select: {
            id: true,
            name: true
        }
    },
    createdBy: { select: auditSelect },
    updatedBy: { select: auditSelect }
};

export class UnitConversionRepository extends BaseRepository {
    async createConversion(data: TCreateUnitConversion, actorId: string) {
        return prisma.unitConversion.create({
            data: {
                fromUnitId: data.fromUnitId,
                toUnitId: data.toUnitId,
                factor: data.factor,
                ingredientId: data.ingredientId || null,
                createdById: actorId,
                updatedById: actorId
            },
            include: unitConversionInclude
        });
    }

    async updateConversion(id: string, data: TUpdateUnitConversion, actorId: string) {
        return prisma.unitConversion.update({
            where: { id },
            data: {
                factor: data.factor,
                updatedById: actorId
            },
            include: unitConversionInclude
        });
    }

    async softDeleteConversion(id: string, actorId: string) {
        return prisma.unitConversion.update({
            where: { id },
            data: {
                deletedAt: new Date(),
                updatedById: actorId
            }
        });
    }

    async findConversionById(id: string) {
        return prisma.unitConversion.findFirst({
            where: { id, deletedAt: null },
            include: unitConversionInclude
        });
    }

    async findExistingConversion(fromUnitId: string, toUnitId: string, ingredientId?: string | null) {
        const targetIngredientId = ingredientId || null;
        return prisma.unitConversion.findFirst({
            where: {
                deletedAt: null,
                ingredientId: targetIngredientId,
                OR: [
                    { fromUnitId, toUnitId },
                    { fromUnitId: toUnitId, toUnitId: fromUnitId }
                ]
            }
        });
    }

    async findAllActiveConversions() {
        return prisma.unitConversion.findMany({
            where: { deletedAt: null },
            include: unitConversionInclude
        });
    }

    async getUnitConversionList(params: TGetUnitConversionListQuery): Promise<IPaginatedResult<unknown>> {
        const { skip, take, page } = this.normalizePagination(params);
        const where: Prisma.UnitConversionWhereInput = {
            deletedAt: null
        };

        if (params.fromUnitId) {
            where.fromUnitId = params.fromUnitId;
        }

        if (params.toUnitId) {
            where.toUnitId = params.toUnitId;
        }

        if (params.ingredientId !== undefined) {
            if (params.ingredientId === 'global' || params.ingredientId === 'null') {
                where.ingredientId = null;
            } else if (params.ingredientId !== 'all') {
                where.ingredientId = params.ingredientId;
            }
        }

        if (params.search) {
            where.OR = [
                { fromUnit: { name: { contains: params.search } } },
                { fromUnit: { abbreviation: { contains: params.search } } },
                { toUnit: { name: { contains: params.search } } },
                { toUnit: { abbreviation: { contains: params.search } } },
                { ingredient: { name: { contains: params.search } } }
            ];
        }

        const [data, totalRows] = await Promise.all([
            prisma.unitConversion.findMany({
                where,
                skip,
                take,
                orderBy: { createdAt: 'desc' },
                include: unitConversionInclude
            }),
            prisma.unitConversion.count({ where })
        ]);

        return this.formatPaginatedResult(data, totalRows, page, take);
    }
}
