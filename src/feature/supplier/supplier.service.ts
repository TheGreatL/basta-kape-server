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

    async createSupplier(data: TCreateSupplier, actorId: string) {
        const existing = await this.repository.findSupplierByName(data.name);
        if (existing) {
            throw new ConflictException(`Supplier with name "${data.name}" already exists`);
        }

        const supplier = await this.repository.createSupplier(data, actorId);

        await this.activityLogService.logActivity({
            actorId,
            title: 'Create Supplier',
            details: `Successfully created supplier: ${supplier.name}.`
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

        const updated = await this.repository.updateSupplier(id, data, actorId);

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
}
