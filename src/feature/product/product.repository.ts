import { prisma } from '@/lib/prisma';
import { BaseRepository } from '@/repository/base.repository';
import { Prisma } from '@prisma/client';
import type { IPaginatedResult } from '@/types/base.types';
import type { TCreateProduct, TUpdateProduct, TCreateProductVariant, TUpdateProductVariant, TGetProductListQuery } from './product.types';

export class ProductRepository extends BaseRepository {
    // ==========================================
    // 1. PRODUCT CRUD
    // ==========================================

    async createProduct(data: TCreateProduct, actorId: string) {
        return prisma.product.create({
            data: {
                name: data.name,
                photo: data.photo || null,
                description: data.description || null,
                productCategoryId: data.productCategoryId || null,
                productTypeId: data.productTypeId || null,
                createdById: actorId,
                updatedById: actorId
            },
            include: {
                category: true,
                type: true
            }
        });
    }

    async updateProduct(id: string, data: TUpdateProduct, actorId: string) {
        return prisma.product.update({
            where: { id },
            data: {
                ...data,
                updatedById: actorId
            },
            include: {
                category: true,
                type: true
            }
        });
    }

    async softDeleteProduct(id: string, actorId: string) {
        return prisma.$transaction(async (tx) => {
            // 1. Soft-delete parent product
            const product = await tx.product.update({
                where: { id },
                data: {
                    deletedAt: new Date(),
                    updatedById: actorId
                }
            });

            // 2. Fetch all related active variants to soft-delete their joins
            const activeVariants = await tx.productVariant.findMany({
                where: { productId: id, deletedAt: null },
                select: { id: true }
            });

            const activeVariantIds = activeVariants.map((v) => v.id);

            if (activeVariantIds.length > 0) {
                // 3. Soft-delete variant attribute join records
                await tx.productVariantAttribute.updateMany({
                    where: {
                        productVariantId: { in: activeVariantIds },
                        deletedAt: null
                    },
                    data: {
                        deletedAt: new Date(),
                        updatedById: actorId
                    }
                });

                // 4. Soft-delete related variants
                await tx.productVariant.updateMany({
                    where: {
                        id: { in: activeVariantIds }
                    },
                    data: {
                        deletedAt: new Date(),
                        updatedById: actorId
                    }
                });
            }

            return product;
        });
    }

