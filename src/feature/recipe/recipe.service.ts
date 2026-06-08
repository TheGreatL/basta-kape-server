import { RecipeRepository } from './recipe.repository';
import { ActivityLogService } from '@/feature/activity-log/activity-log.service';
import { NotFoundException, ConflictException } from '@/exceptions';
import type { TCreateRecipe, TUpdateRecipe } from './recipe.types';

type RecipeServiceConstructor = {
    recipeRepository?: RecipeRepository;
};

export class RecipeService {
    private repository: RecipeRepository;
    private activityLogService: ActivityLogService;

    constructor(options?: RecipeServiceConstructor) {
        this.repository = options?.recipeRepository ?? new RecipeRepository();
        this.activityLogService = new ActivityLogService();
    }

    async getRecipeByVariantId(variantId: string) {
        // Ensure variant exists first
        const variant = await this.repository.findVariantById(variantId);
        if (!variant) {
            throw new NotFoundException(`Product variant with ID "${variantId}" not found`);
        }

        const recipe = await this.repository.findRecipeByVariantId(variantId);
        if (!recipe) {
            throw new NotFoundException(`Recipe not found for variant ID "${variantId}"`);
        }

        return recipe;
    }

    async createRecipe(variantId: string, data: TCreateRecipe, actorId: string) {
        // 1. Ensure variant exists
        const variant = await this.repository.findVariantById(variantId);
        if (!variant) {
            throw new NotFoundException(`Product variant with ID "${variantId}" not found`);
        }

        // 2. Ensure variant doesn't already have an active recipe
        const existingRecipe = await this.repository.findRecipeByVariantId(variantId);
        if (existingRecipe) {
            throw new ConflictException(`Recipe already exists for variant ID "${variantId}"`);
        }

        // 3. Validate ingredients and units exist
        for (const ing of data.ingredients) {
            const ingredient = await this.repository.findIngredientById(ing.ingredientId);
            if (!ingredient) {
                throw new NotFoundException(`Ingredient with ID "${ing.ingredientId}" not found`);
            }

            const unit = await this.repository.findUnitById(ing.ingredientUnitId);
            if (!unit) {
                throw new NotFoundException(`Ingredient unit with ID "${ing.ingredientUnitId}" not found`);
            }
        }

        // 4. Create recipe
        const recipe = await this.repository.createRecipe(variantId, data, actorId);

        // 5. Log activity
        const variantLabel = this.getVariantLabel(variant);
        await this.activityLogService.logActivity({
            actorId,
            title: 'Create Recipe',
            details: `Successfully created recipe: ${recipe.name} for variant ${variantLabel}.`
        });

        return recipe;
    }

    async updateRecipe(variantId: string, data: TUpdateRecipe, actorId: string) {
        // 1. Get the current active recipe
        const recipe = await this.getRecipeByVariantId(variantId);

        // 2. Validate ingredients and units exist if provided
        if (data.ingredients) {
            for (const ing of data.ingredients) {
                const ingredient = await this.repository.findIngredientById(ing.ingredientId);
                if (!ingredient) {
                    throw new NotFoundException(`Ingredient with ID "${ing.ingredientId}" not found`);
                }

                const unit = await this.repository.findUnitById(ing.ingredientUnitId);
                if (!unit) {
                    throw new NotFoundException(`Ingredient unit with ID "${ing.ingredientUnitId}" not found`);
                }
            }
        }

        // 3. Update recipe
        const updated = await this.repository.updateRecipe(recipe.id, data, actorId);

        // 4. Log activity
        const variantForLog = await this.repository.findVariantById(variantId);
        const variantLabel = variantForLog ? this.getVariantLabel(variantForLog) : variantId;
        await this.activityLogService.logActivity({
            actorId,
            title: 'Update Recipe',
            details: `Successfully updated recipe: ${updated.name} for variant ${variantLabel}.`
        });

        return updated;
    }

    async deleteRecipe(variantId: string, actorId: string) {
        // 1. Get the current active recipe
        const recipe = await this.getRecipeByVariantId(variantId);

        // 2. Soft-delete
        await this.repository.softDeleteRecipe(recipe.id, actorId);

        // 3. Log activity
        const variant = await this.repository.findVariantById(variantId);
        const variantLabel = variant ? this.getVariantLabel(variant) : variantId;
        await this.activityLogService.logActivity({
            actorId,
            title: 'Delete Recipe',
            details: `Successfully deleted recipe: ${recipe.name} for variant ${variantLabel}.`
        });
    }

    async restoreRecipe(variantId: string, actorId: string) {
        const recipe = await this.repository.findRecipeByVariantIdIncludingDeleted(variantId);
        if (!recipe) {
            throw new NotFoundException(`Recipe not found for variant ID "${variantId}"`);
        }

        const restored = await this.repository.restoreRecipe(variantId, actorId);

        const variant = await this.repository.findVariantByIdIncludingDeleted(variantId);
        const variantLabel = variant ? this.getVariantLabel(variant) : variantId;

        await this.activityLogService.logActivity({
            actorId,
            title: 'Restore Recipe',
            details: `Successfully restored recipe: ${recipe.name} for variant ${variantLabel}.`
        });

        return restored;
    }

    private getVariantLabel(variant: { product: { name: string }; attributes: Array<{ attributeValue: { value: string } }> }): string {
        const attrNames = variant.attributes.map((a) => a.attributeValue.value).join(', ');
        return attrNames ? `${variant.product.name} (${attrNames})` : variant.product.name;
    }
}
