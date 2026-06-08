import { prisma } from '@/lib/prisma';
import { BaseRepository } from '@/repository/base.repository';
import { Prisma } from '@prisma/client';
import { auditSelect, type IPaginatedResult } from '@/types/base.types';
import type {
    TCreateCategory,
    TUpdateCategory,
    TCreateType,
    TUpdateType,
    TCreateAttribute,
    TUpdateAttribute,
    TCreateAttributeValue,
    TUpdateAttributeValue,
    TGetListQuery
} from './product-settings.types';

export class ProductSettingsRepository extends BaseRepository {
    // ==========================================
    // 1. PRODUCT CATEGORY CRUD
    // ==========================================

    async createCategory(data: TCreateCategory, actorId: string) {
        return prisma.productCategory.create({
            data: {
                name: data.name,
                description: data.description,
                createdById: actorId,
                updatedById: actorId
            },
            include: {
                createdBy: { select: auditSelect },
                updatedBy: { select: auditSelect }
            }
        });
    }

    async updateCategory(id: string, data: TUpdateCategory, actorId: string) {
        return prisma.productCategory.update({
            where: { id },
            data: {
                ...data,
                updatedById: actorId
            },
            include: {
                createdBy: { select: auditSelect },
                updatedBy: { select: auditSelect }
            }
        });
    }

    async softDeleteCategory(id: string, actorId: string) {
        return prisma.productCategory.update({
            where: { id },
            data: {
                deletedAt: new Date(),
                updatedById: actorId
            }
        });
    }

    async findCategoryById(id: string) {
        return prisma.productCategory.findFirst({
            where: { id, deletedAt: null },
            include: {
                createdBy: { select: auditSelect },
                updatedBy: { select: auditSelect }
            }
        });
    }

    async findCategoryByName(name: string) {
        return prisma.productCategory.findFirst({
            where: { name, deletedAt: null }
        });
    }

    async getCategoryList(params: TGetListQuery): Promise<IPaginatedResult<unknown>> {
        const { skip, take, page } = this.normalizePagination(params);
        const where: Prisma.ProductCategoryWhereInput = {};

        if (params.status === 'active') {
            where.deletedAt = null;
        } else if (params.status === 'archive') {
            where.deletedAt = { not: null };
        }

        if (params.search) {
            where.OR = [{ name: { contains: params.search } }, { description: { contains: params.search } }];
        }

        const [data, totalRows] = await Promise.all([
            prisma.productCategory.findMany({
                where,
                skip,
                take,
                orderBy: { createdAt: 'desc' },
                include: {
                    createdBy: { select: auditSelect },
                    updatedBy: { select: auditSelect }
                }
            }),
            prisma.productCategory.count({ where })
        ]);

        return this.formatPaginatedResult(data, totalRows, page, take);
    }

    // ==========================================
    // 2. PRODUCT TYPE CRUD
    // ==========================================

    async createType(data: TCreateType, actorId: string) {
        return prisma.productType.create({
            data: {
                name: data.name,
                description: data.description,
                createdById: actorId,
                updatedById: actorId
            },
            include: {
                createdBy: { select: auditSelect },
                updatedBy: { select: auditSelect }
            }
        });
    }

    async updateType(id: string, data: TUpdateType, actorId: string) {
        return prisma.productType.update({
            where: { id },
            data: {
                ...data,
                updatedById: actorId
            },
            include: {
                createdBy: { select: auditSelect },
                updatedBy: { select: auditSelect }
            }
        });
    }

    async softDeleteType(id: string, actorId: string) {
        return prisma.productType.update({
            where: { id },
            data: {
                deletedAt: new Date(),
                updatedById: actorId
            }
        });
    }

    async findTypeById(id: string) {
        return prisma.productType.findFirst({
            where: { id, deletedAt: null },
            include: {
                createdBy: { select: auditSelect },
                updatedBy: { select: auditSelect }
            }
        });
    }

    async findTypeByName(name: string) {
        return prisma.productType.findFirst({
            where: { name, deletedAt: null }
        });
    }

