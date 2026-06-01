import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { GetActivityLogsQuerySchema, CreateActivityLogSchema } from './activity-log.types';
import { Prisma } from '@prisma/client';

export class ActivityLogRepository {
    async create(data: z.infer<typeof CreateActivityLogSchema>) {
        return prisma.activityLog.create({
            data: {
                actorId: data.actorId,
                title: data.title,
                details: data.details
            }
        });
    }

    async getList(query: z.infer<typeof GetActivityLogsQuerySchema>) {
        const page = parseInt(query.page) || 1;
        const limit = parseInt(query.limit) || 10;
        const skip = (page - 1) * limit;

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

        const [items, totalCount] = await Promise.all([
            prisma.activityLog.findMany({
                where,
                skip,
                take: limit,
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

        return {
            items,
            meta: {
                totalCount,
                page,
                limit,
                totalPages: Math.ceil(totalCount / limit)
            }
        };
    }
}
