import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Start seeding...');

    // Example seed
    const user = await prisma.user.upsert({
        where: { email: 'admin@bastakape.com' },
        update: {},
        create: {
            email: 'admin@bastakape.com',
            name: 'Admin User'
        }
    });
    console.log(`Created user with id: ${user.id}`);

    console.log('Seeding finished.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
