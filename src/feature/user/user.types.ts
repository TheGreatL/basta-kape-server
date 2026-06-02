import { dataStatus } from '@/constant';
import { z } from 'zod';

export const GetUserListQuerySchema = z.object({
    page: z.coerce.number().min(1).default(1).optional(),
    limit: z.coerce.number().min(1).max(100).default(10).optional(),
    search: z.string().optional(),
    status: z.enum(dataStatus).optional(),
    role: z.string().optional()
});

export type TGetUserListQuery = z.infer<typeof GetUserListQuerySchema>;

export const UpdateUserSchema = z.object({
    firstName: z.string().min(2).optional(),
    lastName: z.string().min(2).optional(),
    middleName: z.string().nullable().optional(),
    phoneNumber: z.string().nullable().optional(),
    roleIds: z.array(z.string().uuid()).optional()
});

export type TUpdateUser = z.infer<typeof UpdateUserSchema>;

// Shared user response to omit passwords
export const UserResponseSchema = z.object({
    id: z.string(),
    email: z.string(),
    username: z.string(),
    firstName: z.string(),
    middleName: z.string().nullable(),
    lastName: z.string(),
    phoneNumber: z.string().nullable(),
    profilePhoto: z.string().nullable(),
    createdAt: z.date().or(z.string()),
    updatedAt: z.date().or(z.string()),
    deletedAt: z.date().nullable().or(z.string().nullable()),
    userRoles: z
        .array(
            z.object({
                role: z.object({
                    id: z.string(),
                    name: z.string()
                })
            })
        )
        .optional()
});

export const PaginatedUserResponseSchema = z.object({
    data: z.array(UserResponseSchema),
    meta: z.object({
        total: z.number(),
        pageCount: z.number(),
        count: z.number(),
        currentPage: z.number(),
        hasMore: z.boolean()
    })
});
