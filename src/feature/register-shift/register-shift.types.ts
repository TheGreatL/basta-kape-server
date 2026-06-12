import { z } from 'zod';

export const OpenShiftSchema = z.object({
    startBalance: z.number().nonnegative().default(0),
    notes: z.string().max(1000).optional().nullable()
});

export type TOpenShift = z.infer<typeof OpenShiftSchema>;

export const CloseShiftSchema = z.object({
    actualBalance: z.number().nonnegative(),
    notes: z.string().max(1000).optional().nullable()
});

export type TCloseShift = z.infer<typeof CloseShiftSchema>;

export const RegisterShiftResponseSchema = z.object({
    id: z.string(),
    cashierId: z.string(),
    openedAt: z.date().or(z.string()),
    closedAt: z.date().nullable().or(z.string().nullable()),
    startBalance: z.number(),
    endBalance: z.number().nullable(),
    actualBalance: z.number().nullable(),
    notes: z.string().nullable(),
    cashier: z
        .object({
            id: z.string(),
            username: z.string(),
            firstName: z.string(),
            lastName: z.string()
        })
        .optional()
});

export type TRegisterShiftResponse = z.infer<typeof RegisterShiftResponseSchema>;

export const GetRegisterShiftListQuerySchema = z.object({
    page: z.coerce.number().min(1).default(1).optional(),
    limit: z.coerce.number().min(1).max(100).default(10).optional(),
    search: z.string().optional()
});

export type TGetRegisterShiftListQuery = z.infer<typeof GetRegisterShiftListQuerySchema>;

export const PaginatedRegisterShiftResponseSchema = z.object({
    data: z.array(RegisterShiftResponseSchema),
    meta: z.object({
        total: z.number(),
        pageCount: z.number(),
        count: z.number(),
        currentPage: z.number(),
        hasMore: z.boolean()
    })
});

export type TPaginatedRegisterShiftResponse = z.infer<typeof PaginatedRegisterShiftResponseSchema>;
