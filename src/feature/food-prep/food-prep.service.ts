import { FoodPrepRepository } from './food-prep.repository';
import { ActivityLogService } from '@/feature/activity-log/activity-log.service';
import { NotFoundException } from '@/exceptions';
import type { TCreatePreparedBatch, TDisposePreparedBatch, TGetPreparedBatchListQuery } from './food-prep.types';

export class FoodPrepService {
    private repository: FoodPrepRepository;
    private activityLogService: ActivityLogService;

    constructor() {
        this.repository = new FoodPrepRepository();
        this.activityLogService = new ActivityLogService();
    }

    async createBatch(data: TCreatePreparedBatch, actorId: string) {
        const batch = await this.repository.createBatch(data, actorId);

        await this.activityLogService.logActivity({
            actorId,
            title: 'Prepare Food Display Batch',
            details: `Prepared ${batch.quantityPrepared} units of ${batch.product.name} (Batch: ${batch.batchNumber}, Expiry: ${batch.expiresAt.toISOString()}).`
        });

        return batch;
    }

    async getBatchById(id: string) {
        const batch = await this.repository.findBatchById(id);
        if (!batch) {
            throw new NotFoundException(`Prepared item batch with ID "${id}" not found`);
        }
        return batch;
    }

    async getBatchList(params: TGetPreparedBatchListQuery) {
        return this.repository.getBatchList(params);
    }

    async disposeBatch(id: string, data: TDisposePreparedBatch, actorId: string) {
        const batch = await this.repository.disposeBatchStock(id, data, actorId);

        await this.activityLogService.logActivity({
            actorId,
            title: 'Dispose Prepared Food Item',
            details: `Disposed ${data.quantity} units from batch ${batch.batchNumber} (${batch.product.name}) due to: ${data.reason}.`
        });

        return batch;
    }

    async getDisplayStockSummary() {
        return this.repository.getDisplayStockSummary();
    }
}
