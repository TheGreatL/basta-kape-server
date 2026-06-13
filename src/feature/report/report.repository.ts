import { prisma } from '@/lib/prisma';
import { BaseRepository } from '@/repository/base.repository';
import { Prisma } from '@prisma/client';
import type { TReportFilters, TReportModule, TReportRow } from './report.types';

type TReportQueryResult = {
    rows: TReportRow[];
    total: number;
};

const formatDateTime = (value: Date | string | null | undefined): string => {
    if (!value) return '';
    return new Date(value).toLocaleString('en-PH', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
};

const formatCurrency = (value: number | null | undefined): string => {
    if (value === null || value === undefined) return '';
    return `PHP ${value.toFixed(2)}`;
};

export class ReportRepository extends BaseRepository {
    async fetchReportData(module: TReportModule, filters: TReportFilters, pagination?: { page: number; limit: number }): Promise<TReportQueryResult> {
        switch (module) {
            case 'products':
                return this.fetchProducts(filters, pagination);
            case 'inventory-ingredients':
                return this.fetchInventoryIngredients(filters, pagination);
            case 'inventory-levels':
                return this.fetchInventoryLevels(filters, pagination);
            case 'inventory-deliveries':
                return this.fetchInventoryDeliveries(filters, pagination);
            case 'inventory-adjustments':
                return this.fetchInventoryAdjustments(filters, pagination);
            case 'customers':
                return this.fetchCustomers(filters, pagination);
            case 'suppliers':
                return this.fetchSuppliers(filters, pagination);
            case 'activity-logs':
                return this.fetchActivityLogs(filters, pagination);
            case 'orders':
                return this.fetchOrders(filters, pagination);
            case 'sales':
                return this.fetchSalesSummary(filters, pagination);
            default:
                return { rows: [], total: 0 };
        }
    }

    private resolvePagination(pagination?: { page: number; limit: number }) {
        if (!pagination) {
            return { skip: 0, take: Number.MAX_SAFE_INTEGER, page: 1 };
        }
        const { skip, take, page } = this.normalizePagination(pagination);
        return { skip, take, page };
    }

    private async fetchProducts(filters: TReportFilters, pagination?: { page: number; limit: number }): Promise<TReportQueryResult> {
        const { skip, take } = this.resolvePagination(pagination);
        const where: Prisma.ProductWhereInput = {};

        if (filters.status === 'active') where.deletedAt = null;
        else if (filters.status === 'archive') where.deletedAt = { not: null };

        if (filters.productCategoryId) where.productCategoryId = filters.productCategoryId;
        if (filters.productTypeId) where.productTypeId = filters.productTypeId;

        if (filters.search) {
            where.OR = [{ name: { contains: filters.search } }, { description: { contains: filters.search } }];
        }

        if (filters.dateFrom || filters.dateTo) {
            where.createdAt = {};
            if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
            if (filters.dateTo) {
                const end = new Date(filters.dateTo);
                end.setHours(23, 59, 59, 999);
                where.createdAt.lte = end;
            }
        }

        const [records, total] = await Promise.all([
            prisma.product.findMany({
                where,
                skip,
                take,
                orderBy: { createdAt: 'desc' },
                include: {
                    category: { select: { name: true } },
                    type: { select: { name: true } },
                    _count: { select: { variants: { where: { deletedAt: null } } } }
                }
            }),
            prisma.product.count({ where })
        ]);

        return {
            total,
            rows: records.map((product) => ({
                name: product.name,
                category: product.category?.name ?? '',
                type: product.type?.name ?? '',
                variantCount: product._count.variants,
                description: product.description ?? '',
                createdAt: formatDateTime(product.createdAt)
            }))
        };
    }

    private async fetchInventoryIngredients(filters: TReportFilters, pagination?: { page: number; limit: number }): Promise<TReportQueryResult> {
        const { skip, take } = this.resolvePagination(pagination);
        const where: Prisma.IngredientWhereInput = {};

        if (filters.status === 'active') where.deletedAt = null;
        else if (filters.status === 'archive') where.deletedAt = { not: null };

        if (filters.search) {
            where.OR = [{ name: { contains: filters.search } }, { description: { contains: filters.search } }];
        }

        if (filters.dateFrom || filters.dateTo) {
            where.createdAt = {};
            if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
            if (filters.dateTo) {
                const end = new Date(filters.dateTo);
                end.setHours(23, 59, 59, 999);
                where.createdAt.lte = end;
            }
        }

        const [records, total] = await Promise.all([
            prisma.ingredient.findMany({
                where,
                skip,
                take,
                orderBy: { name: 'asc' },
                include: { defaultUnit: true }
            }),
            prisma.ingredient.count({ where })
        ]);

        return {
            total,
            rows: records.map((ingredient) => ({
                name: ingredient.name,
                unit: ingredient.defaultUnit?.abbreviation || ingredient.defaultUnit?.name || '',
                reorderPoint: ingredient.reorderPoint,
                description: ingredient.description ?? '',
                createdAt: formatDateTime(ingredient.createdAt)
            }))
        };
    }

    private async fetchInventoryLevels(filters: TReportFilters, pagination?: { page: number; limit: number }): Promise<TReportQueryResult> {
        const { skip, take } = this.resolvePagination(pagination);
        const where: Prisma.IngredientInventoryWhereInput = {};

        if (filters.status === 'active') where.deletedAt = null;
        else if (filters.status === 'archive') where.deletedAt = { not: null };

        if (filters.inventoryStatus) where.status = filters.inventoryStatus;

        if (filters.search) {
            where.ingredient = { name: { contains: filters.search } };
        }

        const [records, total] = await Promise.all([
            prisma.ingredientInventory.findMany({
                where,
                skip,
                take,
                orderBy: { currentQuantity: 'asc' },
                include: {
                    ingredient: { include: { defaultUnit: true } }
                }
            }),
            prisma.ingredientInventory.count({ where })
        ]);

        return {
            total,
            rows: records.map((level) => ({
                ingredient: level.ingredient.name,
                unit: level.ingredient.defaultUnit?.abbreviation || level.ingredient.defaultUnit?.name || '',
                currentQuantity: level.currentQuantity,
                reorderPoint: level.ingredient.reorderPoint,
                status: level.status,
                lastPhysicalCount: formatDateTime(level.lastPhysicalCount)
            }))
        };
    }

    private async fetchInventoryDeliveries(filters: TReportFilters, pagination?: { page: number; limit: number }): Promise<TReportQueryResult> {
        const { skip, take } = this.resolvePagination(pagination);
        const where: Prisma.IngredientDeliveryWhereInput = {};

        if (filters.status === 'active') where.deletedAt = null;
        else if (filters.status === 'archive') where.deletedAt = { not: null };

        if (filters.search) {
            where.OR = [{ batchNumber: { contains: filters.search } }, { ingredient: { name: { contains: filters.search } } }];
        }

        if (filters.dateFrom || filters.dateTo) {
            where.receivedAt = {};
            if (filters.dateFrom) where.receivedAt.gte = new Date(filters.dateFrom);
            if (filters.dateTo) {
                const end = new Date(filters.dateTo);
                end.setHours(23, 59, 59, 999);
                where.receivedAt.lte = end;
            }
        }

        const [records, total] = await Promise.all([
            prisma.ingredientDelivery.findMany({
                where,
                skip,
                take,
                orderBy: { receivedAt: 'desc' },
                include: {
                    ingredient: true,
                    supplier: true
                }
            }),
            prisma.ingredientDelivery.count({ where })
        ]);

        return {
            total,
            rows: records.map((delivery) => ({
                ingredient: delivery.ingredient.name,
                batchNumber: delivery.batchNumber ?? '',
                quantityReceived: delivery.quantityReceived,
                unitCost: formatCurrency(delivery.unitCost),
                totalCost: formatCurrency(delivery.totalCost),
                supplier: delivery.supplier?.name ?? '',
                receivedAt: formatDateTime(delivery.receivedAt)
            }))
        };
    }

    private async fetchInventoryAdjustments(filters: TReportFilters, pagination?: { page: number; limit: number }): Promise<TReportQueryResult> {
        const { skip, take } = this.resolvePagination(pagination);
        const where: Prisma.InventoryAdjustmentWhereInput = {};

        if (filters.status === 'active') where.deletedAt = null;
        else if (filters.status === 'archive') where.deletedAt = { not: null };

        if (filters.search) {
            where.OR = [{ reason: { contains: filters.search } }, { ingredient: { name: { contains: filters.search } } }];
        }

        if (filters.dateFrom || filters.dateTo) {
            where.createdAt = {};
            if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
            if (filters.dateTo) {
                const end = new Date(filters.dateTo);
                end.setHours(23, 59, 59, 999);
                where.createdAt.lte = end;
            }
        }

        const [records, total] = await Promise.all([
            prisma.inventoryAdjustment.findMany({
                where,
                skip,
                take,
                orderBy: { createdAt: 'desc' },
                include: { ingredient: true }
            }),
            prisma.inventoryAdjustment.count({ where })
        ]);

        return {
            total,
            rows: records.map((adjustment) => ({
                ingredient: adjustment.ingredient.name,
                type: adjustment.type,
                quantity: adjustment.quantity,
                reason: adjustment.reason ?? '',
                createdAt: formatDateTime(adjustment.createdAt)
            }))
        };
    }

    private async fetchCustomers(filters: TReportFilters, pagination?: { page: number; limit: number }): Promise<TReportQueryResult> {
        const { skip, take } = this.resolvePagination(pagination);
        const where: Prisma.CustomerWhereInput = {};

        if (filters.status === 'active') where.deletedAt = null;
        else if (filters.status === 'archive') where.deletedAt = { not: null };

        if (filters.search) {
            const searchLower = filters.search.toLowerCase();
            where.user = {
                OR: [
                    { email: { contains: searchLower } },
                    { username: { contains: searchLower } },
                    { firstName: { contains: searchLower } },
                    { lastName: { contains: searchLower } },
                    { phoneNumber: { contains: searchLower } }
                ]
            };
        }

        if (filters.dateFrom || filters.dateTo) {
            where.createdAt = {};
            if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
            if (filters.dateTo) {
                const end = new Date(filters.dateTo);
                end.setHours(23, 59, 59, 999);
                where.createdAt.lte = end;
            }
        }

        const [records, total] = await Promise.all([
            prisma.customer.findMany({
                where,
                skip,
                take,
                orderBy: { createdAt: 'desc' },
                include: { user: true }
            }),
            prisma.customer.count({ where })
        ]);

        return {
            total,
            rows: records.map((customer) => ({
                fullName: [customer.user.firstName, customer.user.middleName, customer.user.lastName].filter(Boolean).join(' '),
                email: customer.user.email,
                username: customer.user.username,
                phoneNumber: customer.user.phoneNumber ?? '',
                createdAt: formatDateTime(customer.createdAt)
            }))
        };
    }

    private async fetchSuppliers(filters: TReportFilters, pagination?: { page: number; limit: number }): Promise<TReportQueryResult> {
        const { skip, take } = this.resolvePagination(pagination);
        const where: Prisma.SupplierWhereInput = {};

        if (filters.status === 'active') where.deletedAt = null;
        else if (filters.status === 'archive') where.deletedAt = { not: null };

        if (filters.search) {
            where.OR = [
                { name: { contains: filters.search } },
                { contactPerson: { contains: filters.search } },
                { contactNumber: { contains: filters.search } },
                { address: { contains: filters.search } }
            ];
        }

        if (filters.dateFrom || filters.dateTo) {
            where.createdAt = {};
            if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
            if (filters.dateTo) {
                const end = new Date(filters.dateTo);
                end.setHours(23, 59, 59, 999);
                where.createdAt.lte = end;
            }
        }

        const [records, total] = await Promise.all([
            prisma.supplier.findMany({
                where,
                skip,
                take,
                orderBy: { name: 'asc' }
            }),
            prisma.supplier.count({ where })
        ]);

        return {
            total,
            rows: records.map((supplier) => ({
                name: supplier.name,
                contactPerson: supplier.contactPerson ?? '',
                contactNumber: supplier.contactNumber ?? '',
                address: supplier.address ?? '',
                createdAt: formatDateTime(supplier.createdAt)
            }))
        };
    }

    private async fetchActivityLogs(filters: TReportFilters, pagination?: { page: number; limit: number }): Promise<TReportQueryResult> {
        const { skip, take } = this.resolvePagination(pagination);
        const where: Prisma.ActivityLogWhereInput = {};

        if (filters.search) {
            where.OR = [
                { title: { contains: filters.search } },
                { details: { contains: filters.search } },
                { actor: { firstName: { contains: filters.search } } },
                { actor: { lastName: { contains: filters.search } } }
            ];
        }

        if (filters.dateFrom || filters.dateTo) {
            where.createdAt = {};
            if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
            if (filters.dateTo) {
                const end = new Date(filters.dateTo);
                end.setHours(23, 59, 59, 999);
                where.createdAt.lte = end;
            }
        }

        const [records, total] = await Promise.all([
            prisma.activityLog.findMany({
                where,
                skip,
                take,
                orderBy: { createdAt: 'desc' },
                include: {
                    actor: {
                        select: { firstName: true, lastName: true, email: true }
                    }
                }
            }),
            prisma.activityLog.count({ where })
        ]);

        return {
            total,
            rows: records.map((log) => ({
                title: log.title,
                details: log.details ?? '',
                actor: log.actor ? `${log.actor.firstName} ${log.actor.lastName}`.trim() : 'System',
                createdAt: formatDateTime(log.createdAt)
            }))
        };
    }

    private async fetchOrders(filters: TReportFilters, pagination?: { page: number; limit: number }): Promise<TReportQueryResult> {
        const { skip, take } = this.resolvePagination(pagination);
        const where: Prisma.OrderWhereInput = {};

        if (filters.status === 'active') where.deletedAt = null;
        else if (filters.status === 'archive') where.deletedAt = { not: null };

        if (filters.orderStatus) where.status = filters.orderStatus;
        if (filters.orderType) where.orderType = filters.orderType;

        if (filters.search) {
            where.OR = [
                { queueNumber: { contains: filters.search } },
                { customerName: { contains: filters.search } },
                { buzzerId: { contains: filters.search } }
            ];
        }

        if (filters.dateFrom || filters.dateTo) {
            where.createdAt = {};
            if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
            if (filters.dateTo) {
                const end = new Date(filters.dateTo);
                end.setHours(23, 59, 59, 999);
                where.createdAt.lte = end;
            }
        }

        const [records, total] = await Promise.all([
            prisma.order.findMany({
                where,
                skip,
                take,
                orderBy: { createdAt: 'desc' },
                include: {
                    customer: {
                        include: { user: { select: { firstName: true, lastName: true } } }
                    }
                }
            }),
            prisma.order.count({ where })
        ]);

        return {
            total,
            rows: records.map((order) => ({
                queueNumber: order.queueNumber ?? '',
                customerName:
                    order.customerName || (order.customer ? `${order.customer.user.firstName} ${order.customer.user.lastName}`.trim() : 'Walk-in'),
                orderType: order.orderType,
                status: order.status,
                subtotal: formatCurrency(order.subtotal),
                discountAmount: formatCurrency(order.discountAmount),
                netTotal: formatCurrency(order.netTotal),
                createdAt: formatDateTime(order.createdAt)
            }))
        };
    }

    private async fetchSalesSummary(filters: TReportFilters, pagination?: { page: number; limit: number }): Promise<TReportQueryResult> {
        const where: Prisma.OrderWhereInput = {
            status: 'COMPLETED'
        };

        if (filters.status === 'active') where.deletedAt = null;
        else if (filters.status === 'archive') where.deletedAt = { not: null };

        if (filters.dateFrom || filters.dateTo) {
            where.createdAt = {};
            if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
            if (filters.dateTo) {
                const end = new Date(filters.dateTo);
                end.setHours(23, 59, 59, 999);
                where.createdAt.lte = end;
            }
        }

        // Fetch all matching completed orders
        const orders = await prisma.order.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: {
                payments: true
            }
        });

        // Group by YYYY-MM-DD in Asia/Manila local time
        const dailyGroups: Record<
            string,
            {
                date: string;
                orderCount: number;
                grossSales: number;
                discountAmount: number;
                netSales: number;
                cashSales: number;
                gcashSales: number;
                paymayaSales: number;
                cardSales: number;
            }
        > = {};

        const localDateFormatter = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Manila',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });

        for (const order of orders) {
            const dateStr = localDateFormatter.format(order.createdAt);

            if (!dailyGroups[dateStr]) {
                dailyGroups[dateStr] = {
                    date: dateStr,
                    orderCount: 0,
                    grossSales: 0,
                    discountAmount: 0,
                    netSales: 0,
                    cashSales: 0,
                    gcashSales: 0,
                    paymayaSales: 0,
                    cardSales: 0
                };
            }

            const group = dailyGroups[dateStr];
            group.orderCount += 1;
            group.grossSales += order.subtotal;
            group.discountAmount += order.discountAmount;
            group.netSales += order.netTotal;

            for (const payment of order.payments) {
                if (payment.paymentStatus === 'PAID') {
                    if (payment.paymentMethod === 'CASH') {
                        group.cashSales += payment.amount;
                    } else if (payment.paymentMethod === 'GCASH') {
                        group.gcashSales += payment.amount;
                    } else if (payment.paymentMethod === 'PAYMAYA') {
                        group.paymayaSales += payment.amount;
                    } else if (payment.paymentMethod === 'CREDIT_CARD') {
                        group.cardSales += payment.amount;
                    }
                }
            }
        }

        let rows = Object.values(dailyGroups);

        // Filter by search string (match against date format)
        if (filters.search) {
            const searchLower = filters.search.toLowerCase();
            rows = rows.filter((row) => row.date.includes(searchLower));
        }

        // Sort by date descending
        rows.sort((a, b) => b.date.localeCompare(a.date));

        const total = rows.length;

        // Pagination
        const { skip, take } = this.resolvePagination(pagination);
        const paginatedRows = rows.slice(skip, skip + take);

        const formattedRows = paginatedRows.map((row) => ({
            date: row.date,
            orderCount: row.orderCount,
            grossSales: formatCurrency(row.grossSales),
            discountAmount: formatCurrency(row.discountAmount),
            netSales: formatCurrency(row.netSales),
            cashSales: formatCurrency(row.cashSales),
            gcashSales: formatCurrency(row.gcashSales),
            paymayaSales: formatCurrency(row.paymayaSales),
            cardSales: formatCurrency(row.cardSales)
        }));

        return {
            total,
            rows: formattedRows
        };
    }
}
