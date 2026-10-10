import { PrismaClient } from '@prisma/client';
import { appModules } from '../../constant';

const prisma = new PrismaClient();

/**
 * Migration Seed: 20261010100000-add-sales-reports-to-admin.seed.ts
 *
 * Grants Sales Management & Reports Management CRUD permissions to
 * 'Administrator' role so that admins can view dashboard sales metrics
 * and access sales/report management.
 */
export async function seedAdminSalesReportsPermissions(client: PrismaClient = prisma) {
    console.log('--- Seeding Sales & Reports Permissions to Administrator ---');

    const adminRole = await client.role.findFirst({
        where: { name: 'Administrator', deletedAt: null }
    });

    if (!adminRole) {
        console.warn('Administrator role not found.');
        return;
    }

    const targetModules = [appModules.SALES_MANAGEMENT, appModules.REPORTS_MANAGEMENT];

    for (const modName of targetModules) {
        const mod = await client.module.findFirst({
            where: { name: modName }
        });

        if (!mod) {
            console.warn(`Module "${modName}" not found.`);
            continue;
        }

        const modPerms = await client.modulePermission.findMany({
            where: { moduleId: mod.id }
        });

        for (const mp of modPerms) {
            const existing = await client.rolePermission.findFirst({
                where: {
                    roleId: adminRole.id,
                    modulePermissionId: mp.id
                }
            });

            if (!existing) {
                await client.rolePermission.create({
                    data: {
                        roleId: adminRole.id,
                        modulePermissionId: mp.id
                    }
                });
                console.log(`✓ Granted permission ${mp.id} (${modName}) to Administrator.`);
            }
        }
    }

    console.log('--- Admin Sales & Reports Permissions Seed Complete! ---');
}

if (require.main === module) {
    seedAdminSalesReportsPermissions()
        .then(() => {
            console.log('Seed executed successfully.');
            process.exit(0);
        })
        .catch((err) => {
            console.error('Seed execution failed:', err);
            process.exit(1);
        })
        .finally(async () => {
            await prisma.$disconnect();
        });
}
