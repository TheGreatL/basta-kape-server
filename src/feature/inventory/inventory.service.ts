import { InventoryRepository } from './inventory.repository';
import { ActivityLogService } from '@/feature/activity-log/activity-log.service';
import { prisma } from '@/lib/prisma';
import { NotFoundException, ConflictException } from '@/exceptions';
import type {
    TCreateIngredientUnit,
    TUpdateIngredientUnit,
    TCreateIngredient,
    TUpdateIngredient,
    TCreateDelivery,
    TCreateAdjustment,
    TGetListQuery,
    TGetStockLevelListQuery
} from './inventory.types';

export class InventoryService {
    private repository: InventoryRepository;
    private activityLogService: ActivityLogService;

    constructor() {
        this.repository = new InventoryRepository();
        this.activityLogService = new ActivityLogService();
    }

    // ==========================================
    // 1. INGREDIENT UNIT SERVICES
    // ==========================================

    async getUnitList(params: TGetListQuery) {
        return this.repository.getUnitList(params);
    }

    async getUnitById(id: string) {
        const unit = await this.repository.findUnitById(id);
        if (!unit) {
            throw new NotFoundException('Ingredient unit not found');
        }
        return unit;
    }

    async createUnit(data: TCreateIngredientUnit, actorId: string) {
        const existing = await this.repository.findUnitByNameOrAbbrev(data.name, data.abbreviation);
        if (existing) {
            throw new ConflictException(`Ingredient unit with name "${data.name}" or abbreviation already exists`);
        }

        const unit = await this.repository.createUnit(data, actorId);

        await this.activityLogService.logActivity({
            actorId,
            title: 'Create Ingredient Unit',
            details: `Successfully created ingredient unit: ${unit.name}.`
        });

        return unit;
    }

    async updateUnit(id: string, data: TUpdateIngredientUnit, actorId: string) {
        const unit = await this.getUnitById(id);

        if ((data.name && data.name !== unit.name) || (data.abbreviation && data.abbreviation !== unit.abbreviation)) {
            const existing = await this.repository.findUnitByNameOrAbbrev(data.name || '', data.abbreviation);
            if (existing && existing.id !== id) {
                throw new ConflictException(`Ingredient unit name or abbreviation conflicts with an existing unit`);
            }
        }

        const updated = await this.repository.updateUnit(id, data, actorId);

        await this.activityLogService.logActivity({
            actorId,
            title: 'Update Ingredient Unit',
            details: `Successfully updated ingredient unit: ${unit.name} -> ${updated.name}.`
        });

        return updated;
    }

    async deleteUnit(id: string, actorId: string) {
        const unit = await this.getUnitById(id);

        await this.repository.softDeleteUnit(id, actorId);

        await this.activityLogService.logActivity({
            actorId,
            title: 'Delete Ingredient Unit',
            details: `Successfully deleted ingredient unit: ${unit.name}.`
        });
    }

    // ==========================================
    // 2. INGREDIENT SERVICES
    // ==========================================

    async getIngredientList(params: TGetListQuery) {
        return this.repository.getIngredientList(params);
    }

    async getIngredientById(id: string) {
        const ingredient = await this.repository.findIngredientById(id);
        if (!ingredient) {
            throw new NotFoundException('Ingredient not found');
        }
        return ingredient;
    }

    async createIngredient(data: TCreateIngredient, actorId: string) {
        // Ensure unit exists first
        await this.getUnitById(data.ingredientUnitId);

        const existing = await this.repository.findIngredientByName(data.name);
        if (existing) {
            throw new ConflictException(`Ingredient with name "${data.name}" already exists`);
        }

        const ingredient = await this.repository.createIngredient(data, actorId);

        await this.activityLogService.logActivity({
            actorId,
            title: 'Create Ingredient',
            details: `Successfully registered new raw ingredient: ${ingredient.name}.`
        });

        return ingredient;
    }

    async updateIngredient(id: string, data: TUpdateIngredient, actorId: string) {
        const ingredient = await this.getIngredientById(id);

        if (data.ingredientUnitId) {
            await this.getUnitById(data.ingredientUnitId);
        }

        if (data.name && data.name !== ingredient.name) {
            const existing = await this.repository.findIngredientByName(data.name);
            if (existing && existing.id !== id) {
                throw new ConflictException(`Ingredient with name "${data.name}" already exists`);
            }
        }

        const updated = await this.repository.updateIngredient(id, data, actorId);

        await this.activityLogService.logActivity({
            actorId,
            title: 'Update Ingredient',
            details: `Successfully updated raw ingredient properties for ${ingredient.name}.`
        });

        return updated;
    }

    async deleteIngredient(id: string, actorId: string) {
        const ingredient = await this.getIngredientById(id);

        await this.repository.softDeleteIngredient(id, actorId);

        await this.activityLogService.logActivity({
            actorId,
            title: 'Delete Ingredient',
            details: `Successfully deleted raw ingredient: ${ingredient.name} and archived its inventory record.`
        });
    }

    // ==========================================
    // 3. PHYSICAL COUNT UPDATES
    // ==========================================

    async getInventoryLevelsList(params: TGetStockLevelListQuery) {
        return this.repository.getInventoryLevelsList(params);
    }

    async getInventoryLevelByIngredientId(ingredientId: string) {
        const level = await this.repository.getInventoryLevelByIngredientId(ingredientId);
        if (!level) {
            throw new NotFoundException('Inventory level record not found for this ingredient');
        }
        return level;
    }

