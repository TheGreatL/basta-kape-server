import { BaseRepository } from '@/repository/base.repository';
import type { IPermissionFilterParams } from './permission.types';
import type { IPaginatedResult } from '@/types/base.types';
import type { Permission, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export class PermissionRepository extends BaseRepository {
    async getList(params: IPermissionFilterParams): Promise<IPaginatedResult<Permission>> {
        const { skip, take, page } = this.normalizePagination(params);

        const where: Prisma.PermissionWhereInput = {};

        if (params.search) {
            where.OR = [{ name: { contains: params.search } }, { description: { contains: params.search } }];
        }

        const [totalRows, data] = await prisma.$transaction([
            prisma.permission.count({ where }),
            prisma.permission.findMany({
                where,
                skip,
                take,
                orderBy: { name: 'asc' }
            })
        ]);

        return this.formatPaginatedResult(data, totalRows, page, take);
    }
}
