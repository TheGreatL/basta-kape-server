import { z } from 'zod';

export const GetActivityLogsQuerySchema = z.object({
    page: z.string().optional().default('1'),
    limit: z.string().optional().default('10'),
    search: z.string().optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional()
});

export const CreateActivityLogSchema = z.object({
    actorId: z.string().uuid().optional().nullable(),
    title: z.string(),
    details: z.string().optional().nullable()
});
