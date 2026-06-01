import { PrismaClient, AccessScope } from '@prisma/client';
import bcrypt from 'bcryptjs';

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
        where: { name: 'Users Management' },
        update: {},
        create: { name: 'Users Management' }
    });
    const rolesMod = await prisma.module.upsert({
        where: { name: 'Roles and Permissions' },
        update: {},
        create: { name: 'Roles and Permissions' }
    });
    const productsMod = await prisma.module.upsert({
        where: { name: 'Products Management' },
        update: {},
        create: { name: 'Products Management' }
    });
    const productSettingsMod = await prisma.module.upsert({
        where: { name: 'Product Settings Management' },
        update: {},
        create: { name: 'Product Settings Management' }
    });
    const inventoryMod = await prisma.module.upsert({
        where: { name: 'Inventory Management' },
        update: {},
        create: { name: 'Inventory Management' }
    });
    const ordersMod = await prisma.module.upsert({
        where: { name: 'Orders Management' },
        update: {},
        create: { name: 'Orders Management' }
    });
    const posMod = await prisma.module.upsert({
        where: { name: 'Point of Sale (POS)' },
        update: {},
        create: { name: 'Point of Sale (POS)' }
    });
    const salesMod = await prisma.module.upsert({
        where: { name: 'Sales Management' },
        update: {},
        create: { name: 'Sales Management' }
    });
    const reportsMod = await prisma.module.upsert({
        where: { name: 'Reports Management' },
        update: {},
        create: { name: 'Reports Management' }
    });
    const customersMod = await prisma.module.upsert({
        where: { name: 'Customers Management' },
        update: {},
        create: { name: 'Customers Management' }
    });
    const suppliersMod = await prisma.module.upsert({
        where: { name: 'Suppliers Management' },
        update: {},
        create: { name: 'Suppliers Management' }
    });
    const storeSettingsMod = await prisma.module.upsert({
        where: { name: 'Store Settings' },
        update: {},
        create: { name: 'Store Settings' }
    });
    const purchaseOrdersMod = await prisma.module.upsert({
        where: { name: 'Purchase Orders Management' },
        update: {},
        create: { name: 'Purchase Orders Management' }
    });
    const transactionHistoryMod = await prisma.module.upsert({
        where: { name: 'Transaction History' },
        update: {},
        create: { name: 'Transaction History' }
    });
    const orderQueueMod = await prisma.module.upsert({
        where: { name: 'Order Queue' },
        update: {},
        create: { name: 'Order Queue' }
    });
    const menuMod = await prisma.module.upsert({
        where: { name: 'Menu' },
        update: {},
        create: { name: 'Menu' }
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
        menuMod
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
        update: {},
        create: {
            name: 'Owner',
            description: 'Business Owner with Full System Access (Dashboard, Reports)',
            isSystem: true,
            rolePermissions: { create: allSystemPerms }
        }
    });

    const adminRole = await prisma.role.upsert({
        where: { name: 'Administrator' },
        update: {},
        create: {
            name: 'Administrator',
            description: 'Manager of Menu, Inventory, and Staff Accounts',
            isSystem: true,
            rolePermissions: { create: allSystemPerms }
        }
    });

    const cashierRole = await prisma.role.upsert({
        where: { name: 'Cashier' },
        update: {},
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
        update: {},
        create: {
            name: 'Barista',
            description: 'Handles Kitchen Display / Order Queue and views station stock',
            isSystem: true,
            rolePermissions: {
                create: [mpOrderQueueReadStore, mpOrderQueueUpdateStore, mpMenuReadStore, mpProductsReadStore, mpInventoryReadStore]
            }
        }
    });

    const customerRole = await prisma.role.upsert({
        where: { name: 'Customer' },
        update: {},
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
