import { seedUsers } from './seed/user.seed';
import { seedProduct } from './seed/product.seed';
import { seedStoreSetting } from './seed/store-setting.seed';
import { seedDiscounts } from './seed/discount.seed';
import { prisma } from '@/lib/prisma';

async function main() {
    try {
        console.log('Start seeding...');

        // Execute user-related seeding logic
        await seedUsers(prisma);
        await seedProduct(prisma);
        await seedStoreSetting(prisma);
        await seedDiscounts(prisma);

        console.log('Seeding finished successfully.');
    } catch (e) {
        console.error(e);
        throw e;
    } finally {
        await prisma.$disconnect();
    }
}

main();
