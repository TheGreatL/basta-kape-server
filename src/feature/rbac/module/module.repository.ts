import { BaseRepository } from '@/repository/base.repository';
import type { IModuleFilterParams } from './module.types';
import type { IPaginatedResult } from '@/types/base.types';
import type { Module, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export class ModuleRepository extends BaseRepository {
    async getList(params: IModuleFilterParams): Promise<IPaginatedResult<Module>> {
        const { skip, take, page } = this.normalizePagination(params);

        const where: Prisma.ModuleWhereInput = {};

        if (params.search) {
            where.OR = [{ name: { contains: params.search } }, { description: { contains: params.search } }];
        }

        const [totalRows, data] = await prisma.$transaction([
            prisma.module.count({ where }),
            prisma.module.findMany({
                where,
                skip,
                take,
                orderBy: { name: 'asc' }
            })
        ]);

        return this.formatPaginatedResult(data, totalRows, page, take);
    }
}