    async getTypeList(params: TGetListQuery): Promise<IPaginatedResult<unknown>> {
        const { skip, take, page } = this.normalizePagination(params);
        const where: Prisma.ProductTypeWhereInput = {};

        if (params.status === 'active') {
            where.deletedAt = null;
        } else if (params.status === 'archive') {
            where.deletedAt = { not: null };
        }

        if (params.search) {
            where.OR = [{ name: { contains: params.search } }, { description: { contains: params.search } }];
        }

        const [data, totalRows] = await Promise.all([
            prisma.productType.findMany({
                where,
                skip,
                take,
                orderBy: { createdAt: 'desc' },
                include: {
                    createdBy: { select: auditSelect },
                    updatedBy: { select: auditSelect }
                }
            }),
            prisma.productType.count({ where })
        ]);

        return this.formatPaginatedResult(data, totalRows, page, take);
    }

    // ==========================================
    // 3. PRODUCT ATTRIBUTE CRUD
    // ==========================================

    async createAttribute(data: TCreateAttribute, actorId: string) {
        return prisma.productAttribute.create({
            data: {
                name: data.name,
                description: data.description,
                createdById: actorId,
                updatedById: actorId
            },
            include: {
                createdBy: { select: auditSelect },
                updatedBy: { select: auditSelect }
            }
        });
    }

    async updateAttribute(id: string, data: TUpdateAttribute, actorId: string) {
        return prisma.productAttribute.update({
            where: { id },
            data: {
                ...data,
                updatedById: actorId
            },
            include: {
                createdBy: { select: auditSelect },
                updatedBy: { select: auditSelect }
            }
        });
    }

    async softDeleteAttribute(id: string, actorId: string) {
        return prisma.$transaction(async (tx) => {
            const attribute = await tx.productAttribute.update({
                where: { id },
                data: {
                    deletedAt: new Date(),
                    updatedById: actorId
                }
            });

            await tx.productAttributeValue.updateMany({
                where: { productAttributeId: id, deletedAt: null },
                data: {
                    deletedAt: new Date(),
                    updatedById: actorId
                }
            });

            return attribute;
        });
    }

    async findAttributeById(id: string) {
        return prisma.productAttribute.findFirst({
            where: { id, deletedAt: null },
            include: {
                createdBy: { select: auditSelect },
                updatedBy: { select: auditSelect }
            }
        });
    }

    async findAttributeByName(name: string) {
        return prisma.productAttribute.findFirst({
            where: { name, deletedAt: null }
        });
    }

    async getAttributeList(params: TGetListQuery): Promise<IPaginatedResult<unknown>> {
        const { skip, take, page } = this.normalizePagination(params);
        const where: Prisma.ProductAttributeWhereInput = {};

        if (params.status === 'active') {
            where.deletedAt = null;
        } else if (params.status === 'archive') {
            where.deletedAt = { not: null };
        }

        if (params.search) {
            where.OR = [{ name: { contains: params.search } }, { description: { contains: params.search } }];
        }

        const [data, totalRows] = await Promise.all([
            prisma.productAttribute.findMany({
                where,
                skip,
                take,
                orderBy: { createdAt: 'desc' },
                include: {
                    createdBy: { select: auditSelect },
                    updatedBy: { select: auditSelect }
                }
            }),
            prisma.productAttribute.count({ where })
        ]);

        return this.formatPaginatedResult(data, totalRows, page, take);
    }

    // ==========================================
    // 4. PRODUCT ATTRIBUTE VALUE CRUD
    // ==========================================

    async createAttributeValue(data: TCreateAttributeValue, actorId: string) {
        return prisma.productAttributeValue.create({
            data: {
                productAttributeId: data.productAttributeId,
                value: data.value,
                createdById: actorId,
                updatedById: actorId
            },
            include: {
                createdBy: { select: auditSelect },
                updatedBy: { select: auditSelect }
            }
        });
    }

    async updateAttributeValue(id: string, data: TUpdateAttributeValue, actorId: string) {
        return prisma.productAttributeValue.update({
            where: { id },
            data: {
                value: data.value,
                updatedById: actorId
            },
            include: {
                createdBy: { select: auditSelect },
                updatedBy: { select: auditSelect }
            }
        });
    }

