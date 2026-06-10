import { prisma } from '@/lib/prisma';
import { BaseRepository } from '@/repository/base.repository';
import type { TCreateStoreSetting, TUpdateStoreSetting } from './store-settings.types';

export class StoreSettingsRepository extends BaseRepository {
    async getActiveSettings() {
        return prisma.storeSetting.findFirst();
    }

    async createSettings(data: TCreateStoreSetting) {
        return prisma.storeSetting.create({
            data: {
                storeName: data.storeName,
                address: data.address,
                contactNumber: data.contactNumber ?? null,
                openingTime: data.openingTime,
                closingTime: data.closingTime,
                vatRate: data.vatRate,
                serviceCharge: data.serviceCharge
            }
        });
    }

    async updateSettings(id: string, data: TUpdateStoreSetting) {
        return prisma.storeSetting.update({
            where: { id },
            data: {
                storeName: data.storeName,
                address: data.address,
                contactNumber: data.contactNumber,
                openingTime: data.openingTime,
                closingTime: data.closingTime,
                vatRate: data.vatRate,
                serviceCharge: data.serviceCharge
            }
        });
    }

    async deleteSettings(id: string) {
        return prisma.storeSetting.delete({
            where: { id }
        });
    }

    async findById(id: string) {
        return prisma.storeSetting.findUnique({
            where: { id }
        });
    }
}
