import type { IPaginatedResult, IPaginationParams } from '@/types/base.types';

export abstract class BaseRepository {
    protected readonly DEFAULT_LIMIT: number = 10;
    protected readonly MAX_LIMIT: number = 50;
    protected readonly DEFAULT_PAGE: number = 1;

    /**
     * Resolves the skip and take values required for offset-based pagination.
     */
    protected normalizePagination(params?: IPaginationParams): {
        skip: number;
        take: number;
        page: number;
    } {
        const take = Math.min(Math.max(params?.limit ?? this.DEFAULT_LIMIT, 1), this.MAX_LIMIT);
        const page = Math.max(params?.page || 1, 1);
        const skip = (page - 1) * take;

        return { skip, take, page };
    }

    /**
     * Formats an offset-based paginated response.
     */
    protected formatPaginatedResult<T>(data: T[], totalRows: number, page: number, take: number): IPaginatedResult<T> {
        return {
            data,
            meta: {
                total: totalRows,
                pageCount: Math.ceil(totalRows / take),
                count: totalRows,
                currentPage: page,
                hasMore: page * take < totalRows
            }
        };
    }
}
