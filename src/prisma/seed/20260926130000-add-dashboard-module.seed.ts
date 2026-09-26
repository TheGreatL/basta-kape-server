import { PrismaClient } from '@prisma/client';
import { appModules } from '../../constant';

const prisma = new PrismaClient();

/**
 * Migration Seed: 20260926130000-add-dashboard-module.seed.ts
 *
 * Adds the 'Dashboard' RBAC module and grants read permissions to
 * 'Owner' and 'Administrator' roles without requiring a full database reset.
 */
export async function seedDashboardModule(client: PrismaClient = prisma) {
    console.log('--- [2026-09-26 13:00:00] Seeding Dashboard Module & Permissions ---');

    // 1. Ensure basic CRUD permissions exist
    const perms = ['create', 'read', 'update', 'delete'] as const;
    const permissionMap: Record<string, string> = {};

    for (const p of perms) {
        const record = await client.permission.upsert({
            where: { name: p },
            update: {},
            create: {
                name: p,
                description: `Allow users to ${p} records`
            }
        });
        permissionMap[p] = record.id;
    }

    // 2. Ensure the 'Dashboard' module exists
    const dashboardModule = await client.module.upsert({
        where: { name: appModules.DASHBOARD },
        update: {
            description: 'Executive & Operational Dashboard Overview'
        },
        create: {
            name: appModules.DASHBOARD,
            description: 'Executive & Operational Dashboard Overview'
        }
    });

    console.log(`✓ Module verified: "${dashboardModule.name}" (ID: ${dashboardModule.id})`);

    // 3. Ensure ModulePermission records exist for Dashboard
    const modulePermissionMap: Record<string, string> = {};

    for (const [permName, permId] of Object.entries(permissionMap)) {
        let modPerm = await client.modulePermission.findUnique({
            where: {
                moduleId_permissionId: {
                    moduleId: dashboardModule.id,
                    permissionId: permId
                }
            }
        });

        if (!modPerm) {
            modPerm = await client.modulePermission.create({
                data: {
                    moduleId: dashboardModule.id,
                    permissionId: permId
                }
            });
        }
        modulePermissionMap[permName] = modPerm.id;
    }

    console.log('✓ ModulePermissions verified for Dashboard (create, read, update, delete).');

    // 4. Grant Dashboard permissions to Owner and Administrator roles
    const targetRoles = ['Owner', 'Administrator'];
    const readPermissionId = modulePermissionMap['read'];

    for (const roleName of targetRoles) {
        const role = await client.role.findFirst({
            where: { name: roleName, deletedAt: null }
        });

        if (role) {
            const existingRolePerm = await client.rolePermission.findFirst({
                where: {
                    roleId: role.id,
                    modulePermissionId: readPermissionId
                }
            });

            if (!existingRolePerm) {
                await client.rolePermission.create({
                    data: {
                        roleId: role.id,
                        modulePermissionId: readPermissionId
                    }
                });
                console.log(`✓ Granted Dashboard "read" permission to role: "${roleName}".`);
            } else {
                console.log(`ℹ Role "${roleName}" already has Dashboard "read" permission.`);
            }
        } else {
            console.warn(`⚠ Role "${roleName}" not found in database. Skipped.`);
        }
    }

    // 5. Ensure Cashier, Barista, and Customer do NOT have Dashboard permission
    const nonDashboardRoles = ['Cashier', 'Barista', 'Customer'];
    const allDashboardModPermIds = Object.values(modulePermissionMap);

    for (const roleName of nonDashboardRoles) {
        const role = await client.role.findFirst({
            where: { name: roleName, deletedAt: null }
        });

        if (role) {
            const removed = await client.rolePermission.deleteMany({
                where: {
                    roleId: role.id,
                    modulePermissionId: { in: allDashboardModPermIds }
                }
            });

            if (removed.count > 0) {
                console.log(`✓ Removed ${removed.count} Dashboard permission(s) from "${roleName}".`);
            } else {
                console.log(`✓ Verified "${roleName}" has no Dashboard permissions.`);
            }
        }
    }

    console.log('--- Dashboard Module Seed Complete! ---');
}

// Standalone execution when run directly:
if (require.main === module) {
    seedDashboardModule()
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