    async updatePhysicalCount(ingredientId: string, currentQuantity: number, actorId: string) {
        const ingredient = await this.getIngredientById(ingredientId);

        // Atomically set physical count and recalculate status
        const updatedInventory = await this.repository.adjustStockAndStatus(
            ingredientId,
            currentQuantity,
            true, // isPhysicalCount
            actorId
        );

        await this.activityLogService.logActivity({
            actorId,
            title: 'Update Physical Count',
            details: `Performed physical inventory count for ${ingredient.name}: set exact quantity to ${currentQuantity} ${ingredient.defaultUnit.abbreviation || ingredient.defaultUnit.name} (Alert: ${updatedInventory.status}).`
        });

        return updatedInventory;
    }

    // ==========================================
    // 4. BATCH DELIVERIES SERVICES
    // ==========================================

    async getDeliveryList(params: TGetListQuery) {
        return this.repository.getDeliveryList(params);
    }

    async logDelivery(data: TCreateDelivery, actorId: string) {
        const ingredient = await this.getIngredientById(data.ingredientId);

        if (data.supplierId) {
            const supplier = await prisma.supplier.findFirst({
                where: { id: data.supplierId, deletedAt: null }
            });
            if (!supplier) {
                throw new NotFoundException('Supplier not found');
            }
        }

        const totalCost = data.quantityReceived * data.unitCost;

        // 1. Create delivery batch record
        const delivery = await this.repository.createDelivery(
            {
                ...data,
                totalCost
            },
            actorId
        );

        // 2. Increment stock quantity and update status alert in a safe database transaction
        const updatedInventory = await this.repository.adjustStockAndStatus(
            data.ingredientId,
            data.quantityReceived,
            false, // isPhysicalCount
            actorId
        );

        await this.activityLogService.logActivity({
            actorId,
            title: 'Log Ingredient Delivery',
            details: `Received delivery batch ${data.batchNumber || 'N/A'} of ${data.quantityReceived} ${ingredient.defaultUnit.abbreviation || ingredient.defaultUnit.name} ${ingredient.name} at PHP ${data.unitCost}/${ingredient.defaultUnit.abbreviation || ingredient.defaultUnit.name} (Total: PHP ${totalCost}). Live inventory increased to ${updatedInventory.currentQuantity} (Alert: ${updatedInventory.status}).`
        });

        return delivery;
    }

    // ==========================================
    // 5. INVENTORY ADJUSTMENTS & WASTE LOG SERVICES
    // ==========================================

    async getAdjustmentList(params: TGetListQuery) {
        return this.repository.getAdjustmentList(params);
    }

    async logAdjustment(data: TCreateAdjustment, actorId: string) {
        const ingredient = await this.getIngredientById(data.ingredientId);

        // 1. Create adjustment log
        const adjustment = await this.repository.createAdjustment(data, actorId);

        // 2. Increment/Decrement currentQuantity and update status alert in database transaction
        const updatedInventory = await this.repository.adjustStockAndStatus(
            data.ingredientId,
            data.quantity, // quantityDiff (e.g. -500g for waste)
            false, // isPhysicalCount
            actorId
        );

        await this.activityLogService.logActivity({
            actorId,
            title: `Log Stock Adjustment (${data.type})`,
            details: `Adjusted ${ingredient.name} stock level by ${data.quantity > 0 ? '+' : ''}${data.quantity} ${ingredient.defaultUnit.abbreviation || ingredient.defaultUnit.name} due to ${data.type.toLowerCase().replace('_', ' ')}. Reason: "${data.reason || 'None provided'}". Live inventory changed to ${updatedInventory.currentQuantity} (Alert: ${updatedInventory.status}).`
        });

        return adjustment;
    }

    async getInventoryForecast() {
        const variants = await this.repository.getVariantsWithRecipes();

        const forecast = variants.map((variant) => {
            // Get variant descriptive name
            const attrNames = variant.attributes.map((attr) => attr.attributeValue.value).join(', ');
            const name = attrNames ? `${variant.product.name} (${attrNames})` : variant.product.name;

            // If no recipe is configured
            if (!variant.recipe) {
                return {
                    variantId: variant.id,
                    productId: variant.productId,
                    name,
                    sku: variant.sku,
                    price: variant.price,
                    hasRecipe: false,
                    maxProduceable: null,
                    bottleneck: null,
                    ingredients: []
                };
            }

            let maxProduceable = Infinity;
            let bottleneck: {
                ingredientId: string;
                name: string;
                currentQuantity: number;
                requiredQuantity: number;
                unit: string;
            } | null = null;

            const ingredientDetails = variant.recipe.ingredients.map((ri) => {
                const inventory = ri.ingredient.inventories[0];
                const currentQty = inventory ? inventory.currentQuantity : 0;
                const requiredQty = ri.quantity;

                const canProduce = requiredQty > 0 ? Math.floor(currentQty / requiredQty) : Infinity;

                if (canProduce < maxProduceable) {
                    maxProduceable = canProduce;
                    bottleneck = {
                        ingredientId: ri.ingredientId,
                        name: ri.ingredient.name,
                        currentQuantity: currentQty,
                        requiredQuantity: requiredQty,
                        unit: ri.unit.abbreviation || ri.unit.name
                    };
                }

                return {
                    ingredientId: ri.ingredientId,
                    name: ri.ingredient.name,
                    currentQuantity: currentQty,
                    requiredQuantity: requiredQty,
                    unit: ri.unit.abbreviation || ri.unit.name,
                    canProduce: canProduce === Infinity ? 'Unlimited' : canProduce
                };
            });

            // Handle empty ingredients
            if (ingredientDetails.length === 0) {
                maxProduceable = Infinity;
            }

            return {
                variantId: variant.id,
                productId: variant.productId,
                name,
                sku: variant.sku,
                price: variant.price,
                hasRecipe: true,
                maxProduceable: maxProduceable === Infinity ? 'Unlimited' : maxProduceable,
                bottleneck,
                ingredients: ingredientDetails
            };
        });

        return forecast;
    }
}
