import { z } from 'zod';
import type { IPaginationParams } from '@/types/base.types';

export interface IModuleFilterParams extends IPaginationParams {
    search?: string;
}

export const GetModuleListQuerySchema = z.object({
    page: z.coerce.number().min(1).optional(),
    limit: z.coerce.number().min(1).max(50).optional(),
    search: z.string().optional()
});

export const ModuleResponseSchema = z.object({
    id: z.uuid(),
    name: z.string(),
    description: z.string().nullable(),
    createdAt: z.date().or(z.string())
});

export const PaginatedModuleResponseSchema = z.object({
    data: z.array(ModuleResponseSchema),
    meta: z.object({
        total: z.number(),
        pageCount: z.number(),
        count: z.number(),
        currentPage: z.number(),
        hasMore: z.boolean()
    })
});
