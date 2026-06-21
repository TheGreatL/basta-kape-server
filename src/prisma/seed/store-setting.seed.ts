import { PrismaClient } from '@prisma/client';

const STORE_SETTING = {
    storeName: 'Kape muna',
    address: '50 K-1st, Quezon City, Metro Manila',
    openingTime: '07:00',
    closingTime: '21:00',
    vatRate: 12.0,
    serviceCharge: 0.0
} as const;

export async function seedStoreSetting(prisma: PrismaClient) {
    console.log('Seeding store settings...');

    const existing = await prisma.storeSetting.findFirst();

    if (existing) {
        await prisma.storeSetting.update({
            where: { id: existing.id },
            data: STORE_SETTING
        });
        return;
    }

    await prisma.storeSetting.create({
        data: STORE_SETTING
    });
}
