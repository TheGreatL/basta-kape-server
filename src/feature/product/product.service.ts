import { ProductRepository } from './product.repository';
import { ProductSettingsRepository } from '@/feature/product-settings/product-settings.repository';
import { ActivityLogService } from '@/feature/activity-log/activity-log.service';
import { NotFoundException, ConflictException } from '@/exceptions';
import type { TCreateProduct, TUpdateProduct, TCreateProductVariant, TUpdateProductVariant, TGetProductListQuery } from './product.types';

export class ProductService {
    private repository: ProductRepository;
    private settingsRepository: ProductSettingsRepository;
    private activityLogService: ActivityLogService;

    constructor() {
        this.repository = new ProductRepository();
        this.settingsRepository = new ProductSettingsRepository();
        this.activityLogService = new ActivityLogService();
    }

    // ==========================================
    // 1. PRODUCT SERVICES
    // ==========================================

    async getProductList(params: TGetProductListQuery) {
        return this.repository.getProductList(params);
    }

    async getProductById(id: string) {
        const product = await this.repository.findProductById(id);
        if (!product) {
            throw new NotFoundException('Product not found');
        }
        return product;
    }

    async createProduct(data: TCreateProduct, actorId: string) {
        // 1. Validate category if provided
        if (data.productCategoryId) {
            const category = await this.settingsRepository.findCategoryById(data.productCategoryId);
            if (!category) {
                throw new NotFoundException(`Product category with ID "${data.productCategoryId}" not found`);
            }
        }

        // 2. Validate type if provided
        if (data.productTypeId) {
            const type = await this.settingsRepository.findTypeById(data.productTypeId);
            if (!type) {
                throw new NotFoundException(`Product type with ID "${data.productTypeId}" not found`);
            }
        }

        // 3. Validate unique name
        const existing = await this.repository.findProductByName(data.name);
        if (existing) {
            throw new ConflictException(`Product with name "${data.name}" already exists`);
        }

        const product = await this.repository.createProduct(data, actorId);

        await this.activityLogService.logActivity({
            actorId,
            title: 'Create Product',
            details: `Successfully created product: ${product.name} (${product.id}).`
        });

        return product;
    }

    async updateProduct(id: string, data: TUpdateProduct, actorId: string) {
        const product = await this.getProductById(id);

        // 1. Validate category if provided
        if (data.productCategoryId) {
            const category = await this.settingsRepository.findCategoryById(data.productCategoryId);
            if (!category) {
                throw new NotFoundException(`Product category with ID "${data.productCategoryId}" not found`);
            }
        }

        // 2. Validate type if provided
        if (data.productTypeId) {
            const type = await this.settingsRepository.findTypeById(data.productTypeId);
            if (!type) {
                throw new NotFoundException(`Product type with ID "${data.productTypeId}" not found`);
            }
        }

        // 3. Validate name uniqueness if changed
        if (data.name && data.name !== product.name) {
            const existing = await this.repository.findProductByName(data.name);
            if (existing) {
                throw new ConflictException(`Product with name "${data.name}" already exists`);
            }
        }

        const updated = await this.repository.updateProduct(id, data, actorId);

        await this.activityLogService.logActivity({
            actorId,
            title: 'Update Product',
            details: `Successfully updated product: ${product.name} -> ${updated.name} (${id}).`
        });

        return updated;
    }

    async deleteProduct(id: string, actorId: string) {
        const product = await this.getProductById(id);

        await this.repository.softDeleteProduct(id, actorId);

        await this.activityLogService.logActivity({
            actorId,
            title: 'Delete Product',
            details: `Successfully soft-deleted product and all its variants: ${product.name} (${id}).`
        });
    }

    // ==========================================
    // 2. PRODUCT VARIANT SERVICES
    // ==========================================

    async getVariantById(id: string) {
        const variant = await this.repository.findVariantById(id);
        if (!variant) {
            throw new NotFoundException('Product variant not found');
        }
        return variant;
    }

    async createVariant(productId: string, data: TCreateProductVariant, actorId: string) {
        // 1. Ensure product exists
        const product = await this.getProductById(productId);

        // 2. Ensure SKU unique if provided
        if (data.sku) {
            const existingSku = await this.repository.findVariantBySku(data.sku);
            if (existingSku) {
                throw new ConflictException(`Product variant with SKU "${data.sku}" already exists`);
            }
        }

        // 3. Validate attribute values if provided
        if (data.attributeValueIds && data.attributeValueIds.length > 0) {
            for (const valId of data.attributeValueIds) {
                const val = await this.settingsRepository.findAttributeValueById(valId);
                if (!val) {
                    throw new NotFoundException(`Attribute value with ID "${valId}" not found`);
                }
            }
        }

        const variant = await this.repository.createVariant(productId, data, actorId);

        await this.activityLogService.logActivity({
            actorId,
            title: 'Create Product Variant',
            details: `Successfully created variant with SKU ${variant.sku || 'N/A'} for product: ${product.name} (${variant.id}).`
        });

        return variant;
    }

    async updateVariant(id: string, data: TUpdateProductVariant, actorId: string) {
        // 1. Ensure variant exists
        const variant = await this.getVariantById(id);

        // 2. Ensure SKU unique if changed
        if (data.sku && data.sku !== variant.sku) {
            const existingSku = await this.repository.findVariantBySku(data.sku);
            if (existingSku) {
                throw new ConflictException(`Product variant with SKU "${data.sku}" already exists`);
            }
        }

        // 3. Validate attribute values if provided
        if (data.attributeValueIds && data.attributeValueIds.length > 0) {
            for (const valId of data.attributeValueIds) {
                const val = await this.settingsRepository.findAttributeValueById(valId);
                if (!val) {
                    throw new NotFoundException(`Attribute value with ID "${valId}" not found`);
                }
            }
        }

        const updatedVariant = await this.repository.updateVariant(id, data, actorId);

        await this.activityLogService.logActivity({
            actorId,
            title: 'Update Product Variant',
            details: `Successfully updated variant ${id} for product: ${variant.product.name}.`
        });

        return updatedVariant;
    }

    async deleteVariant(id: string, actorId: string) {
        const variant = await this.getVariantById(id);

        await this.repository.softDeleteVariant(id, actorId);

        await this.activityLogService.logActivity({
            actorId,
            title: 'Delete Product Variant',
            details: `Successfully soft-deleted variant ${id} with SKU ${variant.sku || 'N/A'}.`
        });
    }
}
