import { ProductSettingsRepository } from './product-settings.repository';
import { ActivityLogService } from '@/feature/activity-log/activity-log.service';
import { NotFoundException, ConflictException } from '@/exceptions';
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

export class ProductSettingsService {
    private repository: ProductSettingsRepository;
    private activityLogService: ActivityLogService;

    constructor() {
        this.repository = new ProductSettingsRepository();
        this.activityLogService = new ActivityLogService();
    }

    // ==========================================
    // 1. PRODUCT CATEGORY SERVICES
    // ==========================================

    async getCategoryList(params: TGetListQuery) {
        return this.repository.getCategoryList(params);
    }

    async getCategoryById(id: string) {
        const category = await this.repository.findCategoryById(id);
        if (!category) {
            throw new NotFoundException('Product category not found');
        }
        return category;
    }

    async createCategory(data: TCreateCategory, actorId: string) {
        const existing = await this.repository.findCategoryByName(data.name);
        if (existing) {
            throw new ConflictException(`Product category with name "${data.name}" already exists`);
        }

        const category = await this.repository.createCategory(data, actorId);

        await this.activityLogService.logActivity({
            actorId,
            title: 'Create Product Category',
            details: `Successfully created product category: ${category.name}.`
        });

        return category;
    }

    async updateCategory(id: string, data: TUpdateCategory, actorId: string) {
        const category = await this.getCategoryById(id);

        if (data.name && data.name !== category.name) {
            const existing = await this.repository.findCategoryByName(data.name);
            if (existing) {
                throw new ConflictException(`Product category with name "${data.name}" already exists`);
            }
        }

        const updated = await this.repository.updateCategory(id, data, actorId);

        await this.activityLogService.logActivity({
            actorId,
            title: 'Update Product Category',
            details: `Successfully updated product category: ${category.name} -> ${updated.name}.`
        });

        return updated;
    }

    async deleteCategory(id: string, actorId: string) {
        const category = await this.getCategoryById(id);

        await this.repository.softDeleteCategory(id, actorId);

        await this.activityLogService.logActivity({
            actorId,
            title: 'Delete Product Category',
            details: `Successfully deleted product category: ${category.name}.`
        });
    }

    // ==========================================
    // 2. PRODUCT TYPE SERVICES
    // ==========================================

    async getTypeList(params: TGetListQuery) {
        return this.repository.getTypeList(params);
    }

    async getTypeById(id: string) {
        const type = await this.repository.findTypeById(id);
        if (!type) {
            throw new NotFoundException('Product type not found');
        }
        return type;
    }

    async createType(data: TCreateType, actorId: string) {
        const existing = await this.repository.findTypeByName(data.name);
        if (existing) {
            throw new ConflictException(`Product type with name "${data.name}" already exists`);
        }

        const type = await this.repository.createType(data, actorId);

        await this.activityLogService.logActivity({
            actorId,
            title: 'Create Product Type',
            details: `Successfully created product type: ${type.name}.`
        });

        return type;
    }

    async updateType(id: string, data: TUpdateType, actorId: string) {
        const type = await this.getTypeById(id);

        if (data.name && data.name !== type.name) {
            const existing = await this.repository.findTypeByName(data.name);
            if (existing) {
                throw new ConflictException(`Product type with name "${data.name}" already exists`);
            }
        }

        const updated = await this.repository.updateType(id, data, actorId);

        await this.activityLogService.logActivity({
            actorId,
            title: 'Update Product Type',
            details: `Successfully updated product type: ${type.name} -> ${updated.name}.`
        });

        return updated;
    }

    async deleteType(id: string, actorId: string) {
        const type = await this.getTypeById(id);

        await this.repository.softDeleteType(id, actorId);

        await this.activityLogService.logActivity({
            actorId,
            title: 'Delete Product Type',
            details: `Successfully deleted product type: ${type.name}.`
        });
    }

    // ==========================================
    // 3. PRODUCT ATTRIBUTE SERVICES
    // ==========================================

    async getAttributeList(params: TGetListQuery) {
        return this.repository.getAttributeList(params);
    }

    async getAttributeById(id: string) {
        const attribute = await this.repository.findAttributeById(id);
        if (!attribute) {
            throw new NotFoundException('Product attribute not found');
        }
        return attribute;
    }

    async createAttribute(data: TCreateAttribute, actorId: string) {
        const existing = await this.repository.findAttributeByName(data.name);
        if (existing) {
            throw new ConflictException(`Product attribute with name "${data.name}" already exists`);
        }

        const attribute = await this.repository.createAttribute(data, actorId);

        await this.activityLogService.logActivity({
            actorId,
            title: 'Create Product Attribute',
            details: `Successfully created product attribute: ${attribute.name}.`
        });

        return attribute;
    }

