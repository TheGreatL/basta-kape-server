import { prisma } from '@/lib/prisma';
import { BaseRepository } from '@/repository/base.repository';
import { Prisma } from '@prisma/client';
import { auditSelect, type IPaginatedResult } from '@/types/base.types';
import type { TCreateSupplier, TUpdateSupplier, TGetSupplierListQuery } from './supplier.types';

export class SupplierRepository extends BaseRepository {
    async createSupplier(data: TCreateSupplier, actorId: string) {
        return prisma.supplier.create({
            data: {
                name: data.name,
                address: data.address || null,
                contactPerson: data.contactPerson || null,
                contactNumber: data.contactNumber || null,
                notes: data.notes || null,
                createdById: actorId,
                updatedById: actorId
            },
            include: {
                createdBy: { select: auditSelect },
                updatedBy: { select: auditSelect }
            }
        });
    }

    async updateSupplier(id: string, data: TUpdateSupplier, actorId: string) {
        const updateFields: Prisma.SupplierUncheckedUpdateInput = {
            updatedById: actorId
        };
        if (data.name !== undefined) updateFields.name = data.name;
        if (data.address !== undefined) updateFields.address = data.address;
        if (data.contactPerson !== undefined) updateFields.contactPerson = data.contactPerson;
        if (data.contactNumber !== undefined) updateFields.contactNumber = data.contactNumber;
        if (data.notes !== undefined) updateFields.notes = data.notes;

        return prisma.supplier.update({
            where: { id },
            data: updateFields,
            include: {
                createdBy: { select: auditSelect },
                updatedBy: { select: auditSelect }
            }
        });
    }

    async softDeleteSupplier(id: string, actorId: string) {
        return prisma.supplier.update({
            where: { id },
            data: {
                deletedAt: new Date(),
                updatedById: actorId
            }
        });
    }

    async restoreSupplier(id: string, actorId: string) {
        return prisma.supplier.update({
            where: { id },
            data: {
                deletedAt: null,
                updatedById: actorId
            }
        });
    }

    async findSupplierById(id: string) {
        return prisma.supplier.findFirst({
            where: { id, deletedAt: null },
            include: {
                createdBy: { select: auditSelect },
                updatedBy: { select: auditSelect }
            }
        });
    }

    async findSupplierByIdIncludingDeleted(id: string) {
        return prisma.supplier.findFirst({
            where: { id },
            include: {
                createdBy: { select: auditSelect },
                updatedBy: { select: auditSelect }
            }
        });
    }

    async findSupplierByName(name: string) {
        return prisma.supplier.findFirst({
            where: { name, deletedAt: null }
        });
    }

    async getSupplierList(params: TGetSupplierListQuery): Promise<IPaginatedResult<unknown>> {
        const { skip, take, page } = this.normalizePagination(params);
        const where: Prisma.SupplierWhereInput = {};

        if (params.status === 'active') {
            where.deletedAt = null;
        } else if (params.status === 'archive') {
            where.deletedAt = { not: null };
        }

        if (params.search) {
            where.OR = [
                { name: { contains: params.search } },
                { contactPerson: { contains: params.search } },
                { contactNumber: { contains: params.search } },
                { address: { contains: params.search } }
            ];
        }

        const [data, totalRows] = await Promise.all([
            prisma.supplier.findMany({
                where,
                skip,
                take,
                orderBy: { name: 'asc' },
                include: {
                    createdBy: { select: auditSelect },
                    updatedBy: { select: auditSelect }
                }
            }),
            prisma.supplier.count({ where })
        ]);

        return this.formatPaginatedResult(data, totalRows, page, take);
    }
}
