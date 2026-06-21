import { prisma } from '@/lib/prisma';
import { BaseRepository } from '@/repository/base.repository';
import { Prisma } from '@prisma/client';
import { auditSelect, type IPaginatedResult } from '@/types/base.types';
import type {
    TCreateProduct,
    TUpdateProduct,
    TCreateProductVariant,
    TUpdateProductVariant,
    TGetProductListQuery,
    TBulkSyncProductVariants
} from './product.types';

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
                type: true,
                createdBy: { select: auditSelect },
                updatedBy: { select: auditSelect }
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
                type: true,
                createdBy: { select: auditSelect },
                updatedBy: { select: auditSelect }
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

                // 4. Fetch related recipes to soft-delete recipe ingredients
                const recipes = await tx.recipe.findMany({
                    where: {
                        productVariantId: { in: activeVariantIds },
                        deletedAt: null
                    },
                    select: { id: true }
                });

                const recipeIds = recipes.map((r) => r.id);

                if (recipeIds.length > 0) {
                    // Soft-delete recipe ingredients
                    await tx.recipeIngredient.updateMany({
                        where: {
                            recipeId: { in: recipeIds },
                            deletedAt: null
                        },
                        data: {
                            deletedAt: new Date(),
                            updatedById: actorId
                        }
                    });

                    // Soft-delete recipes
                    await tx.recipe.updateMany({
                        where: {
                            id: { in: recipeIds }
                        },
                        data: {
                            deletedAt: new Date(),
                            updatedById: actorId
                        }
                    });
                }

                // 5. Soft-delete related variants
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
                createdBy: { select: auditSelect },
                updatedBy: { select: auditSelect },
                variants: {
                    where: { deletedAt: null },
                    include: {
                        createdBy: { select: auditSelect },
                        updatedBy: { select: auditSelect },
                        recipe: {
                            select: { id: true, name: true }
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
                orderBy: { name: 'asc' },
                include: {
                    category: {
                        select: { id: true, name: true }
                    },
                    type: {
                        select: { id: true, name: true }
                    },
                    createdBy: { select: auditSelect },
                    updatedBy: { select: auditSelect },
                    variants: {
                        where: { deletedAt: null },
                        include: {
                            createdBy: { select: auditSelect },
                            updatedBy: { select: auditSelect },
                            recipe: {
                                select: { id: true, name: true }
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
                    createdBy: { select: auditSelect },
                    updatedBy: { select: auditSelect },
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
                    createdBy: { select: auditSelect },
                    updatedBy: { select: auditSelect },
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

            // 3. Soft-delete recipe if exists
            const recipe = await tx.recipe.findFirst({
                where: { productVariantId: id, deletedAt: null },
                select: { id: true }
            });

            if (recipe) {
                await tx.recipeIngredient.updateMany({
                    where: { recipeId: recipe.id, deletedAt: null },
                    data: {
                        deletedAt: new Date(),
                        updatedById: actorId
                    }
                });

                await tx.recipe.update({
                    where: { id: recipe.id },
                    data: {
                        deletedAt: new Date(),
                        updatedById: actorId
                    }
                });
            }

            return variant;
        });
    }

    async syncVariants(productId: string, data: TBulkSyncProductVariants, actorId: string) {
        return prisma.$transaction(async (tx) => {
            // Get all existing active variants of the product
            const existingVariants = await tx.productVariant.findMany({
                where: { productId, deletedAt: null },
                include: {
                    attributes: {
                        where: { deletedAt: null }
                    }
                }
            });

            const processedIds = new Set<string>();

            for (const item of data.variants) {
                // Determine if this variant already exists. We check if an ID is provided, or if there's a variant with matching attributeValueIds
                let match = existingVariants.find((v) => item.id && v.id === item.id);

                if (!match) {
                    // Check if there is an active variant with the exact same attribute values
                    match = existingVariants.find((v) => {
                        const existingAttrIds = v.attributes.map((a) => a.productAttributeValueId).sort();
                        const incomingAttrIds = [...item.attributeValueIds].sort();
                        return existingAttrIds.length === incomingAttrIds.length && existingAttrIds.every((val, idx) => val === incomingAttrIds[idx]);
                    });
                }

                if (match) {
                    processedIds.add(match.id);
                    // Update this variant (sku, price)
                    await tx.productVariant.update({
                        where: { id: match.id },
                        data: {
                            sku: item.sku || null,
                            price: item.price,
                            updatedById: actorId
                        }
                    });

                    // Sync attributes for this variant
                    const currentAttrValueIds = match.attributes.map((a) => a.productAttributeValueId);
                    const incomingAttrIds = item.attributeValueIds;

                    // If attributes differ, delete all and recreate
                    const sortedCurrent = [...currentAttrValueIds].sort();
                    const sortedIncoming = [...incomingAttrIds].sort();
                    const attributesChanged =
                        sortedCurrent.length !== sortedIncoming.length || !sortedCurrent.every((val, idx) => val === sortedIncoming[idx]);

                    if (attributesChanged) {
                        // Soft delete existing attributes
                        await tx.productVariantAttribute.updateMany({
                            where: { productVariantId: match.id, deletedAt: null },
                            data: {
                                deletedAt: new Date(),
                                updatedById: actorId
                            }
                        });

                        // Insert new attributes
                        if (incomingAttrIds.length > 0) {
                            await tx.productVariantAttribute.createMany({
                                data: incomingAttrIds.map((valId) => ({
                                    productVariantId: match!.id,
                                    productAttributeValueId: valId,
                                    createdById: actorId,
                                    updatedById: actorId
                                }))
                            });
                        }
                    }
                } else {
                    // Create new variant
                    const newVariant = await tx.productVariant.create({
                        data: {
                            productId,
                            sku: item.sku || null,
                            price: item.price,
                            createdById: actorId,
                            updatedById: actorId
                        }
                    });

                    processedIds.add(newVariant.id);

                    if (item.attributeValueIds.length > 0) {
                        await tx.productVariantAttribute.createMany({
                            data: item.attributeValueIds.map((valId) => ({
                                productVariantId: newVariant.id,
                                productAttributeValueId: valId,
                                createdById: actorId,
                                updatedById: actorId
                            }))
                        });
                    }
                }
            }

            // Soft-delete any existing variants that are NOT in processedIds
            const obsoleteVariants = existingVariants.filter((v) => !processedIds.has(v.id));
            if (obsoleteVariants.length > 0) {
                const obsoleteIds = obsoleteVariants.map((v) => v.id);

                // Soft-delete variants
                await tx.productVariant.updateMany({
                    where: { id: { in: obsoleteIds } },
                    data: {
                        deletedAt: new Date(),
                        updatedById: actorId
                    }
                });

                // Soft-delete attributes
                await tx.productVariantAttribute.updateMany({
                    where: { productVariantId: { in: obsoleteIds }, deletedAt: null },
                    data: {
                        deletedAt: new Date(),
                        updatedById: actorId
                    }
                });

                // Soft-delete recipes
                const recipes = await tx.recipe.findMany({
                    where: { productVariantId: { in: obsoleteIds }, deletedAt: null },
                    select: { id: true }
                });
                const recipeIds = recipes.map((r) => r.id);

                if (recipeIds.length > 0) {
                    await tx.recipeIngredient.updateMany({
                        where: { recipeId: { in: recipeIds }, deletedAt: null },
                        data: {
                            deletedAt: new Date(),
                            updatedById: actorId
                        }
                    });

                    await tx.recipe.updateMany({
                        where: { id: { in: recipeIds } },
                        data: {
                            deletedAt: new Date(),
                            updatedById: actorId
                        }
                    });
                }
            }
        });
    }

    async findVariantById(id: string) {
        return prisma.productVariant.findFirst({
            where: { id, deletedAt: null },
            include: {
                product: {
                    include: {
                        category: { select: { id: true, name: true } },
                        type: { select: { id: true, name: true } },
                        createdBy: { select: auditSelect },
                        updatedBy: { select: auditSelect }
                    }
                },
                createdBy: { select: auditSelect },
                updatedBy: { select: auditSelect },
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

    // ==========================================
    // 3. RESTORE & FIND INCLUDING DELETED METHODS
    // ==========================================

    async restoreProduct(id: string, actorId: string) {
        const product = await prisma.product.findUniqueOrThrow({
            where: { id }
        });

        if (!product.deletedAt) {
            return product;
        }

        const deleteTime = product.deletedAt;
        const timeWindowStart = new Date(deleteTime.getTime() - 5000);
        const timeWindowEnd = new Date(deleteTime.getTime() + 5000);

        return prisma.$transaction(async (tx) => {
            const restoredProduct = await tx.product.update({
                where: { id },
                data: {
                    deletedAt: null,
                    updatedById: actorId
                }
            });

            const variantsToRestore = await tx.productVariant.findMany({
                where: {
                    productId: id,
                    deletedAt: {
                        gte: timeWindowStart,
                        lte: timeWindowEnd
                    }
                },
                select: { id: true }
            });

            const variantIds = variantsToRestore.map((v) => v.id);

            if (variantIds.length > 0) {
                await tx.productVariantAttribute.updateMany({
                    where: {
                        productVariantId: { in: variantIds },
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

                const recipesToRestore = await tx.recipe.findMany({
                    where: {
                        productVariantId: { in: variantIds },
                        deletedAt: {
                            gte: timeWindowStart,
                            lte: timeWindowEnd
                        }
                    },
                    select: { id: true }
                });

                const recipeIds = recipesToRestore.map((r) => r.id);

                if (recipeIds.length > 0) {
                    await tx.recipeIngredient.updateMany({
                        where: {
                            recipeId: { in: recipeIds },
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

                    await tx.recipe.updateMany({
                        where: {
                            id: { in: recipeIds }
                        },
                        data: {
                            deletedAt: null,
                            updatedById: actorId
                        }
                    });
                }

                await tx.productVariant.updateMany({
                    where: {
                        id: { in: variantIds }
                    },
                    data: {
                        deletedAt: null,
                        updatedById: actorId
                    }
                });
            }

            return restoredProduct;
        });
    }

    async findProductByIdIncludingDeleted(id: string) {
        return prisma.product.findFirst({
            where: { id },
            include: {
                category: {
                    select: { id: true, name: true }
                },
                type: {
                    select: { id: true, name: true }
                },
                createdBy: { select: auditSelect },
                updatedBy: { select: auditSelect }
            }
        });
    }

    async restoreVariant(id: string, actorId: string) {
        const variant = await prisma.productVariant.findUniqueOrThrow({
            where: { id }
        });

        if (!variant.deletedAt) {
            return variant;
        }

        const deleteTime = variant.deletedAt;
        const timeWindowStart = new Date(deleteTime.getTime() - 5000);
        const timeWindowEnd = new Date(deleteTime.getTime() + 5000);

        return prisma.$transaction(async (tx) => {
            const restoredVariant = await tx.productVariant.update({
                where: { id },
                data: {
                    deletedAt: null,
                    updatedById: actorId
                }
            });

            await tx.productVariantAttribute.updateMany({
                where: {
                    productVariantId: id,
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

            const recipe = await tx.recipe.findFirst({
                where: {
                    productVariantId: id,
                    deletedAt: {
                        gte: timeWindowStart,
                        lte: timeWindowEnd
                    }
                },
                select: { id: true }
            });

            if (recipe) {
                await tx.recipeIngredient.updateMany({
                    where: {
                        recipeId: recipe.id,
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

                await tx.recipe.update({
                    where: { id: recipe.id },
                    data: {
                        deletedAt: null,
                        updatedById: actorId
                    }
                });
            }

            return restoredVariant;
        });
    }

    async findVariantByIdIncludingDeleted(id: string) {
        return prisma.productVariant.findFirst({
            where: { id },
            include: {
                product: {
                    include: {
                        category: { select: { id: true, name: true } },
                        type: { select: { id: true, name: true } },
                        createdBy: { select: auditSelect },
                        updatedBy: { select: auditSelect }
                    }
                },
                createdBy: { select: auditSelect },
                updatedBy: { select: auditSelect }
            }
        });
    }
}
