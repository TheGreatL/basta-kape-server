import { z } from 'zod';
import { AccessScope } from '@prisma/client';
import type { IPaginationParams } from '@/types/base.types';
import { TDataStatus, dataStatusEnum } from '@/constant';

export interface IRoleFilterParams extends IPaginationParams {
    search?: string;
    status?: TDataStatus;
}

export const GetRoleListQuerySchema = z.object({
    page: z.coerce.number().min(1).optional(),
    limit: z.coerce.number().min(1).max(50).optional(),
    search: z.string().optional(),
    status: z.enum(dataStatusEnum).optional()
});

export const RolePermissionAssignSchema = z.object({
    modulePermissionId: z.uuid(),
    scope: z.enum(Object.values(AccessScope) as [string, ...string[]])
});

export const CreateRoleSchema = z.object({
    name: z.string().min(2),
    description: z.string().optional(),
    permissions: z.array(RolePermissionAssignSchema).default([])
});

export const UpdateRoleSchema = CreateRoleSchema.partial().extend({
    permissions: z.array(RolePermissionAssignSchema).optional()
});

export const RoleResponseSchema = z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    isSystem: z.boolean(),
    createdAt: z.date().or(z.string()),
    updatedAt: z.date().or(z.string()),
    deletedAt: z.date().or(z.string()).nullable()
});

// A richer schema for GET /:name which includes the nested relations
export const RoleDetailResponseSchema = RoleResponseSchema.extend({
    rolePermissions: z.array(
        z.object({
            modulePermission: z.object({
                id: z.string(),
                accessScope: z.enum(Object.values(AccessScope) as [string, ...string[]]),
                module: z.object({
                    id: z.string(),
                    name: z.string()
                }),
                permission: z.object({
                    id: z.string(),
                    name: z.string()
                })
            })
        })
    )
});

export const PaginatedRoleResponseSchema = z.object({
    data: z.array(RoleResponseSchema),
    meta: z.object({
        total: z.number(),
        pageCount: z.number(),
        count: z.number(),
        currentPage: z.number(),
        hasMore: z.boolean()
    })
});

// Swagger Schema for the Selection Tree
export const SelectionTreeResponseSchema = z.array(
    z.object({
        moduleId: z.string(),
        moduleName: z.string(),
        permissions: z.array(
            z.object({
                permissionId: z.string(),
                permissionName: z.string(),
                modulePermissions: z.array(
                    z.object({
                        modulePermissionId: z.string(),
                        scope: z.enum(Object.values(AccessScope) as [string, ...string[]])
                    })
                )
            })
        )
    })
);
