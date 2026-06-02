import { prisma } from '@/lib/prisma';
import { BaseRepository } from '@/repository/base.repository';
import { Prisma } from '@prisma/client';
import type { IPaginatedResult } from '@/types/base.types';
import { z } from 'zod';
import { GetActivityLogsQuerySchema, CreateActivityLogSchema } from './activity-log.types';

export class ActivityLogRepository extends BaseRepository {
    async create(data: z.infer<typeof CreateActivityLogSchema>) {
        return prisma.activityLog.create({
            data: {
                actorId: data.actorId,
                title: data.title,
                details: data.details
            }
        });
    }

    async getList(query: z.infer<typeof GetActivityLogsQuerySchema>): Promise<IPaginatedResult<unknown>> {
        const { skip, take, page } = this.normalizePagination({
            page: parseInt(query.page ?? '1') || 1,
            limit: parseInt(query.limit ?? '10') || 10
        });

        const where: Prisma.ActivityLogWhereInput = {};

        if (query.search) {
            where.OR = [
                { title: { contains: query.search } },
                { details: { contains: query.search } },
                { actor: { firstName: { contains: query.search } } },
                { actor: { lastName: { contains: query.search } } }
            ];
        }

        if (query.dateFrom || query.dateTo) {
            where.createdAt = {};
            if (query.dateFrom) where.createdAt.gte = new Date(query.dateFrom);
            if (query.dateTo) where.createdAt.lte = new Date(query.dateTo);
        }

        const [data, totalRows] = await Promise.all([
            prisma.activityLog.findMany({
                where,
                skip,
                take,
                orderBy: { createdAt: 'desc' },
                include: {
                    actor: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true
                        }
                    }
                }
            }),
            prisma.activityLog.count({ where })
        ]);

        return this.formatPaginatedResult(data, totalRows, page, take);
    }
}
