import { prisma } from '@/lib/prisma';
import { BaseRepository } from '@/repository/base.repository';
import { Prisma } from '@prisma/client';
import { auditSelect, type IPaginatedResult } from '@/types/base.types';
import type { TCreateSupplier, TUpdateSupplier, TGetSupplierListQuery } from './supplier.types';

const supplierInclude = {
    createdBy: { select: auditSelect },
    updatedBy: { select: auditSelect },
    ingredients: {
        include: {
            ingredient: {
                include: {
                    defaultUnit: true
                }
            }
        },
        orderBy: {
            ingredient: {
                name: 'asc' as const
            }
        }
    }
};

export class SupplierRepository extends BaseRepository {
    async createSupplier(data: TCreateSupplier, actorId: string, items?: { ingredientId: string; unitCost?: number }[]) {
        return prisma.supplier.create({
            data: {
                name: data.name,
                address: data.address || null,
                contactPerson: data.contactPerson || null,
                contactNumber: data.contactNumber || null,
                notes: data.notes || null,
                createdById: actorId,
                updatedById: actorId,
                ingredients:
                    items && items.length > 0
                        ? {
                              create: items.map((item) => ({
                                  ingredientId: item.ingredientId,
                                  unitCost: item.unitCost ?? 0
                              }))
                          }
                        : undefined
            },
            include: supplierInclude
        });
    }

    async updateSupplier(id: string, data: TUpdateSupplier, actorId: string, items?: { ingredientId: string; unitCost?: number }[]) {
        const updateFields: Prisma.SupplierUncheckedUpdateInput = {
            updatedById: actorId
        };
        if (data.name !== undefined) updateFields.name = data.name;
        if (data.address !== undefined) updateFields.address = data.address;
        if (data.contactPerson !== undefined) updateFields.contactPerson = data.contactPerson;
        if (data.contactNumber !== undefined) updateFields.contactNumber = data.contactNumber;
        if (data.notes !== undefined) updateFields.notes = data.notes;

        if (items !== undefined) {
            return prisma.$transaction(async (tx) => {
                await tx.supplierIngredient.deleteMany({
                    where: { supplierId: id }
                });
                if (items.length > 0) {
                    await tx.supplierIngredient.createMany({
                        data: items.map((item) => ({
                            supplierId: id,
                            ingredientId: item.ingredientId,
                            unitCost: item.unitCost ?? 0
                        }))
                    });
                }
                return tx.supplier.update({
                    where: { id },
                    data: updateFields,
                    include: supplierInclude
                });
            });
        }

        return prisma.supplier.update({
            where: { id },
            data: updateFields,
            include: supplierInclude
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
            },
            include: supplierInclude
        });
    }

    async findSupplierById(id: string) {
        return prisma.supplier.findFirst({
            where: { id, deletedAt: null },
            include: supplierInclude
        });
    }

    async findSupplierByIdIncludingDeleted(id: string) {
        return prisma.supplier.findFirst({
            where: { id },
            include: supplierInclude
        });
    }

    async findSupplierByName(name: string) {
        return prisma.supplier.findFirst({
            where: { name, deletedAt: null }
        });
    }

    async getSupplierIngredients(supplierId: string) {
        return prisma.supplierIngredient.findMany({
            where: {
                supplierId,
                ingredient: { deletedAt: null }
            },
            include: {
                ingredient: {
                    include: {
                        defaultUnit: true
                    }
                }
            },
            orderBy: {
                ingredient: { name: 'asc' }
            }
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
                include: supplierInclude
            }),
            prisma.supplier.count({ where })
        ]);

        return this.formatPaginatedResult(data, totalRows, page, take);
    }
}
