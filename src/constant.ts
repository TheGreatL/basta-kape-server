export const dataStatus = {
    ACTIVE: 'active',
    ARCHIVE: 'archive'
} as const;

export type TDataStatus = (typeof dataStatus)[keyof typeof dataStatus];

export const dataStatusEnum = Object.values(dataStatus);

export const appModules = {
    USERS_MANAGEMENT: 'Users Management',
    ROLES_AND_PERMISSIONS: 'Roles and Permissions',
    PRODUCTS_MANAGEMENT: 'Products Management',
    PRODUCT_SETTINGS_MANAGEMENT: 'Product Settings Management',
    INVENTORY_MANAGEMENT: 'Inventory Management',
    ORDERS_MANAGEMENT: 'Orders Management',
    POINT_OF_SALE: 'Point of Sale (POS)',
    SALES_MANAGEMENT: 'Sales Management',
    REPORTS_MANAGEMENT: 'Reports Management',
    CUSTOMERS_MANAGEMENT: 'Customers Management',
    SUPPLIERS_MANAGEMENT: 'Suppliers Management',
    STORE_SETTINGS: 'Store Settings',
    PURCHASE_ORDERS_MANAGEMENT: 'Purchase Orders Management',
    TRANSACTION_HISTORY: 'Transaction History',
    ORDER_QUEUE: 'Order Queue',
    MENU: 'Menu'
} as const;

export type TAppModule = (typeof appModules)[keyof typeof appModules];

export const appPermissions = {
    CREATE: 'create',
    READ: 'read',
    UPDATE: 'update',
    DELETE: 'delete'
} as const;

export type TAppPermission = (typeof appPermissions)[keyof typeof appPermissions];
