import { prisma } from '@/lib/prisma';
import { BaseRepository } from '@/repository/base.repository';
import type { TCreateRecipe, TUpdateRecipe } from './recipe.types';
import { auditSelect } from '@/types/base.types';

export class RecipeRepository extends BaseRepository {
    async findRecipeByVariantId(variantId: string) {
        return prisma.recipe.findFirst({
            where: { productVariantId: variantId, deletedAt: null },
            include: {
                createdBy: { select: auditSelect },
                updatedBy: { select: auditSelect },
                ingredients: {
                    where: { deletedAt: null },
                    include: {
                        ingredient: {
                            select: { id: true, name: true }
                        },
                        unit: {
                            select: { id: true, name: true, abbreviation: true }
                        }
                    }
                }
            }
        });
    }

    async findRecipeById(id: string) {
        return prisma.recipe.findFirst({
            where: { id, deletedAt: null },
            include: {
                createdBy: { select: auditSelect },
                updatedBy: { select: auditSelect },
                ingredients: {
                    where: { deletedAt: null },
                    include: {
                        ingredient: {
                            select: { id: true, name: true }
                        },
                        unit: {
                            select: { id: true, name: true, abbreviation: true }
                        }
                    }
                }
            }
        });
    }

    async findVariantById(variantId: string) {
        return prisma.productVariant.findFirst({
            where: { id: variantId, deletedAt: null },
            include: {
                product: { select: { name: true } },
                attributes: {
                    where: { deletedAt: null },
                    include: {
                        attributeValue: { select: { value: true } }
                    }
                }
            }
        });
    }

    async findIngredientById(ingredientId: string) {
        return prisma.ingredient.findFirst({
            where: { id: ingredientId, deletedAt: null }
        });
    }

    async findUnitById(unitId: string) {
        return prisma.ingredientUnit.findFirst({
            where: { id: unitId, deletedAt: null }
        });
    }

    async createRecipe(variantId: string, data: TCreateRecipe, actorId: string) {
        return prisma.$transaction(async (tx) => {
            const recipe = await tx.recipe.create({
                data: {
                    name: data.name,
                    description: data.description,
                    productVariantId: variantId,
                    createdById: actorId,
                    updatedById: actorId
                }
            });

            if (data.ingredients && data.ingredients.length > 0) {
                const recipeIngredients = data.ingredients.map((ing) => ({
                    recipeId: recipe.id,
                    ingredientId: ing.ingredientId,
                    quantity: ing.quantity,
                    ingredientUnitId: ing.ingredientUnitId,
                    createdById: actorId,
                    updatedById: actorId
                }));

                await tx.recipeIngredient.createMany({
                    data: recipeIngredients
                });
            }

            const result = await tx.recipe.findUnique({
                where: { id: recipe.id },
                include: {
                    createdBy: { select: auditSelect },
                    updatedBy: { select: auditSelect },
                    ingredients: {
                        where: { deletedAt: null },
                        include: {
                            ingredient: {
                                select: { id: true, name: true }
                            },
                            unit: {
                                select: { id: true, name: true, abbreviation: true }
                            }
                        }
                    }
                }
            });

            return result!;
        });
    }

    async updateRecipe(recipeId: string, data: TUpdateRecipe, actorId: string) {
        return prisma.$transaction(async (tx) => {
            await tx.recipe.update({
                where: { id: recipeId },
                data: {
                    name: data.name,
                    description: data.description,
                    updatedById: actorId
                }
            });

            if (data.ingredients !== undefined) {
                // Soft-delete current active ingredients
                await tx.recipeIngredient.updateMany({
                    where: { recipeId, deletedAt: null },
                    data: {
                        deletedAt: new Date(),
                        updatedById: actorId
                    }
                });

                // Insert new ingredients
                if (data.ingredients.length > 0) {
                    const recipeIngredients = data.ingredients.map((ing) => ({
                        recipeId,
                        ingredientId: ing.ingredientId,
                        quantity: ing.quantity,
                        ingredientUnitId: ing.ingredientUnitId,
                        createdById: actorId,
                        updatedById: actorId
                    }));

                    await tx.recipeIngredient.createMany({
                        data: recipeIngredients
                    });
                }
            }

            const result = await tx.recipe.findUnique({
                where: { id: recipeId },
                include: {
                    createdBy: { select: auditSelect },
                    updatedBy: { select: auditSelect },
                    ingredients: {
                        where: { deletedAt: null },
                        include: {
                            ingredient: {
                                select: { id: true, name: true }
                            },
                            unit: {
                                select: { id: true, name: true, abbreviation: true }
                            }
                        }
                    }
                }
            });

            return result!;
        });
    }

    async softDeleteRecipe(recipeId: string, actorId: string) {
        return prisma.$transaction(async (tx) => {
            const recipe = await tx.recipe.update({
                where: { id: recipeId },
                data: {
                    deletedAt: new Date(),
                    updatedById: actorId
                }
            });

            await tx.recipeIngredient.updateMany({
                where: { recipeId, deletedAt: null },
                data: {
                    deletedAt: new Date(),
                    updatedById: actorId
                }
            });

            return recipe;
        });
    }
}
