import { MenuRepository } from './menu.repository';
import { NotFoundException } from '@/exceptions';
import type { TGetMenuQuery } from './menu.types';

interface IRepositoryIngredientInventory {
    currentQuantity: number;
}

interface IRepositoryRecipeIngredient {
    id: string;
    ingredientId: string;
    quantity: number;
    ingredient: {
        id: string;
        name: string;
        inventories: IRepositoryIngredientInventory[];
    };
    unit: {
        id: string;
        name: string;
        abbreviation: string | null;
    };
}

interface IRepositoryProductVariant {
    id: string;
    productId: string;
    sku: string | null;
    price: number;
    attributes: unknown[];
    recipe: {
        id: string;
        name: string;
        description: string | null;
        ingredients: IRepositoryRecipeIngredient[];
    } | null;
}

interface IRepositoryProduct {
    id: string;
    name: string;
    photo: string | null;
    description: string | null;
    productCategoryId: string | null;
    productTypeId: string | null;
    category: { id: string; name: string; description: string | null } | null;
    type: { id: string; name: string; description: string | null } | null;
    variants: IRepositoryProductVariant[];
}

function calculateMaxProduceable(variant: IRepositoryProductVariant): number | null {
    if (!variant.recipe || !variant.recipe.ingredients || variant.recipe.ingredients.length === 0) {
        return null;
    }

    let maxProduceable = Infinity;

    for (const ri of variant.recipe.ingredients) {
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

function formatMenuProduct(product: IRepositoryProduct) {
    if (!product) return null;
    return {
        ...product,
        variants: (product.variants || []).map((variant) => ({
            ...variant,
            maxProduceable: calculateMaxProduceable(variant)
        }))
    };
}

export class MenuService {
    private repository: MenuRepository;

    constructor() {
        this.repository = new MenuRepository();
    }

    async getMenuList(params: TGetMenuQuery) {
        const result = await this.repository.getMenuList(params);
        result.data = ((result.data as IRepositoryProduct[]) || []).map((product) => formatMenuProduct(product));
        return result;
    }

    async getMenuProductById(id: string) {
        const product = await this.repository.getMenuProductById(id);
        if (!product) {
            throw new NotFoundException('Product not found in the menu');
        }
        return formatMenuProduct(product as unknown as IRepositoryProduct);
    }

    async getCategoryList() {
        return this.repository.getCategoryList();
    }

    async getTypeList() {
        return this.repository.getTypeList();
    }
}
