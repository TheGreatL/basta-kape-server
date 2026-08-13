import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { appModules } from '../../constant';

const SEED_DATE = new Date('2026-07-15T08:00:00.000Z');

export async function seedUsers(prisma: PrismaClient) {
    console.log('Seeding explicitly: Users, Roles, and Permissions...');

    // ==========================================
    // 1. CREATE PERMISSIONS
    // ==========================================
    const create = await prisma.permission.upsert({
        where: { name: 'create' },
        update: {},
        create: { name: 'create', description: 'Allow users to create new records', createdAt: SEED_DATE }
    });
    const read = await prisma.permission.upsert({
        where: { name: 'read' },
        update: {},
        create: { name: 'read', description: 'Allow users to read records', createdAt: SEED_DATE }
    });
    const update = await prisma.permission.upsert({
        where: { name: 'update' },
        update: {},
        create: { name: 'update', description: 'Allow users to update records', createdAt: SEED_DATE }
    });
    const deletePerm = await prisma.permission.upsert({
        where: { name: 'delete' },
        update: {},
        create: { name: 'delete', description: 'Allow users to delete records', createdAt: SEED_DATE }
    });

    // ==========================================
    // 2. CREATE MODULES
    // ==========================================
    const usersMod = await prisma.module.upsert({
        where: { name: appModules.USERS_MANAGEMENT },
        update: {},
        create: { name: appModules.USERS_MANAGEMENT, createdAt: SEED_DATE }
    });
    const rolesMod = await prisma.module.upsert({
        where: { name: appModules.ROLES_AND_PERMISSIONS },
        update: {},
        create: { name: appModules.ROLES_AND_PERMISSIONS, createdAt: SEED_DATE }
    });
    const productsMod = await prisma.module.upsert({
        where: { name: appModules.PRODUCTS_MANAGEMENT },
        update: {},
        create: { name: appModules.PRODUCTS_MANAGEMENT, createdAt: SEED_DATE }
    });
    const productSettingsMod = await prisma.module.upsert({
        where: { name: appModules.PRODUCT_SETTINGS_MANAGEMENT },
        update: {},
        create: { name: appModules.PRODUCT_SETTINGS_MANAGEMENT, createdAt: SEED_DATE }
    });
    const inventoryMod = await prisma.module.upsert({
        where: { name: appModules.INVENTORY_MANAGEMENT },
        update: {},
        create: { name: appModules.INVENTORY_MANAGEMENT, createdAt: SEED_DATE }
    });
    const ordersMod = await prisma.module.upsert({
        where: { name: appModules.ORDERS_MANAGEMENT },
        update: {},
        create: { name: appModules.ORDERS_MANAGEMENT, createdAt: SEED_DATE }
    });
    const posMod = await prisma.module.upsert({
        where: { name: appModules.POINT_OF_SALE },
        update: {},
        create: { name: appModules.POINT_OF_SALE, createdAt: SEED_DATE }
    });
    const salesMod = await prisma.module.upsert({
        where: { name: appModules.SALES_MANAGEMENT },
        update: {},
        create: { name: appModules.SALES_MANAGEMENT, createdAt: SEED_DATE }
    });
    const reportsMod = await prisma.module.upsert({
        where: { name: appModules.REPORTS_MANAGEMENT },
        update: {},
        create: { name: appModules.REPORTS_MANAGEMENT, createdAt: SEED_DATE }
    });
    const customersMod = await prisma.module.upsert({
        where: { name: appModules.CUSTOMERS_MANAGEMENT },
        update: {},
        create: { name: appModules.CUSTOMERS_MANAGEMENT, createdAt: SEED_DATE }
    });
    const suppliersMod = await prisma.module.upsert({
        where: { name: appModules.SUPPLIERS_MANAGEMENT },
        update: {},
        create: { name: appModules.SUPPLIERS_MANAGEMENT, createdAt: SEED_DATE }
    });
    const storeSettingsMod = await prisma.module.upsert({
        where: { name: appModules.STORE_SETTINGS },
        update: {},
        create: { name: appModules.STORE_SETTINGS, createdAt: SEED_DATE }
    });
    const purchaseOrdersMod = await prisma.module.upsert({
        where: { name: appModules.PURCHASE_ORDERS_MANAGEMENT },
        update: {},
        create: { name: appModules.PURCHASE_ORDERS_MANAGEMENT, createdAt: SEED_DATE }
    });
    const transactionHistoryMod = await prisma.module.upsert({
        where: { name: appModules.TRANSACTION_HISTORY },
        update: {},
        create: { name: appModules.TRANSACTION_HISTORY, createdAt: SEED_DATE }
    });
    const orderQueueMod = await prisma.module.upsert({
        where: { name: appModules.ORDER_QUEUE },
        update: {},
        create: { name: appModules.ORDER_QUEUE, createdAt: SEED_DATE }
    });
    const menuMod = await prisma.module.upsert({
        where: { name: appModules.MENU },
        update: {},
        create: { name: appModules.MENU, createdAt: SEED_DATE }
    });
    const activityLogMod = await prisma.module.upsert({
        where: { name: appModules.ACTIVITY_LOGS },
        update: {},
        create: { name: appModules.ACTIVITY_LOGS, createdAt: SEED_DATE }
    });

    // ==========================================
    // 3. CREATE MODULE PERMISSIONS (Helper)
    // ==========================================
    // Since we now have a unique constraint on ModulePermission, we findFirst before create to remain idempotent
    async function ensureModPerm(moduleId: string, permissionId: string) {
        let mp = await prisma.modulePermission.findFirst({
            where: { moduleId, permissionId }
        });
        if (!mp) {
            mp = await prisma.modulePermission.create({
                data: { moduleId, permissionId, createdAt: SEED_DATE }
            });
        }
        return { modulePermissionId: mp.id, createdAt: SEED_DATE, updatedAt: SEED_DATE };
    }

    // Explicitly generate permission nodes we will use for roles:

    // Admin/Owner need an array of ALL nodes
    const allModules = [
        usersMod,
        rolesMod,
        productsMod,
        productSettingsMod,
        inventoryMod,
        ordersMod,
        posMod,
        salesMod,
        reportsMod,
        customersMod,
        suppliersMod,
        storeSettingsMod,
        purchaseOrdersMod,
        transactionHistoryMod,
        orderQueueMod,
        menuMod,
        activityLogMod
    ];

    //@eslint
    const allSystemPerms: { modulePermissionId: string; createdAt: Date; updatedAt: Date }[] = [];
    for (const m of allModules) {
        allSystemPerms.push(await ensureModPerm(m.id, create.id));
        allSystemPerms.push(await ensureModPerm(m.id, read.id));
        allSystemPerms.push(await ensureModPerm(m.id, update.id));
        allSystemPerms.push(await ensureModPerm(m.id, deletePerm.id));
    }

    // Specific explicit nodes for limited roles
    const mpPosCreateStore = await ensureModPerm(posMod.id, create.id);
    const mpPosReadStore = await ensureModPerm(posMod.id, read.id);
    const mpPosUpdateStore = await ensureModPerm(posMod.id, update.id);
    const mpPosDeleteStore = await ensureModPerm(posMod.id, deletePerm.id);

    const mpOrdersCreateStore = await ensureModPerm(ordersMod.id, create.id);
    const mpOrdersReadStore = await ensureModPerm(ordersMod.id, read.id);
    const mpOrdersUpdateStore = await ensureModPerm(ordersMod.id, update.id);

    const mpTransactionHistoryReadStore = await ensureModPerm(transactionHistoryMod.id, read.id);

    const mpSalesCreateStore = await ensureModPerm(salesMod.id, create.id);
    const mpSalesReadStore = await ensureModPerm(salesMod.id, read.id);

    const mpMenuReadStore = await ensureModPerm(menuMod.id, read.id);
    const mpProductsReadStore = await ensureModPerm(productsMod.id, read.id);
    const mpInventoryReadStore = await ensureModPerm(inventoryMod.id, read.id);

    const mpOrderQueueReadStore = await ensureModPerm(orderQueueMod.id, read.id);
    const mpOrderQueueUpdateStore = await ensureModPerm(orderQueueMod.id, update.id);

    // Customers should only access their own data
    const mpOrdersCreateOwn = await ensureModPerm(ordersMod.id, create.id);
    const mpOrdersReadOwn = await ensureModPerm(ordersMod.id, read.id);
    const mpCustomersReadOwn = await ensureModPerm(customersMod.id, read.id);
    const mpCustomersUpdateOwn = await ensureModPerm(customersMod.id, update.id);
    const mpMenuReadALL = await ensureModPerm(menuMod.id, read.id); // Menu is public

    // ==========================================
    // 4. CREATE ROLES EXPLICITLY
    // ==========================================

    const ownerRole = await prisma.role.upsert({
        where: { name: 'Owner' },
        update: {
            updatedAt: SEED_DATE,
            rolePermissions: {
                deleteMany: {},
                create: allSystemPerms
            }
        },
        create: {
            name: 'Owner',
            description: 'Business Owner with Full System Access (Dashboard, Reports)',
            isSystem: true,
            createdAt: SEED_DATE,
            updatedAt: SEED_DATE,
            rolePermissions: { create: allSystemPerms }
        }
    });

    const adminRole = await prisma.role.upsert({
        where: { name: 'Administrator' },
        update: {
            updatedAt: SEED_DATE,
            rolePermissions: {
                deleteMany: {},
                create: allSystemPerms
            }
        },
        create: {
            name: 'Administrator',
            description: 'Manager of Menu, Inventory, and Staff Accounts',
            isSystem: true,
            createdAt: SEED_DATE,
            updatedAt: SEED_DATE,
            rolePermissions: { create: allSystemPerms }
        }
    });

    const cashierRole = await prisma.role.upsert({
        where: { name: 'Cashier' },
        update: {
            updatedAt: SEED_DATE,
            rolePermissions: {
                deleteMany: {},
                create: [
                    mpPosCreateStore,
                    mpPosReadStore,
                    mpPosUpdateStore,
                    mpPosDeleteStore,
                    mpOrdersCreateStore,
                    mpOrdersReadStore,
                    mpOrdersUpdateStore,
                    mpTransactionHistoryReadStore,
                    mpSalesCreateStore,
                    mpSalesReadStore,
                    mpMenuReadStore,
                    mpProductsReadStore,
                    mpInventoryReadStore
                ]
            }
        },
        create: {
            name: 'Cashier',
            description: 'Handles POS, shift balancing, and transaction viewing',
            isSystem: true,
            createdAt: SEED_DATE,
            updatedAt: SEED_DATE,
            rolePermissions: {
                create: [
                    mpPosCreateStore,
                    mpPosReadStore,
                    mpPosUpdateStore,
                    mpPosDeleteStore,
                    mpOrdersCreateStore,
                    mpOrdersReadStore,
                    mpOrdersUpdateStore,
                    mpTransactionHistoryReadStore,
                    mpSalesCreateStore,
                    mpSalesReadStore,
                    mpMenuReadStore,
                    mpProductsReadStore,
                    mpInventoryReadStore
                ]
            }
        }
    });

    const baristaRole = await prisma.role.upsert({
        where: { name: 'Barista' },
        update: {
            updatedAt: SEED_DATE,
            rolePermissions: {
                deleteMany: {},
                create: [
                    mpOrderQueueReadStore,
                    mpOrderQueueUpdateStore,
                    mpOrdersReadStore,
                    mpMenuReadStore,
                    mpProductsReadStore,
                    mpInventoryReadStore
                ]
            }
        },
        create: {
            name: 'Barista',
            description: 'Handles Kitchen Display / Order Queue and views station stock',
            isSystem: true,
            createdAt: SEED_DATE,
            updatedAt: SEED_DATE,
            rolePermissions: {
                create: [
                    mpOrderQueueReadStore,
                    mpOrderQueueUpdateStore,
                    mpOrdersReadStore,
                    mpMenuReadStore,
                    mpProductsReadStore,
                    mpInventoryReadStore
                ]
            }
        }
    });

    const customerRole = await prisma.role.upsert({
        where: { name: 'Customer' },
        update: {
            updatedAt: SEED_DATE,
            rolePermissions: {
                deleteMany: {},
                create: [mpMenuReadALL, mpOrdersCreateOwn, mpOrdersReadOwn, mpCustomersReadOwn, mpCustomersUpdateOwn]
            }
        },
        create: {
            name: 'Customer',
            description: 'Online ordering patron',
            isSystem: true,
            createdAt: SEED_DATE,
            updatedAt: SEED_DATE,
            rolePermissions: {
                create: [
                    mpMenuReadALL, // Customers can read the global public menu
                    mpOrdersCreateOwn,
                    mpOrdersReadOwn,
                    mpCustomersReadOwn,
                    mpCustomersUpdateOwn
                ]
            }
        }
    });

    // ==========================================
    // 5. CREATE USERS EXPLICITLY
    // ==========================================
    const rawPassword = 'password123';
    const defaultPassword = await bcrypt.hash(rawPassword, 10);

    await prisma.user.upsert({
        where: { email: 'owner@bastakape.com' },
        update: { updatedAt: SEED_DATE },
        create: {
            email: 'owner@bastakape.com',
            username: 'ownerUser',
            password: defaultPassword,
            firstName: 'Business',
            lastName: 'Owner',
            createdAt: SEED_DATE,
            updatedAt: SEED_DATE,
            userRoles: { create: [{ roleId: ownerRole.id, createdAt: SEED_DATE, updatedAt: SEED_DATE }] }
        }
    });

    await prisma.user.upsert({
        where: { email: 'admin@bastakape.com' },
        update: { updatedAt: SEED_DATE },
        create: {
            email: 'admin@bastakape.com',
            username: 'adminUser',
            password: defaultPassword,
            firstName: 'System',
            lastName: 'Manager',
            createdAt: SEED_DATE,
            updatedAt: SEED_DATE,
            userRoles: { create: [{ roleId: adminRole.id, createdAt: SEED_DATE, updatedAt: SEED_DATE }] }
        }
    });

    await prisma.user.upsert({
        where: { email: 'cashier@bastakape.com' },
        update: { updatedAt: SEED_DATE },
        create: {
            email: 'cashier@bastakape.com',
            username: 'cashierUser',
            password: defaultPassword,
            firstName: 'Alice',
            lastName: 'Cashier',
            createdAt: SEED_DATE,
            updatedAt: SEED_DATE,
            userRoles: { create: [{ roleId: cashierRole.id, createdAt: SEED_DATE, updatedAt: SEED_DATE }] }
        }
    });

    await prisma.user.upsert({
        where: { email: 'barista@bastakape.com' },
        update: { updatedAt: SEED_DATE },
        create: {
            email: 'barista@bastakape.com',
            username: 'baristaUser',
            password: defaultPassword,
            firstName: 'Bob',
            lastName: 'Barista',
            createdAt: SEED_DATE,
            updatedAt: SEED_DATE,
            userRoles: { create: [{ roleId: baristaRole.id, createdAt: SEED_DATE, updatedAt: SEED_DATE }] }
        }
    });

    // Customer
    await prisma.user.upsert({
        where: { email: 'customer@bastakape.com' },
        update: { updatedAt: SEED_DATE },
        create: {
            email: 'customer@bastakape.com',
            username: 'customerUser',
            password: defaultPassword,
            firstName: 'Charlie',
            lastName: 'Customer',
            createdAt: SEED_DATE,
            updatedAt: SEED_DATE,
            userRoles: { create: [{ roleId: customerRole.id, createdAt: SEED_DATE, updatedAt: SEED_DATE }] },
            customer: { create: { createdAt: SEED_DATE, updatedAt: SEED_DATE } }
        }
    });

    console.log('Explicit Users & Roles Seeded successfully!');
}