    async softDeleteAttributeValue(id: string, actorId: string) {
        return prisma.productAttributeValue.update({
            where: { id },
            data: {
                deletedAt: new Date(),
                updatedById: actorId
            }
        });
    }

    async findAttributeValueById(id: string) {
        return prisma.productAttributeValue.findFirst({
            where: { id, deletedAt: null },
            include: {
                createdBy: { select: auditSelect },
                updatedBy: { select: auditSelect }
            }
        });
    }

    async findDuplicateAttributeValue(attributeId: string, value: string) {
        return prisma.productAttributeValue.findFirst({
            where: {
                productAttributeId: attributeId,
                value,
                deletedAt: null
            }
        });
    }

    async getAttributeValueList(attributeId: string, params: TGetListQuery): Promise<IPaginatedResult<unknown>> {
        const { skip, take, page } = this.normalizePagination(params);
        const where: Prisma.ProductAttributeValueWhereInput = {
            productAttributeId: attributeId
        };

        if (params.status === 'active') {
            where.deletedAt = null;
        } else if (params.status === 'archive') {
            where.deletedAt = { not: null };
        }

        if (params.search) {
            where.value = { contains: params.search };
        }

        const [data, totalRows] = await Promise.all([
            prisma.productAttributeValue.findMany({
                where,
                skip,
                take,
                orderBy: { createdAt: 'desc' },
                include: {
                    createdBy: { select: auditSelect },
                    updatedBy: { select: auditSelect }
                }
            }),
            prisma.productAttributeValue.count({ where })
        ]);

        return this.formatPaginatedResult(data, totalRows, page, take);
    }

    // ==========================================
    // 5. RESTORE & FIND INCLUDING DELETED METHODS
    // ==========================================

    async restoreCategory(id: string, actorId: string) {
        return prisma.productCategory.update({
            where: { id },
            data: {
                deletedAt: null,
                updatedById: actorId
            }
        });
    }

    async findCategoryByIdIncludingDeleted(id: string) {
        return prisma.productCategory.findFirst({
            where: { id },
            include: {
                createdBy: { select: auditSelect },
                updatedBy: { select: auditSelect }
            }
        });
    }

    async restoreType(id: string, actorId: string) {
        return prisma.productType.update({
            where: { id },
            data: {
                deletedAt: null,
                updatedById: actorId
            }
        });
    }

    async findTypeByIdIncludingDeleted(id: string) {
        return prisma.productType.findFirst({
            where: { id },
            include: {
                createdBy: { select: auditSelect },
                updatedBy: { select: auditSelect }
            }
        });
    }

    async restoreAttribute(id: string, actorId: string) {
        const attribute = await prisma.productAttribute.findUniqueOrThrow({
            where: { id }
        });

        if (!attribute.deletedAt) {
            return attribute;
        }

        const deleteTime = attribute.deletedAt;
        const timeWindowStart = new Date(deleteTime.getTime() - 5000);
        const timeWindowEnd = new Date(deleteTime.getTime() + 5000);

        return prisma.$transaction(async (tx) => {
            const updatedAttr = await tx.productAttribute.update({
                where: { id },
                data: {
                    deletedAt: null,
                    updatedById: actorId
                }
            });

            await tx.productAttributeValue.updateMany({
                where: {
                    productAttributeId: id,
                    deletedAt: {
                        gte: timeWindowStart,
                        lte: timeWindowEnd
                    }
                },
                data: {
                    deletedAt: null,
                    updatedById: actorId
                }
            });

            return updatedAttr;
        });
    }

    async findAttributeByIdIncludingDeleted(id: string) {
        return prisma.productAttribute.findFirst({
            where: { id },
            include: {
                createdBy: { select: auditSelect },
                updatedBy: { select: auditSelect }
            }
        });
    }

    async restoreAttributeValue(id: string, actorId: string) {
        return prisma.productAttributeValue.update({
            where: { id },
            data: {
                deletedAt: null,
                updatedById: actorId
            }
        });
    }

    async findAttributeValueByIdIncludingDeleted(id: string) {
        return prisma.productAttributeValue.findFirst({
            where: { id },
            include: {
                createdBy: { select: auditSelect },
                updatedBy: { select: auditSelect }
            }
        });
    }
}
