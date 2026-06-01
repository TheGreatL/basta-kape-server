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
