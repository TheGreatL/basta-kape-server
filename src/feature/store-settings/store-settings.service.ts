import { StoreSettingsRepository } from './store-settings.repository';
import { ActivityLogService } from '@/feature/activity-log/activity-log.service';
import { NotFoundException, ConflictException } from '@/exceptions';
import type { TCreateStoreSetting, TUpdateStoreSetting } from './store-settings.types';

type StoreSettingsServiceConstructor = {
    storeSettingsRepository?: StoreSettingsRepository;
    activityLogService?: ActivityLogService;
};

export class StoreSettingsService {
    private repository: StoreSettingsRepository;
    private activityLogService: ActivityLogService;

    constructor(deps: StoreSettingsServiceConstructor = {}) {
        this.repository = deps.storeSettingsRepository ?? new StoreSettingsRepository();
        this.activityLogService = deps.activityLogService ?? new ActivityLogService();
    }

    async getActiveSettings() {
        let settings = await this.repository.getActiveSettings();
        if (!settings) {
            settings = await this.repository.createSettings({
                storeName: 'Basta Kape',
                address: '50 K-1st, Quezon City, Metro Manila',
                contactNumber: null,
                openingTime: '07:00',
                closingTime: '21:00',
                vatRate: 12.0,
                serviceCharge: 0.0
            });
        }
        return settings;
    }

    async createSettings(data: TCreateStoreSetting, actorId: string) {
        const existing = await this.repository.getActiveSettings();
        if (existing) {
            throw new ConflictException('Store settings already exist. Please update the existing settings instead.');
        }

        const settings = await this.repository.createSettings(data);

        await this.activityLogService.logActivity({
            actorId,
            title: 'Create Store Settings',
            details: `Created store settings: ${settings.storeName}.`
        });

        return settings;
    }

    async updateSettings(id: string, data: TUpdateStoreSetting, actorId: string) {
        const settings = await this.repository.findById(id);
        if (!settings) {
            throw new NotFoundException('Store settings not found');
        }

        const updated = await this.repository.updateSettings(id, data);

        await this.activityLogService.logActivity({
            actorId,
            title: 'Update Store Settings',
            details: `Updated store settings for ${updated.storeName}.`
        });

        return updated;
    }

    async deleteSettings(id: string, actorId: string) {
        const settings = await this.repository.findById(id);
        if (!settings) {
            throw new NotFoundException('Store settings not found');
        }

        await this.repository.deleteSettings(id);

        await this.activityLogService.logActivity({
            actorId,
            title: 'Delete Store Settings',
            details: `Deleted store settings: ${settings.storeName}.`
        });
    }
}
