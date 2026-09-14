import { prisma } from '@/lib/prisma';
import { SupplierRepository } from './supplier.repository';
import { ActivityLogService } from '@/feature/activity-log/activity-log.service';
import { NotFoundException, ConflictException } from '@/exceptions';
import type { TCreateSupplier, TUpdateSupplier, TGetSupplierListQuery } from './supplier.types';

export class SupplierService {
    private repository: SupplierRepository;
    private activityLogService: ActivityLogService;

    constructor() {
        this.repository = new SupplierRepository();
        this.activityLogService = new ActivityLogService();
    }

    private async normalizeAndValidateIngredients(
        ingredients?: { ingredientId: string; unitCost?: number }[],
        ingredientIds?: string[]
    ): Promise<{ ingredientId: string; unitCost?: number }[] | undefined> {
        let items: { ingredientId: string; unitCost?: number }[] | undefined;

        if (ingredients !== undefined) {
            items = ingredients;
        } else if (ingredientIds !== undefined) {
            items = ingredientIds.map((id) => ({ ingredientId: id, unitCost: 0 }));
        }

        if (items !== undefined && items.length > 0) {
            const uniqueIds = Array.from(new Set(items.map((i) => i.ingredientId)));
            const existingIngredients = await prisma.ingredient.findMany({
                where: {
                    id: { in: uniqueIds },
                    deletedAt: null
                }
            });

            if (existingIngredients.length !== uniqueIds.length) {
                throw new NotFoundException('One or more selected ingredients do not exist or have been deleted');
            }
        }

        return items;
    }

    async getSupplierList(params: TGetSupplierListQuery) {
        return this.repository.getSupplierList(params);
    }

    async getSupplierById(id: string) {
        const supplier = await this.repository.findSupplierById(id);
        if (!supplier) {
            throw new NotFoundException('Supplier not found');
        }
        return supplier;
    }

    async getSupplierIngredients(id: string) {
        await this.getSupplierById(id);
        return this.repository.getSupplierIngredients(id);
    }

    async createSupplier(data: TCreateSupplier, actorId: string) {
        const existing = await this.repository.findSupplierByName(data.name);
        if (existing) {
            throw new ConflictException(`Supplier with name "${data.name}" already exists`);
        }

        const items = await this.normalizeAndValidateIngredients(data.ingredients, data.ingredientIds);

        const supplier = await this.repository.createSupplier(data, actorId, items);

        await this.activityLogService.logActivity({
            actorId,
            title: 'Create Supplier',
            details: `Successfully created supplier: ${supplier.name}${items?.length ? ` with ${items.length} linked ingredients` : ''}.`
        });

        return supplier;
    }

    async updateSupplier(id: string, data: TUpdateSupplier, actorId: string) {
        const supplier = await this.getSupplierById(id);

        if (data.name && data.name !== supplier.name) {
            const existing = await this.repository.findSupplierByName(data.name);
            if (existing) {
                throw new ConflictException(`Supplier with name "${data.name}" already exists`);
            }
        }

        let items: { ingredientId: string; unitCost?: number }[] | undefined;
        if (data.ingredients !== undefined || data.ingredientIds !== undefined) {
            items = await this.normalizeAndValidateIngredients(data.ingredients, data.ingredientIds);
        }

        const updated = await this.repository.updateSupplier(id, data, actorId, items);

        await this.activityLogService.logActivity({
            actorId,
            title: 'Update Supplier',
            details: `Successfully updated supplier: ${supplier.name} -> ${updated.name}.`
        });

        return updated;
    }

    async deleteSupplier(id: string, actorId: string) {
        const supplier = await this.getSupplierById(id);

        await this.repository.softDeleteSupplier(id, actorId);

        await this.activityLogService.logActivity({
            actorId,
            title: 'Delete Supplier',
            details: `Successfully deleted supplier: ${supplier.name}.`
        });
    }

    async restoreSupplier(id: string, actorId: string) {
        const supplier = await this.repository.findSupplierByIdIncludingDeleted(id);
        if (!supplier) {
            throw new NotFoundException('Supplier not found');
        }

        const restored = await this.repository.restoreSupplier(id, actorId);

        await this.activityLogService.logActivity({
            actorId,
            title: 'Restore Supplier',
            details: `Successfully restored supplier: ${supplier.name}.`
        });

        return restored;
    }
}
