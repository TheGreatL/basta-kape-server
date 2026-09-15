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
    const foodPrepMod = await prisma.module.upsert({
        where: { name: appModules.FOOD_PREPARATION },
        update: {},
        create: { name: appModules.FOOD_PREPARATION, createdAt: SEED_DATE }
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

    async function getPermNodes(
        module: { id: string },
        perms: { id: string }[]
    ): Promise<{ modulePermissionId: string; createdAt: Date; updatedAt: Date }[]> {
        const nodes: { modulePermissionId: string; createdAt: Date; updatedAt: Date }[] = [];
        for (const p of perms) {
            nodes.push(await ensureModPerm(module.id, p.id));
        }
        return nodes;
    }

    function deduplicatePerms(
        perms: { modulePermissionId: string; createdAt: Date; updatedAt: Date }[]
    ): { modulePermissionId: string; createdAt: Date; updatedAt: Date }[] {
        const seen = new Set<string>();
        return perms.filter((p) => {
            if (seen.has(p.modulePermissionId)) {
                return false;
            }
            seen.add(p.modulePermissionId);
            return true;
        });
    }

    // Standard permission sets
    const crud = [create, read, update, deletePerm];
    const readOnly = [read];
    const readUpdate = [read, update];
    const createRead = [create, read];
    const createReadUpdate = [create, read, update];

    // Explicit scoped permission sets for each role:

    // 1. OWNER SCOPE
    // Business Owner with Executive Access:
    // - Full financial reports & sales analytics (Reports Management, Sales Management)
    // - Activity logs & audit review
    // - System-wide monitoring and dashboard overview (Read-only on all shop operational modules)
    // - No routine daily operations (no taking orders, no editing menu prices, no logging deliveries)
    const ownerPerms = deduplicatePerms([
        ...(await getPermNodes(reportsMod, crud)),
        ...(await getPermNodes(salesMod, crud)),
        ...(await getPermNodes(activityLogMod, readOnly)),
        ...(await getPermNodes(usersMod, readOnly)),
        ...(await getPermNodes(rolesMod, readOnly)),
        ...(await getPermNodes(productsMod, readOnly)),
        ...(await getPermNodes(productSettingsMod, readOnly)),
        ...(await getPermNodes(inventoryMod, readOnly)),
        ...(await getPermNodes(ordersMod, readOnly)),
        ...(await getPermNodes(posMod, readOnly)),
        ...(await getPermNodes(customersMod, readOnly)),
        ...(await getPermNodes(suppliersMod, readOnly)),
        ...(await getPermNodes(storeSettingsMod, readOnly)),
        ...(await getPermNodes(purchaseOrdersMod, readOnly)),
        ...(await getPermNodes(transactionHistoryMod, readOnly)),
        ...(await getPermNodes(orderQueueMod, readOnly)),
        ...(await getPermNodes(menuMod, readOnly))
    ]);

    // 2. ADMINISTRATOR SCOPE
    // Management & configuration scope:
    // - Menu & Recipe Management (Products, Product Settings, Menu)
    // - Master Inventory & Restock (Inventory, Suppliers, Purchase Orders)
    // - User Account & Staff Management (Users, Roles & Permissions)
    // - Store Settings & Discount Config (Store Settings)
    // - Customer Management (Customers)
    // - Operational Dashboard & Monitoring (Orders read/update, Order Queue read, Transaction History read, Activity Logs read)
    // - Order void approval (Point of Sale read & delete for void authorization)
    // - Excludes Executive Financial Reports and counter POS order processing
    const adminPerms = deduplicatePerms([
        ...(await getPermNodes(usersMod, crud)),
        ...(await getPermNodes(rolesMod, crud)),
        ...(await getPermNodes(productsMod, crud)),
        ...(await getPermNodes(productSettingsMod, crud)),
        ...(await getPermNodes(inventoryMod, crud)),
        ...(await getPermNodes(suppliersMod, crud)),
        ...(await getPermNodes(purchaseOrdersMod, crud)),
        ...(await getPermNodes(storeSettingsMod, crud)),
        ...(await getPermNodes(customersMod, crud)),
        ...(await getPermNodes(menuMod, crud)),
        ...(await getPermNodes(ordersMod, readUpdate)),
        ...(await getPermNodes(orderQueueMod, readOnly)),
        ...(await getPermNodes(transactionHistoryMod, readOnly)),
        ...(await getPermNodes(activityLogMod, readOnly)),
        ...(await getPermNodes(posMod, [read, deletePerm]))
    ]);

    // 3. CASHIER SCOPE
    // Front-counter operations scope:
    // - Ordering & Checkout (Point of Sale create/read/update, Orders create/read/update)
    // - Shift sales report & drawer balancing (Sales Management create/read)
    // - Transaction history (Transaction History read/update for receipt upload)
    // - Customer profile creation/search at counter (Customers Management create/read/update)
    // - Station stock & menu viewing (Inventory read, Menu read, Products read, Product Settings read)
    // - Restricted from deleting past records or voiding orders without admin approval
    const cashierPerms = deduplicatePerms([
        ...(await getPermNodes(posMod, createReadUpdate)),
        ...(await getPermNodes(ordersMod, createReadUpdate)),
        ...(await getPermNodes(orderQueueMod, readOnly)),
        ...(await getPermNodes(transactionHistoryMod, readUpdate)),
        ...(await getPermNodes(salesMod, createRead)),
        ...(await getPermNodes(customersMod, createReadUpdate)),
        ...(await getPermNodes(menuMod, readOnly)),
        ...(await getPermNodes(productsMod, readOnly)),
        ...(await getPermNodes(productSettingsMod, readOnly)),
        ...(await getPermNodes(inventoryMod, readOnly))
    ]);

    // 4. BARISTA SCOPE
    // Drink preparation & Kitchen Display scope:
    // - Live Order Queue / Kitchen Display & queue stats (Order Queue read/update)
    // - Order status controls (Orders Management read/update)
    // - Station stock viewer (Inventory Management read-only)
    // - Digital menu & drink recipe reference (Menu read, Products read, Product Settings read)
    const baristaPerms = deduplicatePerms([
        ...(await getPermNodes(orderQueueMod, readUpdate)),
        ...(await getPermNodes(ordersMod, readUpdate)),
        ...(await getPermNodes(menuMod, readOnly)),
        ...(await getPermNodes(productsMod, readOnly)),
        ...(await getPermNodes(productSettingsMod, readOnly)),
        ...(await getPermNodes(inventoryMod, readOnly)),
        ...(await getPermNodes(foodPrepMod, createReadUpdate))
    ]);

    // 5. CUSTOMER SCOPE
    // Online ordering patron scope:
    // - Public digital menu viewing (Menu read)
    // - Create and view own orders (Orders create/read)
    // - View and update own customer profile (Customers read/update)
    const customerPerms = deduplicatePerms([
        ...(await getPermNodes(menuMod, readOnly)),
        ...(await getPermNodes(ordersMod, createRead)),
        ...(await getPermNodes(customersMod, readUpdate))
    ]);

    // ==========================================
    // 4. CREATE ROLES EXPLICITLY
    // ==========================================

    const ownerRole = await prisma.role.upsert({
        where: { name: 'Owner' },
        update: {
            description: 'Business Owner with Executive Access (Dashboard, Reports, and System-wide Monitoring)',
            updatedAt: SEED_DATE,
            rolePermissions: {
                deleteMany: {},
                create: ownerPerms
            }
        },
        create: {
            name: 'Owner',
            description: 'Business Owner with Executive Access (Dashboard, Reports, and System-wide Monitoring)',
            isSystem: true,
            createdAt: SEED_DATE,
            updatedAt: SEED_DATE,
            rolePermissions: { create: ownerPerms }
        }
    });

    const adminRole = await prisma.role.upsert({
        where: { name: 'Administrator' },
        update: {
            description: 'Administrator with Management Scope (Menu, Inventory, Users, Store Settings)',
            updatedAt: SEED_DATE,
            rolePermissions: {
                deleteMany: {},
                create: adminPerms
            }
        },
        create: {
            name: 'Administrator',
            description: 'Administrator with Management Scope (Menu, Inventory, Users, Store Settings)',
            isSystem: true,
            createdAt: SEED_DATE,
            updatedAt: SEED_DATE,
            rolePermissions: { create: adminPerms }
        }
    });

    const cashierRole = await prisma.role.upsert({
        where: { name: 'Cashier' },
        update: {
            description: 'Handles POS counter checkout, shift sales balancing, and transaction history',
            updatedAt: SEED_DATE,
            rolePermissions: {
                deleteMany: {},
                create: cashierPerms
            }
        },
        create: {
            name: 'Cashier',
            description: 'Handles POS counter checkout, shift sales balancing, and transaction history',
            isSystem: true,
            createdAt: SEED_DATE,
            updatedAt: SEED_DATE,
            rolePermissions: { create: cashierPerms }
        }
    });

    const baristaRole = await prisma.role.upsert({
        where: { name: 'Barista' },
        update: {
            description: 'Handles Kitchen Display / Order Queue, status updates, and station stock viewing',
            updatedAt: SEED_DATE,
            rolePermissions: {
                deleteMany: {},
                create: baristaPerms
            }
        },
        create: {
            name: 'Barista',
            description: 'Handles Kitchen Display / Order Queue, status updates, and station stock viewing',
            isSystem: true,
            createdAt: SEED_DATE,
            updatedAt: SEED_DATE,
            rolePermissions: { create: baristaPerms }
        }
    });

    const customerRole = await prisma.role.upsert({
        where: { name: 'Customer' },
        update: {
            description: 'Online ordering patron',
            updatedAt: SEED_DATE,
            rolePermissions: {
                deleteMany: {},
                create: customerPerms
            }
        },
        create: {
            name: 'Customer',
            description: 'Online ordering patron',
            isSystem: true,
            createdAt: SEED_DATE,
            updatedAt: SEED_DATE,
            rolePermissions: { create: customerPerms }
        }
    });

    // ==========================================
    // 5. CREATE USERS EXPLICITLY
    // ==========================================
    const rawPassword = 'password123';
    const defaultPassword = await bcrypt.hash(rawPassword, 10);

    await prisma.user.upsert({
        where: { email: 'owner@bastakape.com' },
        update: { updatedAt: SEED_DATE, roleId: ownerRole.id },
        create: {
            email: 'owner@bastakape.com',
            username: 'ownerUser',
            password: defaultPassword,
            firstName: 'Business',
            lastName: 'Owner',
            createdAt: SEED_DATE,
            updatedAt: SEED_DATE,
            roleId: ownerRole.id
        }
    });

    await prisma.user.upsert({
        where: { email: 'admin@bastakape.com' },
        update: { updatedAt: SEED_DATE, roleId: adminRole.id },
        create: {
            email: 'admin@bastakape.com',
            username: 'adminUser',
            password: defaultPassword,
            firstName: 'System',
            lastName: 'Manager',
            createdAt: SEED_DATE,
            updatedAt: SEED_DATE,
            roleId: adminRole.id
        }
    });

    await prisma.user.upsert({
        where: { email: 'cashier@bastakape.com' },
        update: { updatedAt: SEED_DATE, roleId: cashierRole.id },
        create: {
            email: 'cashier@bastakape.com',
            username: 'cashierUser',
            password: defaultPassword,
            firstName: 'Alice',
            lastName: 'Cashier',
            createdAt: SEED_DATE,
            updatedAt: SEED_DATE,
            roleId: cashierRole.id
        }
    });

    await prisma.user.upsert({
        where: { email: 'barista@bastakape.com' },
        update: { updatedAt: SEED_DATE, roleId: baristaRole.id },
        create: {
            email: 'barista@bastakape.com',
            username: 'baristaUser',
            password: defaultPassword,
            firstName: 'Bob',
            lastName: 'Barista',
            createdAt: SEED_DATE,
            updatedAt: SEED_DATE,
            roleId: baristaRole.id
        }
    });

    // Customer
    await prisma.user.upsert({
        where: { email: 'customer@bastakape.com' },
        update: { updatedAt: SEED_DATE, roleId: customerRole.id },
        create: {
            email: 'customer@bastakape.com',
            username: 'customerUser',
            password: defaultPassword,
            firstName: 'Charlie',
            lastName: 'Customer',
            createdAt: SEED_DATE,
            updatedAt: SEED_DATE,
            roleId: customerRole.id,
            customer: { create: { createdAt: SEED_DATE, updatedAt: SEED_DATE } }
        }
    });

    console.log('Explicit Users & Roles Seeded successfully!');
}
