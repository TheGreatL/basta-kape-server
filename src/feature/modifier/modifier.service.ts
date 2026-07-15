import { ModifierRepository } from './modifier.repository';
import { ActivityLogService } from '@/feature/activity-log/activity-log.service';
import { prisma } from '@/lib/prisma';
import { NotFoundException, BadRequestException } from '@/exceptions';
import type {
    TCreateModifierGroup,
    TUpdateModifierGroup,
    TCreateModifierOption,
    TUpdateModifierOption,
    TGetModifierGroupListQuery
} from './modifier.types';

type ModifierServiceConstructor = {
    modifierRepository?: ModifierRepository;
    activityLogService?: ActivityLogService;
};

interface IngredientWithInventory {
    id: string;
    name: string;
    inventories: {
        currentQuantity: number;
    }[];
}

interface RecipeIngredient {
    ingredientId: string;
    quantity: number;
    ingredient?: IngredientWithInventory | null;
}

interface ModifierRecipe {
    ingredients: RecipeIngredient[];
}

interface ModifierOptionWithRecipe {
    id: string;
    modifierGroupId: string;
    name: string;
    price: number;
    recipe?: ModifierRecipe | null;
}

interface ModifierGroupWithOptions {
    id: string;
    name: string;
    isRequired: boolean;
    minSelect: number;
    maxSelect: number;
    options: ModifierOptionWithRecipe[];
}

function calculateOptionMaxProduceable(option: ModifierOptionWithRecipe): number | null {
    if (!option.recipe || !option.recipe.ingredients || option.recipe.ingredients.length === 0) {
        return null;
    }

    let maxProduceable = Infinity;

    for (const ri of option.recipe.ingredients) {
        const inventories = ri.ingredient?.inventories || [];
        const inventory = inventories[0];
        const currentQty = inventory ? inventory.currentQuantity : 0;
        const requiredQty = ri.quantity;

        if (requiredQty > 0) {
            const canProduce = Math.floor(currentQty / requiredQty);
            if (canProduce < maxProduceable) {
                maxProduceable = canProduce;
            }
        }
    }

    return maxProduceable === Infinity ? null : maxProduceable;
}

function formatModifierGroup(group: ModifierGroupWithOptions) {
    return {
        ...group,
        options: (group.options || []).map((option: ModifierOptionWithRecipe) => {
            const maxProduceable = calculateOptionMaxProduceable(option);
            return {
                ...option,
                maxProduceable
            };
        })
    };
}

export class ModifierService {
    private repository: ModifierRepository;
    private activityLogService: ActivityLogService;

    constructor(deps: ModifierServiceConstructor = {}) {
        this.repository = deps.modifierRepository ?? new ModifierRepository();
        this.activityLogService = deps.activityLogService ?? new ActivityLogService();
    }

    async getModifierGroupList(params: TGetModifierGroupListQuery) {
        const result = await this.repository.getModifierGroupList(params);
        result.data = ((result.data as ModifierGroupWithOptions[]) || []).map((group) => formatModifierGroup(group));
        return result;
    }

    async getModifierGroupById(id: string) {
        const group = await this.repository.getModifierGroupById(id);
        if (!group) {
            throw new NotFoundException('Modifier group not found');
        }
        return formatModifierGroup(group as unknown as ModifierGroupWithOptions);
    }

    async getModifierOptionById(id: string) {
        const option = await this.repository.getModifierOptionById(id);
        if (!option) {
            throw new NotFoundException('Modifier option not found');
        }
        return option;
    }

    async createModifierGroup(data: TCreateModifierGroup, actorId: string) {
        // Validate min/max select compatibility
        if (data.minSelect !== undefined && data.maxSelect !== undefined && data.minSelect > data.maxSelect) {
            throw new BadRequestException('minSelect cannot be greater than maxSelect');
        }

        // Validate product existence
        if (data.productIds && data.productIds.length > 0) {
            const count = await prisma.product.count({
                where: {
                    id: { in: data.productIds },
                    deletedAt: null
                }
            });
            if (count !== data.productIds.length) {
                throw new NotFoundException('One or more associated products do not exist or are deleted.');
            }
        }

        const group = await this.repository.createModifierGroup(data);

        await this.activityLogService.logActivity({
            actorId,
            title: 'Create Modifier Group',
            details: `Created modifier group "${group.name}".`
        });

        return group;
    }

    async updateModifierGroup(id: string, data: TUpdateModifierGroup, actorId: string) {
        const group = await this.getModifierGroupById(id);

        const minSelect = data.minSelect ?? group.minSelect;
        const maxSelect = data.maxSelect ?? group.maxSelect;

        if (minSelect > maxSelect) {
            throw new BadRequestException('minSelect cannot be greater than maxSelect');
        }

        // Validate product existence if updating
        if (data.productIds && data.productIds.length > 0) {
            const count = await prisma.product.count({
                where: {
                    id: { in: data.productIds },
                    deletedAt: null
                }
            });
            if (count !== data.productIds.length) {
                throw new NotFoundException('One or more associated products do not exist or are deleted.');
            }
        }

        const updated = await this.repository.updateModifierGroup(id, data);

        await this.activityLogService.logActivity({
            actorId,
            title: 'Update Modifier Group',
            details: `Updated modifier group "${group.name}".`
        });

        return updated;
    }

    async deleteModifierGroup(id: string, actorId: string) {
        const group = await this.getModifierGroupById(id);

        await this.repository.deleteModifierGroup(id);

        await this.activityLogService.logActivity({
            actorId,
            title: 'Delete Modifier Group',
            details: `Deleted modifier group "${group.name}" and its options.`
        });
    }

    async createModifierOption(groupId: string, data: TCreateModifierOption, actorId: string) {
        const group = await this.getModifierGroupById(groupId);

        const option = await this.repository.createModifierOption(groupId, data);

        await this.activityLogService.logActivity({
            actorId,
            title: 'Create Modifier Option',
            details: `Added option "${option.name}" to modifier group "${group.name}".`
        });

        return option;
    }

    async updateModifierOption(id: string, data: TUpdateModifierOption, actorId: string) {
        const option = await this.getModifierOptionById(id);

        const updated = await this.repository.updateModifierOption(id, data);

        await this.activityLogService.logActivity({
            actorId,
            title: 'Update Modifier Option',
            details: `Updated option "${option.name}".`
        });

        return updated;
    }

    async deleteModifierOption(id: string, actorId: string) {
        const option = await this.getModifierOptionById(id);

        await this.repository.deleteModifierOption(id);

        await this.activityLogService.logActivity({
            actorId,
            title: 'Delete Modifier Option',
            details: `Deleted option "${option.name}".`
        });
    }
}
