import { BaseRepository } from '@/repository/base.repository';
import type { IRoleFilterParams } from './role.types';
import { auditSelect, type IPaginatedResult } from '@/types/base.types';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

// Shared select shape for role responses
const roleSelect = {
    id: true,
    name: true,
    description: true,
    isSystem: true,
    createdAt: true,
    updatedAt: true,
    deletedAt: true,
    createdBy: { select: auditSelect },
    updatedBy: { select: auditSelect }
} satisfies Prisma.RoleSelect;

// Shared select shape for role with permissions
const roleWithPermissionsSelect = {
    ...roleSelect,
    rolePermissions: {
        select: {
            modulePermission: {
                select: {
                    id: true,
                    accessScope: true,
                    module: { select: { name: true, description: true } },
                    permission: { select: { name: true, description: true } }
                }
            }
        }
    }
} satisfies Prisma.RoleSelect;

// Derive the actual result types from the select shapes
export type TRoleRow = Prisma.RoleGetPayload<{ select: typeof roleSelect }>;
export type TRoleWithPermissions = Prisma.RoleGetPayload<{ select: typeof roleWithPermissionsSelect }>;

export class RoleRepository extends BaseRepository {
    async getList(params: IRoleFilterParams): Promise<IPaginatedResult<TRoleRow>> {
        const { skip, take, page } = this.normalizePagination(params);

        const where: Prisma.RoleWhereInput = {};

        // By default, if no status is provided, we return ALL roles (both active and archived).
        if (params.status === 'active') {
            where.deletedAt = null;
        } else if (params.status === 'archive') {
            where.deletedAt = { not: null };
        }

        if (params.search) {
            where.OR = [{ name: { contains: params.search } }, { description: { contains: params.search } }];
        }

        const [totalRows, data] = await prisma.$transaction([
            prisma.role.count({ where }),
            prisma.role.findMany({
                where,
                skip,
                take,
                orderBy: { name: 'asc' },
                select: roleSelect
            })
        ]);

        return this.formatPaginatedResult(data, totalRows, page, take);
    }

    async getRoleByName(name: string) {
        return prisma.role.findFirst({
            where: { name, deletedAt: null },
            select: roleWithPermissionsSelect
        });
    }

    async getRoleById(id: string) {
        return prisma.role.findFirst({
            where: { id, deletedAt: null },
            select: roleSelect
        });
    }

    async findByName(name: string) {
        return prisma.role.findFirst({
            where: { name, deletedAt: null },
            select: roleSelect
        });
    }

    async validateModulePermissionIds(ids: string[]): Promise<string[]> {
        if (ids.length === 0) return [];
        const found = await prisma.modulePermission.findMany({
            where: { id: { in: ids } },
            select: { id: true }
        });
        const foundIds = found.map((mp) => mp.id);
        return ids.filter((id) => !foundIds.includes(id));
    }

    async createRole(data: { name: string; description?: string }, modulePermissionIds: string[]) {
        const rolePermissionsData = modulePermissionIds.map((mpId) => ({
            modulePermissionId: mpId
        }));

        return prisma.role.create({
            data: {
                name: data.name,
                description: data.description,
                isSystem: false,
                rolePermissions: {
                    create: rolePermissionsData
                }
            },
            select: roleSelect
        });
    }

    async updateRole(id: string, data: { name?: string; description?: string }, modulePermissionIds?: string[]) {
        const updateData: Prisma.RoleUpdateInput = {
            name: data.name,
            description: data.description
        };

        if (modulePermissionIds) {
            updateData.rolePermissions = {
                deleteMany: {},
                create: modulePermissionIds.map((mpId) => ({
                    modulePermissionId: mpId
                }))
            };
        }

        return prisma.role.update({
            where: { id },
            data: updateData,
            select: roleSelect
        });
    }

    async deleteRole(id: string) {
        return prisma.role.update({
            where: { id },
            data: { deletedAt: new Date() },
            select: roleSelect
        });
    }

    async restoreRole(id: string) {
        return prisma.role.update({
            where: { id },
            data: { deletedAt: null },
            select: roleSelect
        });
    }

    async findRoleByIdIncludingDeleted(id: string) {
        return prisma.role.findFirst({
            where: { id },
            select: roleSelect
        });
    }
}
