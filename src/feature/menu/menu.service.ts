import { MenuRepository } from './menu.repository';
import { NotFoundException } from '@/exceptions';
import type { TGetMenuQuery, TGetBestSellersQuery } from './menu.types';
import { UnitConversionService, type TUnitConverter } from '@/feature/unit-conversion/unit-conversion.service';

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
        ingredientUnitId?: string;
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
    preparedBatches?: { currentQuantity: number }[];
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
    preparationType?: 'MADE_TO_ORDER' | 'PREPARED_DISPLAY';
    defaultShelfLife?: number | null;
    productCategoryId: string | null;
    productTypeId: string | null;
    category: { id: string; name: string; description: string | null } | null;
    type: { id: string; name: string; description: string | null } | null;
    variants: IRepositoryProductVariant[];
}

function calculateMaxProduceable(variant: IRepositoryProductVariant, product: IRepositoryProduct, converter?: TUnitConverter): number | null {
    // If product is prepared for display in advance, max produceable is the sum of fresh display units on hand
    if (product.preparationType === 'PREPARED_DISPLAY') {
        return (variant.preparedBatches || []).reduce((sum, b) => sum + b.currentQuantity, 0);
    }

    if (!variant.recipe || !variant.recipe.ingredients || variant.recipe.ingredients.length === 0) {
        return null;
    }

    let maxProduceable = Infinity;

    for (const ri of variant.recipe.ingredients) {
        const inventories = ri.ingredient?.inventories || [];
        const inventory = inventories[0];
        const currentQty = inventory ? inventory.currentQuantity : 0;

        let requiredQty = ri.quantity;
        if (converter && ri.unit?.id && ri.ingredient?.ingredientUnitId) {
            try {
                requiredQty = converter(ri.unit.id, ri.ingredient.ingredientUnitId, ri.quantity, ri.ingredientId);
            } catch {
                requiredQty = ri.quantity;
            }
        }

        if (requiredQty > 0) {
            const canProduce = Math.floor(currentQty / requiredQty);
            if (canProduce < maxProduceable) {
                maxProduceable = canProduce;
            }
        }
    }

    return maxProduceable === Infinity ? null : maxProduceable;
}

function formatMenuProduct(product: IRepositoryProduct, converter?: TUnitConverter) {
    if (!product) return null;
    return {
        ...product,
        variants: (product.variants || []).map((variant) => ({
            ...variant,
            maxProduceable: calculateMaxProduceable(variant, product, converter)
        }))
    };
}

export class MenuService {
    private repository: MenuRepository;
    private unitConversionService: UnitConversionService;

    constructor() {
        this.repository = new MenuRepository();
        this.unitConversionService = new UnitConversionService();
    }

    async getMenuList(params: TGetMenuQuery) {
        const [result, converter] = await Promise.all([this.repository.getMenuList(params), this.unitConversionService.getConverter()]);
        result.data = ((result.data as IRepositoryProduct[]) || []).map((product) => formatMenuProduct(product, converter));
        return result;
    }

    async getMenuProductById(id: string) {
        const [product, converter] = await Promise.all([this.repository.getMenuProductById(id), this.unitConversionService.getConverter()]);
        if (!product) {
            throw new NotFoundException('Product not found in the menu');
        }
        return formatMenuProduct(product as unknown as IRepositoryProduct, converter);
    }

    async getCategoryList(productTypeId?: string) {
        return this.repository.getCategoryList(productTypeId);
    }

    async getTypeList() {
        return this.repository.getTypeList();
    }

    async getBestSellers(params: TGetBestSellersQuery) {
        const [bestSellersData, converter] = await Promise.all([
            this.repository.getBestSellingProducts(params),
            this.unitConversionService.getConverter()
        ]);

        return bestSellersData.map(({ product, totalQuantitySold, totalRevenue }) => {
            const formattedProduct = formatMenuProduct(product as unknown as IRepositoryProduct, converter);
            const variantPrices = (formattedProduct?.variants || []).map((v) => v.price);
            const minPrice = variantPrices.length > 0 ? Math.min(...variantPrices) : 0;
            const maxPrice = variantPrices.length > 0 ? Math.max(...variantPrices) : 0;

            return {
                ...formattedProduct,
                totalQuantitySold,
                totalRevenue,
                minPrice,
                maxPrice
            };
        });
    }
}
