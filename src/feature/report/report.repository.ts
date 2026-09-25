import { prisma } from '@/lib/prisma';
import { BaseRepository } from '@/repository/base.repository';
import { Prisma } from '@prisma/client';
import { format } from 'date-fns';
import type { TReportFilters, TReportModule, TReportRow } from './report.types';
import { getOrderReference } from '../order/order.utils';

type TReportQueryResult = {
    rows: TReportRow[];
    total: number;
};

const formatDateTime = (value: Date | string | null | undefined): string => {
    if (!value) return '';
    return format(new Date(value), 'MMM dd, yyyy, hh:mm a');
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
            case 'financials':
                return this.fetchFinancialsSummary(filters, pagination);
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
                orderBy: { name: 'asc' },
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
        const where: Prisma.IngredientBatchWhereInput = {};

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
            prisma.ingredientBatch.findMany({
                where,
                skip,
                take,
                orderBy: { receivedAt: 'desc' },
                include: {
                    ingredient: true,
                    supplier: true
                }
            }),
            prisma.ingredientBatch.count({ where })
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
                orderBy: [{ user: { lastName: 'asc' } }, { user: { firstName: 'asc' } }],
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
            const refMatch = filters.search.match(/^(\d{6}|\d{8})-(\d+)$/);
            if (refMatch) {
                const datePart = refMatch[1];
                const queuePart = refMatch[2];

                const yearStr = datePart.length === 6 ? datePart.slice(0, 2) : datePart.slice(0, 4);
                const monthStr = datePart.length === 6 ? datePart.slice(2, 4) : datePart.slice(4, 6);
                const dayStr = datePart.length === 6 ? datePart.slice(4, 6) : datePart.slice(6, 8);

                const yearNum = parseInt(datePart.length === 6 ? '20' + yearStr : yearStr, 10);
                const monthNum = parseInt(monthStr, 10) - 1;
                const dayNum = parseInt(dayStr, 10);

                const startOfDay = new Date(yearNum, monthNum, dayNum, 0, 0, 0, 0);
                const endOfDay = new Date(yearNum, monthNum, dayNum, 23, 59, 59, 999);

                where.createdAt = {
                    gte: startOfDay,
                    lte: endOfDay
                };
                where.queueNumber = `#${queuePart.padStart(3, '0')}`;
            } else {
                const searchLower = filters.search.toLowerCase();
                where.OR = [
                    { id: { startsWith: searchLower } },
                    { queueNumber: { contains: filters.search } },
                    { customerName: { contains: filters.search } },
                    { buzzerId: { contains: filters.search } }
                ];
            }
        }

        if (filters.dateFrom || filters.dateTo) {
            if (!where.createdAt) {
                where.createdAt = {};
                if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
                if (filters.dateTo) {
                    const end = new Date(filters.dateTo);
                    end.setHours(23, 59, 59, 999);
                    where.createdAt.lte = end;
                }
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
                referenceNumber: getOrderReference(order.createdAt, order.queueNumber),
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
        const isTransactionView = filters.groupBy === 'transaction';

        // @deprecated Previously, only COMPLETED orders were included in sales summary:
        // const where: Prisma.OrderWhereInput = {
        //     status: 'COMPLETED',
        //     paymentStatus: 'PAID'
        // };
        //
        // Active: List all orders with confirmed payment (paymentStatus: 'PAID'),
        // even if order status is not completed yet, excluding CANCELLED orders.
        const where: Prisma.OrderWhereInput = {
            paymentStatus: 'PAID',
            status: { not: 'CANCELLED' }
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

        if (isTransactionView) {
            if (filters.search) {
                where.OR = [{ queueNumber: { contains: filters.search } }, { customerName: { contains: filters.search } }];
            }

            const { skip, take } = this.resolvePagination(pagination);

            const [records, total] = await Promise.all([
                prisma.order.findMany({
                    where,
                    skip,
                    take,
                    orderBy: { createdAt: 'desc' },
                    select: {
                        createdAt: true,
                        queueNumber: true,
                        customerName: true,
                        orderType: true,
                        orderSource: true,
                        subtotal: true,
                        discountAmount: true,
                        netTotal: true,
                        paymentStatus: true,
                        payments: {
                            select: {
                                paymentMethod: true
                            }
                        }
                    }
                }),
                prisma.order.count({ where })
            ]);

            return {
                total,
                rows: records.map((order) => {
                    const methods = Array.from(new Set(order.payments.map((p) => p.paymentMethod))).join(', ');
                    return {
                        dateTime: formatDateTime(order.createdAt),
                        referenceNumber: getOrderReference(order.createdAt, order.queueNumber),
                        customerName: order.customerName || 'Walk-in Customer',
                        orderType: order.orderType.replace('_', ' '),
                        orderSource: order.orderSource,
                        paymentMethod: methods || 'N/A',
                        paymentStatus: order.paymentStatus,
                        subtotal: formatCurrency(order.subtotal),
                        discountAmount: formatCurrency(order.discountAmount),
                        netTotal: formatCurrency(order.netTotal)
                    };
                })
            };
        }

        // Fetch all matching completed & paid orders for daily aggregation
        const orders = await prisma.order.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            select: {
                createdAt: true,
                queueNumber: true,
                subtotal: true,
                discountAmount: true,
                netTotal: true,
                payments: {
                    select: {
                        paymentMethod: true,
                        amount: true
                    }
                }
            }
        });

        // Group by YYYY-MM-DD in Asia/Manila local time
        const dailyGroups: Record<
            string,
            {
                date: string;
                orderReferences: string[];
                orderCount: number;
                grossSales: number;
                discountAmount: number;
                netSales: number;
                cashSales: number;
                gcashSales: number;
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
            const ref = getOrderReference(order.createdAt, order.queueNumber);

            if (!dailyGroups[dateStr]) {
                dailyGroups[dateStr] = {
                    date: dateStr,
                    orderReferences: [],
                    orderCount: 0,
                    grossSales: 0,
                    discountAmount: 0,
                    netSales: 0,
                    cashSales: 0,
                    gcashSales: 0
                };
            }

            const group = dailyGroups[dateStr];
            group.orderReferences.push(ref);
            group.orderCount += 1;
            group.grossSales += order.subtotal;
            group.discountAmount += order.discountAmount;
            group.netSales += order.netTotal;

            for (const payment of order.payments) {
                if (payment.paymentMethod === 'CASH') {
                    group.cashSales += payment.amount;
                } else if (payment.paymentMethod === 'GCASH') {
                    group.gcashSales += payment.amount;
                }
            }
        }

        let rows = Object.values(dailyGroups);

        // Filter by search string (match against date format or order reference)
        if (filters.search) {
            const searchLower = filters.search.toLowerCase();
            rows = rows.filter((row) => row.date.includes(searchLower) || row.orderReferences.some((r) => r.toLowerCase().includes(searchLower)));
        }

        // Sort by date descending
        rows.sort((a, b) => b.date.localeCompare(a.date));

        const total = rows.length;

        // Pagination
        const { skip, take } = this.resolvePagination(pagination);
        const paginatedRows = rows.slice(skip, skip + take);

        const formattedRows = paginatedRows.map((row) => ({
            date: row.date,
            orderReferences: row.orderReferences.join(', ') || 'None',
            orderCount: row.orderCount,
            grossSales: formatCurrency(row.grossSales),
            discountAmount: formatCurrency(row.discountAmount),
            netSales: formatCurrency(row.netSales),
            cashSales: formatCurrency(row.cashSales),
            gcashSales: formatCurrency(row.gcashSales)
        }));

        return {
            total,
            rows: formattedRows
        };
    }

    private async fetchFinancialsSummary(filters: TReportFilters, pagination?: { page: number; limit: number }): Promise<TReportQueryResult> {
        // @deprecated Previously, only COMPLETED orders were included in financials revenue:
        // const orderWhere: Prisma.OrderWhereInput = {
        //     status: 'COMPLETED',
        //     paymentStatus: 'PAID'
        // };
        //
        // Active: Include all orders with confirmed payment (paymentStatus: 'PAID'),
        // even if order status is not completed yet, excluding CANCELLED orders.
        const orderWhere: Prisma.OrderWhereInput = {
            paymentStatus: 'PAID',
            status: { not: 'CANCELLED' }
        };
        const batchWhere: Prisma.IngredientBatchWhereInput = {
            deletedAt: null
        };
        const rawWasteWhere: Prisma.StockTransactionWhereInput = {
            quantityChange: { lt: 0 },
            type: { in: ['WASTE', 'SPOILED', 'EXPIRED', 'THEFT', 'PROMOTIONAL_USE'] }
        };
        const prepWasteWhere: Prisma.PreparedItemTransactionWhereInput = {
            quantityChange: { lt: 0 },
            type: { in: ['EXPIRED', 'SPOILED', 'WASTE', 'SAMPLING', 'DISPOSED'] }
        };

        if (filters.status === 'active') {
            orderWhere.deletedAt = null;
        } else if (filters.status === 'archive') {
            orderWhere.deletedAt = { not: null };
        }

        if (filters.dateFrom || filters.dateTo) {
            const dateFilter: Prisma.DateTimeFilter = {};
            if (filters.dateFrom) dateFilter.gte = new Date(filters.dateFrom);
            if (filters.dateTo) {
                const end = new Date(filters.dateTo);
                end.setHours(23, 59, 59, 999);
                dateFilter.lte = end;
            }
            orderWhere.createdAt = dateFilter;
            batchWhere.receivedAt = dateFilter;
            rawWasteWhere.createdAt = dateFilter;
            prepWasteWhere.createdAt = dateFilter;
        }

        const [orders, batches, rawWastes, prepWastes] = await Promise.all([
            prisma.order.findMany({
                where: orderWhere,
                orderBy: { createdAt: 'desc' },
                select: {
                    createdAt: true,
                    subtotal: true,
                    discountAmount: true,
                    netTotal: true
                }
            }),
            prisma.ingredientBatch.findMany({
                where: batchWhere,
                select: {
                    receivedAt: true,
                    totalCost: true,
                    quantityReceived: true,
                    unitCost: true
                }
            }),
            prisma.stockTransaction.findMany({
                where: rawWasteWhere,
                select: {
                    createdAt: true,
                    quantityChange: true,
                    batch: { select: { unitCost: true } }
                }
            }),
            prisma.preparedItemTransaction.findMany({
                where: prepWasteWhere,
                select: {
                    createdAt: true,
                    quantityChange: true,
                    batch: { select: { productVariant: { select: { price: true } } } }
                }
            })
        ]);

        const localDateFormatter = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Manila',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });

        const dailyFinancials: Record<
            string,
            {
                date: string;
                orderCount: number;
                grossSales: number;
                discountAmount: number;
                netSales: number;
                expenses: number;
                losses: number;
            }
        > = {};

        const getOrCreateDaily = (dateStr: string) => {
            if (!dailyFinancials[dateStr]) {
                dailyFinancials[dateStr] = {
                    date: dateStr,
                    orderCount: 0,
                    grossSales: 0,
                    discountAmount: 0,
                    netSales: 0,
                    expenses: 0,
                    losses: 0
                };
            }
            return dailyFinancials[dateStr];
        };

        for (const order of orders) {
            const dateStr = localDateFormatter.format(order.createdAt);
            const d = getOrCreateDaily(dateStr);
            d.orderCount += 1;
            d.grossSales += order.subtotal;
            d.discountAmount += order.discountAmount;
            d.netSales += order.netTotal;
        }

        for (const batch of batches) {
            const dateStr = localDateFormatter.format(batch.receivedAt);
            const d = getOrCreateDaily(dateStr);
            const cost = batch.totalCost || batch.quantityReceived * batch.unitCost || 0;
            d.expenses += cost;
        }

        for (const rw of rawWastes) {
            const dateStr = localDateFormatter.format(rw.createdAt);
            const d = getOrCreateDaily(dateStr);
            const qty = Math.abs(rw.quantityChange);
            const unitCost = rw.batch?.unitCost ?? 0;
            d.losses += qty * unitCost;
        }

        for (const pw of prepWastes) {
            const dateStr = localDateFormatter.format(pw.createdAt);
            const d = getOrCreateDaily(dateStr);
            const qty = Math.abs(pw.quantityChange);
            const price = pw.batch?.productVariant?.price ?? 0;
            d.losses += qty * price;
        }

        let rows = Object.values(dailyFinancials);

        if (filters.search) {
            const searchLower = filters.search.toLowerCase();
            rows = rows.filter((r) => r.date.includes(searchLower));
        }

        rows.sort((a, b) => b.date.localeCompare(a.date));
        const total = rows.length;

        const { skip, take } = this.resolvePagination(pagination);
        const paginatedRows = rows.slice(skip, skip + take);

        const formattedRows = paginatedRows.map((r) => {
            const grossProfit = r.netSales - r.expenses;
            const netProfit = grossProfit - r.losses;
            const margin = r.netSales > 0 ? (netProfit / r.netSales) * 100 : 0;

            return {
                date: r.date,
                orderCount: r.orderCount,
                grossSales: formatCurrency(r.grossSales),
                discountAmount: formatCurrency(r.discountAmount),
                netSales: formatCurrency(r.netSales),
                expenses: formatCurrency(r.expenses),
                losses: formatCurrency(r.losses),
                grossProfit: formatCurrency(grossProfit),
                netProfit: formatCurrency(netProfit),
                profitMargin: `${margin.toFixed(2)}%`
            };
        });

        return {
            total,
            rows: formattedRows
        };
    }
}