    async updateAttribute(id: string, data: TUpdateAttribute, actorId: string) {
        const attribute = await this.getAttributeById(id);

        if (data.name && data.name !== attribute.name) {
            const existing = await this.repository.findAttributeByName(data.name);
            if (existing) {
                throw new ConflictException(`Product attribute with name "${data.name}" already exists`);
            }
        }

        const updated = await this.repository.updateAttribute(id, data, actorId);

        await this.activityLogService.logActivity({
            actorId,
            title: 'Update Product Attribute',
            details: `Successfully updated product attribute: ${attribute.name} -> ${updated.name}.`
        });

        return updated;
    }

    async deleteAttribute(id: string, actorId: string) {
        const attribute = await this.getAttributeById(id);

        await this.repository.softDeleteAttribute(id, actorId);

        await this.activityLogService.logActivity({
            actorId,
            title: 'Delete Product Attribute',
            details: `Successfully deleted product attribute: ${attribute.name}.`
        });
    }

    // ==========================================
    // 4. PRODUCT ATTRIBUTE VALUE SERVICES
    // ==========================================

    async getAttributeValueList(attributeId: string, params: TGetListQuery) {
        // Ensure parent attribute exists
        await this.getAttributeById(attributeId);
        return this.repository.getAttributeValueList(attributeId, params);
    }

    async getAttributeValueById(id: string) {
        const value = await this.repository.findAttributeValueById(id);
        if (!value) {
            throw new NotFoundException('Product attribute value not found');
        }
        return value;
    }

    async createAttributeValue(data: TCreateAttributeValue, actorId: string) {
        // Ensure parent attribute exists
        const attribute = await this.getAttributeById(data.productAttributeId);

        const existing = await this.repository.findDuplicateAttributeValue(data.productAttributeId, data.value);
        if (existing) {
            throw new ConflictException(`Value "${data.value}" already exists for attribute "${attribute.name}"`);
        }

        const valueNode = await this.repository.createAttributeValue(data, actorId);

        await this.activityLogService.logActivity({
            actorId,
            title: 'Create Product Attribute Value',
            details: `Successfully added attribute value "${valueNode.value}" to attribute "${attribute.name}".`
        });

        return valueNode;
    }

    async updateAttributeValue(id: string, data: TUpdateAttributeValue, actorId: string) {
        const valueNode = await this.getAttributeValueById(id);

        if (data.value && data.value !== valueNode.value) {
            const existing = await this.repository.findDuplicateAttributeValue(valueNode.productAttributeId, data.value);
            if (existing) {
                const attribute = await this.getAttributeById(valueNode.productAttributeId);
                throw new ConflictException(`Value "${data.value}" already exists for attribute "${attribute.name}"`);
            }
        }

        const updated = await this.repository.updateAttributeValue(id, data, actorId);

        await this.activityLogService.logActivity({
            actorId,
            title: 'Update Product Attribute Value',
            details: `Successfully updated attribute value: ${valueNode.value} -> ${updated.value}.`
        });

        return updated;
    }

    async deleteAttributeValue(id: string, actorId: string) {
        const valueNode = await this.getAttributeValueById(id);

        await this.repository.softDeleteAttributeValue(id, actorId);

        await this.activityLogService.logActivity({
            actorId,
            title: 'Delete Product Attribute Value',
            details: `Successfully deleted attribute value: ${valueNode.value}.`
        });
    }

    async restoreCategory(id: string, actorId: string) {
        const category = await this.repository.findCategoryByIdIncludingDeleted(id);
        if (!category) {
            throw new NotFoundException('Product category not found');
        }

        const restored = await this.repository.restoreCategory(id, actorId);

        await this.activityLogService.logActivity({
            actorId,
            title: 'Restore Product Category',
            details: `Successfully restored product category: ${category.name}.`
        });

        return restored;
    }

    async restoreType(id: string, actorId: string) {
        const type = await this.repository.findTypeByIdIncludingDeleted(id);
        if (!type) {
            throw new NotFoundException('Product type not found');
        }

        const restored = await this.repository.restoreType(id, actorId);

        await this.activityLogService.logActivity({
            actorId,
            title: 'Restore Product Type',
            details: `Successfully restored product type: ${type.name}.`
        });

        return restored;
    }

    async restoreAttribute(id: string, actorId: string) {
        const attribute = await this.repository.findAttributeByIdIncludingDeleted(id);
        if (!attribute) {
            throw new NotFoundException('Product attribute not found');
        }

        const restored = await this.repository.restoreAttribute(id, actorId);

        await this.activityLogService.logActivity({
            actorId,
            title: 'Restore Product Attribute',
            details: `Successfully restored product attribute: ${attribute.name}.`
        });

        return restored;
    }

    async restoreAttributeValue(id: string, actorId: string) {
        const valueNode = await this.repository.findAttributeValueByIdIncludingDeleted(id);
        if (!valueNode) {
            throw new NotFoundException('Product attribute value not found');
        }

        const restored = await this.repository.restoreAttributeValue(id, actorId);

        await this.activityLogService.logActivity({
            actorId,
            title: 'Restore Product Attribute Value',
            details: `Successfully restored attribute value: ${valueNode.value}.`
        });

        return restored;
    }
}
