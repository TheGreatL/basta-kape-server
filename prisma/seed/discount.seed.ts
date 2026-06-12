import { PrismaClient, DiscountType } from '@prisma/client';

export async function seedDiscounts(prisma: PrismaClient) {
    console.log('Seeding discount configurations...');

    const discounts = [
        {
            name: 'Senior Citizen',
            type: DiscountType.PERCENTAGE,
            value: 20.0,
            code: 'SENIOR',
            isActive: true
        },
        {
            name: 'PWD',
            type: DiscountType.PERCENTAGE,
            value: 20.0,
            code: 'PWD',
            isActive: true
        },
        {
            name: 'Soft Launch 10% Off',
            type: DiscountType.PERCENTAGE,
            value: 10.0,
            code: 'SOFT10',
            isActive: true
        },
        {
            name: 'Grand Opening PHP 50 Off',
            type: DiscountType.FIXED_AMOUNT,
            value: 50.0,
            code: 'GRAND50',
            isActive: true
        }
    ];

    for (const d of discounts) {
        await prisma.discount.upsert({
            where: { code: d.code },
            update: {
                name: d.name,
                type: d.type,
                value: d.value,
                isActive: d.isActive
            },
            create: d
        });
    }
}
