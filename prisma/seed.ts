import { PrismaClient } from '@prisma/client';
import { seedUsers } from './seed/user.seed';
import { seedProduct } from './seed/product.seed';
import { seedStoreSetting } from './seed/store-setting.seed';

const prisma = new PrismaClient();

async function main() {
    try {
        console.log('Start seeding...');

        // Execute user-related seeding logic
        await seedUsers(prisma);
        await seedProduct(prisma);
        await seedStoreSetting(prisma);

        console.log('Seeding finished successfully.');
    } catch (e) {
        console.error(e);
        throw e;
    } finally {
        await prisma.$disconnect();
    }
}

main();
