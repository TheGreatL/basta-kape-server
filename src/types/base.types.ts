import { Prisma } from '@prisma/client';

export interface IPaginationParams {
    page?: number;
    limit?: number;
}

export interface IPaginatedResult<T> {
    data: T[];
    meta: {
        total: number;
        pageCount: number;
        count: number;
        currentPage: number;
        hasMore: boolean;
    };
}
export const auditSelect = {
    firstName: true,
    lastName: true,
    email: true
} satisfies Prisma.UserSelect;