    async findProductById(id: string) {
        return prisma.product.findFirst({
            where: { id, deletedAt: null },
            include: {
                category: {
                    select: { id: true, name: true }
                },
                type: {
                    select: { id: true, name: true }
                },
                variants: {
                    where: { deletedAt: null },
                    include: {
                        attributes: {
                            where: { deletedAt: null },
                            include: {
                                attributeValue: {
                                    include: {
                                        attribute: {
                                            select: { id: true, name: true }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });
    }

    async findProductByName(name: string) {
        return prisma.product.findFirst({
            where: { name, deletedAt: null }
        });
    }

    async getProductList(params: TGetProductListQuery): Promise<IPaginatedResult<unknown>> {
        const { skip, take, page } = this.normalizePagination(params);
        const where: Prisma.ProductWhereInput = {};

        if (params.status === 'active') {
            where.deletedAt = null;
        } else if (params.status === 'archive') {
            where.deletedAt = { not: null };
        }

        if (params.productCategoryId) {
            where.productCategoryId = params.productCategoryId;
        }

        if (params.productTypeId) {
            where.productTypeId = params.productTypeId;
        }

        if (params.search) {
            where.OR = [{ name: { contains: params.search } }, { description: { contains: params.search } }];
        }

        const [data, totalRows] = await Promise.all([
            prisma.product.findMany({
                where,
                skip,
                take,
                orderBy: { createdAt: 'desc' },
                include: {
                    category: {
                        select: { id: true, name: true }
                    },
                    type: {
                        select: { id: true, name: true }
                    },
                    variants: {
                        where: { deletedAt: null },
                        include: {
                            attributes: {
                                where: { deletedAt: null },
                                include: {
                                    attributeValue: {
                                        include: {
                                            attribute: {
                                                select: { id: true, name: true }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }),
            prisma.product.count({ where })
        ]);

        return this.formatPaginatedResult(data, totalRows, page, take);
    }

    // ==========================================
    // 2. PRODUCT VARIANT CRUD
    // ==========================================

    async createVariant(productId: string, data: TCreateProductVariant, actorId: string) {
        return prisma.$transaction(async (tx) => {
            // 1. Create product variant
            const variant = await tx.productVariant.create({
                data: {
                    productId,
                    sku: data.sku || null,
                    price: data.price,
                    createdById: actorId,
                    updatedById: actorId
                }
            });

            // 2. Create join mappings
            if (data.attributeValueIds && data.attributeValueIds.length > 0) {
                await tx.productVariantAttribute.createMany({
                    data: data.attributeValueIds.map((valId) => ({
                        productVariantId: variant.id,
                        productAttributeValueId: valId,
                        createdById: actorId,
                        updatedById: actorId
                    }))
                });
            }

            // 3. Retrieve fully loaded variant
            const result = await tx.productVariant.findUnique({
                where: { id: variant.id },
                include: {
                    attributes: {
                        where: { deletedAt: null },
                        include: {
                            attributeValue: {
                                include: {
                                    attribute: {
                                        select: { id: true, name: true }
                                    }
                                }
                            }
                        }
                    }
                }
            });

            return result!;
        });
    }

    async updateVariant(id: string, data: TUpdateProductVariant, actorId: string) {
        return prisma.$transaction(async (tx) => {
            const updateFields: Prisma.ProductVariantUncheckedUpdateInput = {
                updatedById: actorId
            };
            if (data.price !== undefined) {
                updateFields.price = data.price;
            }
            if (data.sku !== undefined) {
                updateFields.sku = data.sku || null;
            }

            await tx.productVariant.update({
                where: { id },
                data: updateFields
            });

            // 2. Sync dynamic attributes if provided
            if (data.attributeValueIds !== undefined) {
                // Soft-delete current active join table rows
                await tx.productVariantAttribute.updateMany({
                    where: { productVariantId: id, deletedAt: null },
                    data: {
                        deletedAt: new Date(),
                        updatedById: actorId
                    }
                });

                // Insert new active join rows
                if (data.attributeValueIds.length > 0) {
                    await tx.productVariantAttribute.createMany({
                        data: data.attributeValueIds.map((valId) => ({
                            productVariantId: id,
                            productAttributeValueId: valId,
                            createdById: actorId,
                            updatedById: actorId
                        }))
                    });
                }
            }

            // 3. Fetch and return fully loaded updated variant
            const result = await tx.productVariant.findUnique({
                where: { id },
                include: {
                    attributes: {
                        where: { deletedAt: null },
                        include: {
                            attributeValue: {
                                include: {
                                    attribute: {
                                        select: { id: true, name: true }
                                    }
                                }
                            }
                        }
                    }
                }
            });

            return result!;
        });
    }

    async softDeleteVariant(id: string, actorId: string) {
        return prisma.$transaction(async (tx) => {
            // 1. Soft-delete the variant itself
            const variant = await tx.productVariant.update({
                where: { id },
                data: {
                    deletedAt: new Date(),
                    updatedById: actorId
                }
            });

            // 2. Soft-delete variant attribute join entries
            await tx.productVariantAttribute.updateMany({
                where: { productVariantId: id, deletedAt: null },
                data: {
                    deletedAt: new Date(),
                    updatedById: actorId
                }
            });

            return variant;
        });
    }

    async findVariantById(id: string) {
        return prisma.productVariant.findFirst({
            where: { id, deletedAt: null },
            include: {
                product: {
                    include: {
                        category: { select: { id: true, name: true } },
                        type: { select: { id: true, name: true } }
                    }
                },
                attributes: {
                    where: { deletedAt: null },
                    include: {
                        attributeValue: {
                            include: {
                                attribute: {
                                    select: { id: true, name: true }
                                }
                            }
                        }
                    }
                }
            }
        });
    }

    async findVariantBySku(sku: string) {
        return prisma.productVariant.findFirst({
            where: { sku, deletedAt: null }
        });
    }
}
