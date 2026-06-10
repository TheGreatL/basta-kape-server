import { z } from 'zod';
import { appModules } from '@/constant';

export const REPORT_EXPORT_FORMATS = ['excel', 'pdf'] as const;
export type TReportExportFormat = (typeof REPORT_EXPORT_FORMATS)[number];

export const ReportModuleSchema = z.enum([
    'products',
    'inventory-ingredients',
    'inventory-levels',
    'inventory-deliveries',
    'inventory-adjustments',
    'customers',
    'suppliers',
    'activity-logs',
    'orders'
]);

export type TReportModule = z.infer<typeof ReportModuleSchema>;

export const ReportFiltersSchema = z.object({
    search: z.string().optional(),
    status: z.enum(['active', 'archive']).default('active').optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    productCategoryId: z.string().optional(),
    productTypeId: z.string().optional(),
    inventoryStatus: z.enum(['SAFE', 'CRITICAL', 'OUT_OF_STOCK']).optional(),
    orderStatus: z.enum(['PENDING', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED']).optional(),
    orderType: z.enum(['DINE_IN', 'TAKE_OUT', 'DELIVERY']).optional()
});

export type TReportFilters = z.infer<typeof ReportFiltersSchema>;

export const ReportPreviewSchema = z.object({
    module: ReportModuleSchema,
    filters: ReportFiltersSchema.default({}),
    page: z.coerce.number().min(1).default(1).optional(),
    limit: z.coerce.number().min(1).max(100).default(20).optional()
});

export type TReportPreviewRequest = z.infer<typeof ReportPreviewSchema>;

export const ReportExportSchema = z.object({
    module: ReportModuleSchema,
    filters: ReportFiltersSchema.default({}),
    format: z.enum(REPORT_EXPORT_FORMATS),
    title: z.string().min(1).max(200).optional()
});

export type TReportExportRequest = z.infer<typeof ReportExportSchema>;

export type TReportFilterField = {
    key: keyof TReportFilters;
    label: string;
    type: 'text' | 'select' | 'date';
    options?: { value: string; label: string }[];
};

export type TReportColumn = {
    key: string;
    header: string;
    width?: number;
    align?: 'left' | 'center' | 'right';
};

export type TReportModuleDefinition = {
    id: TReportModule;
    label: string;
    description: string;
    sourceModule: (typeof appModules)[keyof typeof appModules];
    filters: TReportFilterField[];
    columns: TReportColumn[];
};

export type TReportRow = Record<string, string | number | null>;

export type TReportActor = {
    id: string;
    fullName: string;
    email: string;
    username: string;
};

export type TReportStoreInfo = {
    storeName: string;
    address: string;
};

export type TReportDataset = {
    module: TReportModule;
    title: string;
    columns: TReportColumn[];
    rows: TReportRow[];
    meta: {
        total: number;
        generatedAt: string;
        filters: TReportFilters;
        truncated: boolean;
        generatedBy: TReportActor;
        store: TReportStoreInfo;
    };
};

export const ReportColumnSchema = z.object({
    key: z.string(),
    header: z.string(),
    width: z.number().optional(),
    align: z.enum(['left', 'center', 'right']).optional()
});

export const ReportFilterFieldSchema = z.object({
    key: z.string(),
    label: z.string(),
    type: z.enum(['text', 'select', 'date']),
    options: z
        .array(
            z.object({
                value: z.string(),
                label: z.string()
            })
        )
        .optional()
});

export const ReportModuleDefinitionSchema = z.object({
    id: ReportModuleSchema,
    label: z.string(),
    description: z.string(),
    sourceModule: z.string(),
    filters: z.array(ReportFilterFieldSchema),
    columns: z.array(ReportColumnSchema)
});

export const ReportModulesResponseSchema = z.object({
    data: z.array(ReportModuleDefinitionSchema)
});

export const ReportPreviewResponseSchema = z.object({
    module: ReportModuleSchema,
    title: z.string(),
    columns: z.array(ReportColumnSchema),
    rows: z.array(z.record(z.string(), z.union([z.string(), z.number(), z.null()]))),
    meta: z.object({
        total: z.number(),
        page: z.number(),
        limit: z.number(),
        pageCount: z.number(),
        hasMore: z.boolean(),
        generatedAt: z.string(),
        filters: ReportFiltersSchema
    })
});

const commonStatusFilter: TReportFilterField = {
    key: 'status',
    label: 'Record Status',
    type: 'select',
    options: [
        { value: 'active', label: 'Active' },
        { value: 'archive', label: 'Archived' }
    ]
};

const commonDateFilters: TReportFilterField[] = [
    { key: 'dateFrom', label: 'Date From', type: 'date' },
    { key: 'dateTo', label: 'Date To', type: 'date' }
];

export const REPORT_MODULE_CATALOG: TReportModuleDefinition[] = [
    {
        id: 'products',
        label: 'Products',
        description: 'Product catalog with category, type, and variant counts.',
        sourceModule: appModules.PRODUCTS_MANAGEMENT,
        filters: [
            { key: 'search', label: 'Search', type: 'text' },
            commonStatusFilter,
            { key: 'productCategoryId', label: 'Category ID', type: 'text' },
            { key: 'productTypeId', label: 'Type ID', type: 'text' },
            ...commonDateFilters
        ],
        columns: [
            { key: 'name', header: 'Product Name', width: 28 },
            { key: 'category', header: 'Category', width: 18 },
            { key: 'type', header: 'Type', width: 18 },
            { key: 'variantCount', header: 'Variants', width: 12, align: 'right' },
            { key: 'description', header: 'Description', width: 32 },
            { key: 'createdAt', header: 'Created At', width: 22 }
        ]
    },
    {
        id: 'inventory-ingredients',
        label: 'Inventory Ingredients',
        description: 'Raw ingredients with units and reorder points.',
        sourceModule: appModules.INVENTORY_MANAGEMENT,
        filters: [{ key: 'search', label: 'Search', type: 'text' }, commonStatusFilter, ...commonDateFilters],
        columns: [
            { key: 'name', header: 'Ingredient', width: 24 },
            { key: 'unit', header: 'Unit', width: 12 },
            { key: 'reorderPoint', header: 'Reorder Point', width: 14, align: 'right' },
            { key: 'description', header: 'Description', width: 30 },
            { key: 'createdAt', header: 'Created At', width: 22 }
        ]
    },
    {
        id: 'inventory-levels',
        label: 'Inventory Stock Levels',
        description: 'Current stock quantities and alert statuses.',
        sourceModule: appModules.INVENTORY_MANAGEMENT,
        filters: [
            { key: 'search', label: 'Search', type: 'text' },
            commonStatusFilter,
            {
                key: 'inventoryStatus',
                label: 'Stock Status',
                type: 'select',
                options: [
                    { value: 'SAFE', label: 'Safe' },
                    { value: 'CRITICAL', label: 'Critical' },
                    { value: 'OUT_OF_STOCK', label: 'Out of Stock' }
                ]
            }
        ],
        columns: [
            { key: 'ingredient', header: 'Ingredient', width: 24 },
            { key: 'unit', header: 'Unit', width: 12 },
            { key: 'currentQuantity', header: 'Current Qty', width: 14, align: 'right' },
            { key: 'reorderPoint', header: 'Reorder Point', width: 14, align: 'right' },
            { key: 'status', header: 'Status', width: 14 },
            { key: 'lastPhysicalCount', header: 'Last Physical Count', width: 22 }
        ]
    },
    {
        id: 'inventory-deliveries',
        label: 'Inventory Deliveries',
        description: 'Ingredient delivery batches and costs.',
        sourceModule: appModules.INVENTORY_MANAGEMENT,
        filters: [{ key: 'search', label: 'Search', type: 'text' }, commonStatusFilter, ...commonDateFilters],
        columns: [
            { key: 'ingredient', header: 'Ingredient', width: 22 },
            { key: 'batchNumber', header: 'Batch No.', width: 16 },
            { key: 'quantityReceived', header: 'Qty Received', width: 14, align: 'right' },
            { key: 'unitCost', header: 'Unit Cost', width: 12, align: 'right' },
            { key: 'totalCost', header: 'Total Cost', width: 12, align: 'right' },
            { key: 'supplier', header: 'Supplier', width: 20 },
            { key: 'receivedAt', header: 'Received At', width: 22 }
        ]
    },
    {
        id: 'inventory-adjustments',
        label: 'Inventory Adjustments',
        description: 'Stock adjustments, waste, and spoilage logs.',
        sourceModule: appModules.INVENTORY_MANAGEMENT,
        filters: [{ key: 'search', label: 'Search', type: 'text' }, commonStatusFilter, ...commonDateFilters],
        columns: [
            { key: 'ingredient', header: 'Ingredient', width: 22 },
            { key: 'type', header: 'Type', width: 14 },
            { key: 'quantity', header: 'Quantity', width: 12, align: 'right' },
            { key: 'reason', header: 'Reason', width: 28 },
            { key: 'createdAt', header: 'Logged At', width: 22 }
        ]
    },
    {
        id: 'customers',
        label: 'Customers',
        description: 'Registered customer accounts.',
        sourceModule: appModules.CUSTOMERS_MANAGEMENT,
        filters: [{ key: 'search', label: 'Search', type: 'text' }, commonStatusFilter, ...commonDateFilters],
        columns: [
            { key: 'fullName', header: 'Full Name', width: 24 },
            { key: 'email', header: 'Email', width: 26 },
            { key: 'username', header: 'Username', width: 18 },
            { key: 'phoneNumber', header: 'Phone', width: 16 },
            { key: 'createdAt', header: 'Registered At', width: 22 }
        ]
    },
    {
        id: 'suppliers',
        label: 'Suppliers',
        description: 'Supplier directory and contact information.',
        sourceModule: appModules.SUPPLIERS_MANAGEMENT,
        filters: [{ key: 'search', label: 'Search', type: 'text' }, commonStatusFilter, ...commonDateFilters],
        columns: [
            { key: 'name', header: 'Supplier Name', width: 24 },
            { key: 'contactPerson', header: 'Contact Person', width: 20 },
            { key: 'contactNumber', header: 'Contact Number', width: 18 },
            { key: 'address', header: 'Address', width: 30 },
            { key: 'createdAt', header: 'Created At', width: 22 }
        ]
    },
    {
        id: 'activity-logs',
        label: 'Activity Logs',
        description: 'System activity and audit trail.',
        sourceModule: appModules.ACTIVITY_LOGS,
        filters: [{ key: 'search', label: 'Search', type: 'text' }, ...commonDateFilters],
        columns: [
            { key: 'title', header: 'Activity', width: 24 },
            { key: 'details', header: 'Details', width: 36 },
            { key: 'actor', header: 'Performed By', width: 22 },
            { key: 'createdAt', header: 'Date & Time', width: 22 }
        ]
    },
    {
        id: 'orders',
        label: 'Orders',
        description: 'Sales orders with totals and status.',
        sourceModule: appModules.ORDERS_MANAGEMENT,
        filters: [
            { key: 'search', label: 'Search', type: 'text' },
            commonStatusFilter,
            {
                key: 'orderStatus',
                label: 'Order Status',
                type: 'select',
                options: [
                    { value: 'PENDING', label: 'Pending' },
                    { value: 'PREPARING', label: 'Preparing' },
                    { value: 'READY', label: 'Ready' },
                    { value: 'COMPLETED', label: 'Completed' },
                    { value: 'CANCELLED', label: 'Cancelled' }
                ]
            },
            {
                key: 'orderType',
                label: 'Order Type',
                type: 'select',
                options: [
                    { value: 'DINE_IN', label: 'Dine In' },
                    { value: 'TAKE_OUT', label: 'Take Out' },
                    { value: 'DELIVERY', label: 'Delivery' }
                ]
            },
            ...commonDateFilters
        ],
        columns: [
            { key: 'queueNumber', header: 'Queue #', width: 12 },
            { key: 'customerName', header: 'Customer', width: 22 },
            { key: 'orderType', header: 'Type', width: 12 },
            { key: 'status', header: 'Status', width: 12 },
            { key: 'subtotal', header: 'Subtotal', width: 12, align: 'right' },
            { key: 'discountAmount', header: 'Discount', width: 12, align: 'right' },
            { key: 'netTotal', header: 'Net Total', width: 12, align: 'right' },
            { key: 'createdAt', header: 'Order Date', width: 22 }
        ]
    }
];

export const REPORT_MAX_EXPORT_ROWS = 5000;
export const REPORT_BRAND_NAME = 'Basta Kape';
