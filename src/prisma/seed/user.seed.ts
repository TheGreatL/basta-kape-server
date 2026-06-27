import { PrismaClient, AccessScope } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { appModules } from '../../constant';

export async function seedUsers(prisma: PrismaClient) {
    console.log('Seeding explicitly: Users, Roles, and Permissions...');

    // ==========================================
    // 1. CREATE PERMISSIONS
    // ==========================================
    const create = await prisma.permission.upsert({
        where: { name: 'create' },
        update: {},
        create: { name: 'create', description: 'Allow users to create new records' }
    });
    const read = await prisma.permission.upsert({
        where: { name: 'read' },
        update: {},
        create: { name: 'read', description: 'Allow users to read records' }
    });
    const update = await prisma.permission.upsert({
        where: { name: 'update' },
        update: {},
        create: { name: 'update', description: 'Allow users to update records' }
    });
    const deletePerm = await prisma.permission.upsert({
        where: { name: 'delete' },
        update: {},
        create: { name: 'delete', description: 'Allow users to delete records' }
    });

    // ==========================================
    // 2. CREATE MODULES
    // ==========================================
    const usersMod = await prisma.module.upsert({
        where: { name: appModules.USERS_MANAGEMENT },
        update: {},
        create: { name: appModules.USERS_MANAGEMENT }
    });
    const rolesMod = await prisma.module.upsert({
        where: { name: appModules.ROLES_AND_PERMISSIONS },
        update: {},
        create: { name: appModules.ROLES_AND_PERMISSIONS }
    });
    const productsMod = await prisma.module.upsert({
        where: { name: appModules.PRODUCTS_MANAGEMENT },
        update: {},
        create: { name: appModules.PRODUCTS_MANAGEMENT }
    });
    const productSettingsMod = await prisma.module.upsert({
        where: { name: appModules.PRODUCT_SETTINGS_MANAGEMENT },
        update: {},
        create: { name: appModules.PRODUCT_SETTINGS_MANAGEMENT }
    });
    const inventoryMod = await prisma.module.upsert({
        where: { name: appModules.INVENTORY_MANAGEMENT },
        update: {},
        create: { name: appModules.INVENTORY_MANAGEMENT }
    });
    const ordersMod = await prisma.module.upsert({
        where: { name: appModules.ORDERS_MANAGEMENT },
        update: {},
        create: { name: appModules.ORDERS_MANAGEMENT }
    });
    const posMod = await prisma.module.upsert({
        where: { name: appModules.POINT_OF_SALE },
        update: {},
        create: { name: appModules.POINT_OF_SALE }
    });
    const salesMod = await prisma.module.upsert({
        where: { name: appModules.SALES_MANAGEMENT },
        update: {},
        create: { name: appModules.SALES_MANAGEMENT }
    });
    const reportsMod = await prisma.module.upsert({
        where: { name: appModules.REPORTS_MANAGEMENT },
        update: {},
        create: { name: appModules.REPORTS_MANAGEMENT }
    });
    const customersMod = await prisma.module.upsert({
        where: { name: appModules.CUSTOMERS_MANAGEMENT },
        update: {},
        create: { name: appModules.CUSTOMERS_MANAGEMENT }
    });
    const suppliersMod = await prisma.module.upsert({
        where: { name: appModules.SUPPLIERS_MANAGEMENT },
        update: {},
        create: { name: appModules.SUPPLIERS_MANAGEMENT }
    });
    const storeSettingsMod = await prisma.module.upsert({
        where: { name: appModules.STORE_SETTINGS },
        update: {},
        create: { name: appModules.STORE_SETTINGS }
    });
    const purchaseOrdersMod = await prisma.module.upsert({
        where: { name: appModules.PURCHASE_ORDERS_MANAGEMENT },
        update: {},
        create: { name: appModules.PURCHASE_ORDERS_MANAGEMENT }
    });
    const transactionHistoryMod = await prisma.module.upsert({
        where: { name: appModules.TRANSACTION_HISTORY },
        update: {},
        create: { name: appModules.TRANSACTION_HISTORY }
    });
    const orderQueueMod = await prisma.module.upsert({
        where: { name: appModules.ORDER_QUEUE },
        update: {},
        create: { name: appModules.ORDER_QUEUE }
    });
    const menuMod = await prisma.module.upsert({
        where: { name: appModules.MENU },
        update: {},
        create: { name: appModules.MENU }
    });
    const activityLogMod = await prisma.module.upsert({
        where: { name: appModules.ACTIVITY_LOGS },
        update: {},
        create: { name: appModules.ACTIVITY_LOGS }
    });

    // ==========================================
    // 3. CREATE MODULE PERMISSIONS (Helper)
    // ==========================================
    // Since there's no unique constraint on ModulePermission, we findFirst before create to remain idempotent
    async function ensureModPerm(moduleId: string, permissionId: string, accessScope: AccessScope = AccessScope.ALL) {
        let mp = await prisma.modulePermission.findFirst({
            where: { moduleId, permissionId, accessScope }
        });
        if (!mp) {
            mp = await prisma.modulePermission.create({
                data: { moduleId, permissionId, accessScope }
            });
        }
        return { modulePermissionId: mp.id };
    }

    // Explicitly generate permission nodes we will use for roles:

    // Admin/Owner need an array of ALL nodes (AccessScope.ALL)
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
    const allSystemPerms: { modulePermissionId: string }[] = [];
    for (const m of allModules) {
        allSystemPerms.push(await ensureModPerm(m.id, create.id, AccessScope.ALL));
        allSystemPerms.push(await ensureModPerm(m.id, read.id, AccessScope.ALL));
        allSystemPerms.push(await ensureModPerm(m.id, update.id, AccessScope.ALL));
        allSystemPerms.push(await ensureModPerm(m.id, deletePerm.id, AccessScope.ALL));
    }

    // Specific explicit nodes for limited roles (AccessScope.STORE for staff)
    const mpPosCreateStore = await ensureModPerm(posMod.id, create.id, AccessScope.STORE);
    const mpPosReadStore = await ensureModPerm(posMod.id, read.id, AccessScope.STORE);
    const mpPosUpdateStore = await ensureModPerm(posMod.id, update.id, AccessScope.STORE);
    const mpPosDeleteStore = await ensureModPerm(posMod.id, deletePerm.id, AccessScope.STORE);

    const mpOrdersCreateStore = await ensureModPerm(ordersMod.id, create.id, AccessScope.STORE);
    const mpOrdersReadStore = await ensureModPerm(ordersMod.id, read.id, AccessScope.STORE);
    const mpOrdersUpdateStore = await ensureModPerm(ordersMod.id, update.id, AccessScope.STORE);

    const mpTransactionHistoryReadStore = await ensureModPerm(transactionHistoryMod.id, read.id, AccessScope.STORE);

    const mpSalesCreateStore = await ensureModPerm(salesMod.id, create.id, AccessScope.STORE);
    const mpSalesReadStore = await ensureModPerm(salesMod.id, read.id, AccessScope.STORE);

    const mpMenuReadStore = await ensureModPerm(menuMod.id, read.id, AccessScope.STORE);
    const mpProductsReadStore = await ensureModPerm(productsMod.id, read.id, AccessScope.STORE);
    const mpInventoryReadStore = await ensureModPerm(inventoryMod.id, read.id, AccessScope.STORE);

    const mpOrderQueueReadStore = await ensureModPerm(orderQueueMod.id, read.id, AccessScope.STORE);
    const mpOrderQueueUpdateStore = await ensureModPerm(orderQueueMod.id, update.id, AccessScope.STORE);

    // Customers should only access their OWN data (AccessScope.OWN)
    const mpOrdersCreateOwn = await ensureModPerm(ordersMod.id, create.id, AccessScope.OWN);
    const mpOrdersReadOwn = await ensureModPerm(ordersMod.id, read.id, AccessScope.OWN);
    const mpCustomersReadOwn = await ensureModPerm(customersMod.id, read.id, AccessScope.OWN);
    const mpCustomersUpdateOwn = await ensureModPerm(customersMod.id, update.id, AccessScope.OWN);
    const mpMenuReadALL = await ensureModPerm(menuMod.id, read.id, AccessScope.ALL); // Menu is public

    // ==========================================
    // 4. CREATE ROLES EXPLICITLY
    // ==========================================

    const ownerRole = await prisma.role.upsert({
        where: { name: 'Owner' },
        update: {
            rolePermissions: {
                deleteMany: {},
                create: allSystemPerms
            }
        },
        create: {
            name: 'Owner',
            description: 'Business Owner with Full System Access (Dashboard, Reports)',
            isSystem: true,
            rolePermissions: { create: allSystemPerms }
        }
    });

    const adminRole = await prisma.role.upsert({
        where: { name: 'Administrator' },
        update: {
            rolePermissions: {
                deleteMany: {},
                create: allSystemPerms
            }
        },
        create: {
            name: 'Administrator',
            description: 'Manager of Menu, Inventory, and Staff Accounts',
            isSystem: true,
            rolePermissions: { create: allSystemPerms }
        }
    });

    const managerRole = await prisma.role.upsert({
        where: { name: 'Manager' },
        update: {
            rolePermissions: {
                deleteMany: {},
                create: allSystemPerms
            }
        },
        create: {
            name: 'Manager',
            description: 'Store Manager who can override transactions and manage operations',
            isSystem: true,
            rolePermissions: { create: allSystemPerms }
        }
    });

    const supervisorRole = await prisma.role.upsert({
        where: { name: 'Supervisor' },
        update: {
            rolePermissions: {
                deleteMany: {},
                create: allSystemPerms
            }
        },
        create: {
            name: 'Supervisor',
            description: 'Shift Supervisor who can authorize voids and refunds',
            isSystem: true,
            rolePermissions: { create: allSystemPerms }
        }
    });

    const cashierRole = await prisma.role.upsert({
        where: { name: 'Cashier' },
        update: {
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
            rolePermissions: {
                deleteMany: {},
                create: [mpMenuReadALL, mpOrdersCreateOwn, mpOrdersReadOwn, mpCustomersReadOwn, mpCustomersUpdateOwn]
            }
        },
        create: {
            name: 'Customer',
            description: 'Online ordering patron',
            isSystem: true,
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
        update: {},
        create: {
            email: 'owner@bastakape.com',
            username: 'ownerUser',
            password: defaultPassword,
            firstName: 'Business',
            lastName: 'Owner',
            userRoles: { create: [{ roleId: ownerRole.id }] }
        }
    });

    await prisma.user.upsert({
        where: { email: 'admin@bastakape.com' },
        update: {},
        create: {
            email: 'admin@bastakape.com',
            username: 'adminUser',
            password: defaultPassword,
            firstName: 'System',
            lastName: 'Manager',
            userRoles: { create: [{ roleId: adminRole.id }] }
        }
    });

    await prisma.user.upsert({
        where: { email: 'manager@bastakape.com' },
        update: {},
        create: {
            email: 'manager@bastakape.com',
            username: 'managerUser',
            password: defaultPassword,
            firstName: 'Manny',
            lastName: 'Manager',
            userRoles: { create: [{ roleId: managerRole.id }] }
        }
    });

    await prisma.user.upsert({
        where: { email: 'supervisor@bastakape.com' },
        update: {},
        create: {
            email: 'supervisor@bastakape.com',
            username: 'supervisorUser',
            password: defaultPassword,
            firstName: 'Sally',
            lastName: 'Supervisor',
            userRoles: { create: [{ roleId: supervisorRole.id }] }
        }
    });

    await prisma.user.upsert({
        where: { email: 'cashier@bastakape.com' },
        update: {},
        create: {
            email: 'cashier@bastakape.com',
            username: 'cashierUser',
            password: defaultPassword,
            firstName: 'Alice',
            lastName: 'Cashier',
            userRoles: { create: [{ roleId: cashierRole.id }] }
        }
    });

    await prisma.user.upsert({
        where: { email: 'barista@bastakape.com' },
        update: {},
        create: {
            email: 'barista@bastakape.com',
            username: 'baristaUser',
            password: defaultPassword,
            firstName: 'Bob',
            lastName: 'Barista',
            userRoles: { create: [{ roleId: baristaRole.id }] }
        }
    });

    // Customer
    await prisma.user.upsert({
        where: { email: 'customer@bastakape.com' },
        update: {},
        create: {
            email: 'customer@bastakape.com',
            username: 'customerUser',
            password: defaultPassword,
            firstName: 'Charlie',
            lastName: 'Customer',
            userRoles: { create: [{ roleId: customerRole.id }] },
            customer: { create: {} }
        }
    });

    console.log('Explicit Users & Roles Seeded successfully!');
}
