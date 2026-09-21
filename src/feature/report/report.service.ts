import { ActivityLogService } from '@/feature/activity-log/activity-log.service';
import { BadRequestException, NotFoundException } from '@/exceptions';
import { prisma } from '@/lib/prisma';
import { OrderStatus, OrderType, PaymentMethod, PaymentStatus, PreparedAdjustmentType, Prisma, TransactionType } from '@prisma/client';
import { format } from 'date-fns';
import { ReportGenerator } from './report.generator';
import { ReportRepository } from './report.repository';
import {
    REPORT_BRAND_NAME,
    REPORT_MAX_EXPORT_ROWS,
    REPORT_MODULE_CATALOG,
    SALES_DAILY_COLUMNS,
    SALES_TRANSACTION_COLUMNS,
    type TExpenseBreakdown,
    type TFinancialSummary,
    type TLossBreakdown,
    type TPnLOverview,
    type TReportActor,
    type TReportDataset,
    type TReportExportRequest,
    type TReportModule,
    type TReportPreviewRequest,
    type TReportStoreInfo,
    type TStockTransactionCostSummary,
    type TTopWastedItem
} from './report.types';

const RAW_WASTE_TYPES: TransactionType[] = [
    TransactionType.WASTE,
    TransactionType.SPOILED,
    TransactionType.EXPIRED,
    TransactionType.THEFT,
    TransactionType.PROMOTIONAL_USE
];

const PREPARED_WASTE_TYPES: PreparedAdjustmentType[] = [
    PreparedAdjustmentType.EXPIRED,
    PreparedAdjustmentType.SPOILED,
    PreparedAdjustmentType.WASTE,
    PreparedAdjustmentType.SAMPLING,
    PreparedAdjustmentType.DISPOSED
];

type SalesPaymentRow = {
    paymentMethod: PaymentMethod;
    _count: { id: number };
    _sum: { amount: number | null };
};

type SalesOrderTypeRow = {
    orderType: OrderType;
    _count: { id: number };
    _sum: { netTotal: number | null };
};

type ReportServiceConstructor = {
    reportRepository?: ReportRepository;
    reportGenerator?: ReportGenerator;
    activityLogService?: ActivityLogService;
};

export class ReportService {
    private repository: ReportRepository;
    private generator: ReportGenerator;
    private activityLogService: ActivityLogService;

    constructor(deps: ReportServiceConstructor = {}) {
        this.repository = deps.reportRepository ?? new ReportRepository();
        this.generator = deps.reportGenerator ?? new ReportGenerator();
        this.activityLogService = deps.activityLogService ?? new ActivityLogService();
    }

    getModules() {
        return REPORT_MODULE_CATALOG;
    }

    getModuleDefinition(module: TReportModule) {
        return REPORT_MODULE_CATALOG.find((entry) => entry.id === module);
    }

    async previewReport(payload: TReportPreviewRequest) {
        const definition = this.getModuleDefinition(payload.module);
        if (!definition) {
            throw new BadRequestException('Invalid report module selected.');
        }

        const page = payload.page ?? 1;
        const limit = payload.limit ?? 20;
        const filters = payload.filters ?? {};

        const columns =
            payload.module === 'sales' ? (filters.groupBy === 'transaction' ? SALES_TRANSACTION_COLUMNS : SALES_DAILY_COLUMNS) : definition.columns;

        const { rows, total } = await this.repository.fetchReportData(payload.module, filters, { page, limit });
        const pageCount = Math.ceil(total / limit) || 1;

        return {
            module: payload.module,
            title: definition.label,
            columns,
            rows,
            meta: {
                total,
                page,
                limit,
                pageCount,
                hasMore: page * limit < total,
                generatedAt: new Date().toISOString(),
                filters
            }
        };
    }

    private async resolveStoreInfo(): Promise<TReportStoreInfo> {
        const storeSetting = await prisma.storeSetting.findFirst({
            select: {
                storeName: true,
                address: true
            }
        });

        return {
            storeName: storeSetting?.storeName ?? REPORT_BRAND_NAME,
            address: storeSetting?.address ?? ''
        };
    }

    private async resolveReportActor(actorId: string): Promise<TReportActor> {
        const user = await prisma.user.findFirst({
            where: { id: actorId, deletedAt: null },
            select: {
                id: true,
                email: true,
                username: true,
                firstName: true,
                middleName: true,
                lastName: true
            }
        });

        if (!user) {
            throw new NotFoundException('Report generator user not found.');
        }

        const fullName = [user.firstName, user.middleName, user.lastName].filter(Boolean).join(' ').trim();

        return {
            id: user.id,
            fullName: fullName || user.username,
            email: user.email,
            username: user.username
        };
    }

    async exportReport(payload: TReportExportRequest, actorId: string) {
        const definition = this.getModuleDefinition(payload.module);
        if (!definition) {
            throw new BadRequestException('Invalid report module selected.');
        }

        const [generatedBy, store] = await Promise.all([this.resolveReportActor(actorId), this.resolveStoreInfo()]);
        const filters = payload.filters ?? {};
        const { rows, total } = await this.repository.fetchReportData(payload.module, filters, {
            page: 1,
            limit: REPORT_MAX_EXPORT_ROWS
        });

        const columns =
            payload.module === 'sales' ? (filters.groupBy === 'transaction' ? SALES_TRANSACTION_COLUMNS : SALES_DAILY_COLUMNS) : definition.columns;

        const dataset: TReportDataset = {
            module: payload.module,
            title: payload.title ?? `${definition.label} Report`,
            columns,
            rows,
            meta: {
                total,
                generatedAt: format(new Date(), 'MMMM dd, yyyy, hh:mm a'),
                filters,
                truncated: total > REPORT_MAX_EXPORT_ROWS,
                generatedBy,
                store
            }
        };

        const file = await this.generator.generate(dataset, payload.format);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `${payload.module}-report-${timestamp}.${file.extension}`;

        await this.activityLogService.logActivity({
            actorId,
            title: 'Generate Report',
            details: `Exported ${definition.label} report as ${payload.format.toUpperCase()} (${rows.length} of ${total} records) by ${generatedBy.fullName} (${generatedBy.email}).`
        });

        return {
            filename,
            mimeType: file.mimeType,
            buffer: file.buffer
        };
    }

    async getSalesAnalytics(dateFrom?: string, dateTo?: string, type?: string) {
        const now = new Date();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(now.getDate() - 30);
        thirtyDaysAgo.setHours(0, 0, 0, 0);

        const start = dateFrom ? new Date(dateFrom) : thirtyDaysAgo;
        const end = dateTo ? new Date(dateTo) : now;
        if (dateTo) {
            end.setHours(23, 59, 59, 999);
        }

        const orderWhere: Prisma.OrderWhereInput = {
            status: OrderStatus.COMPLETED,
            paymentStatus: PaymentStatus.PAID,
            createdAt: {
                gte: start,
                lte: end
            }
        };

        const batchWhere: Prisma.IngredientBatchWhereInput = {
            deletedAt: null,
            receivedAt: {
                gte: start,
                lte: end
            }
        };

        const allStockTransactionsPromise = prisma.stockTransaction.findMany({
            where: {
                createdAt: {
                    gte: start,
                    lte: end
                }
            },
            include: {
                batch: {
                    include: {
                        ingredient: {
                            include: { defaultUnit: true }
                        }
                    }
                }
            }
        });

        const prepWasteWhere: Prisma.PreparedItemTransactionWhereInput = {
            quantityChange: { lt: 0 },
            type: { in: PREPARED_WASTE_TYPES },
            createdAt: {
                gte: start,
                lte: end
            }
        };

        // 1. Sales summary aggregation
        const salesSummaryPromise = prisma.order.aggregate({
            where: orderWhere,
            _count: { id: true },
            _sum: {
                subtotal: true,
                discountAmount: true,
                netTotal: true
            }
        });

        // 2. Expenses (Deliveries) aggregation
        const deliveryBatchesPromise = prisma.ingredientBatch.findMany({
            where: batchWhere,
            select: {
                id: true,
                totalCost: true,
                quantityReceived: true,
                unitCost: true,
                receivedAt: true,
                supplier: { select: { id: true, name: true } },
                ingredient: { select: { id: true, name: true, defaultUnit: { select: { abbreviation: true, name: true } } } }
            }
        });

        // 3. Prepared Food Waste aggregation
        const prepWastePromise = prisma.preparedItemTransaction.findMany({
            where: prepWasteWhere,
            include: {
                batch: {
                    include: {
                        product: true,
                        productVariant: true
                    }
                }
            }
        });

        // Resolve core financial data
        const [salesSummary, deliveryBatches, allStockTransactions, prepWasteRows] = await Promise.all([
            salesSummaryPromise,
            deliveryBatchesPromise,
            allStockTransactionsPromise,
            prepWastePromise
        ]);

        const grossSales = Math.round((salesSummary._sum?.subtotal ?? 0) * 100) / 100;
        const discountTotal = Math.round((salesSummary._sum?.discountAmount ?? 0) * 100) / 100;
        const netSales = Math.round((salesSummary._sum?.netTotal ?? 0) * 100) / 100;
        const orderCount = salesSummary._count?.id ?? 0;
        const averageOrderValue = orderCount > 0 ? Math.round((netSales / orderCount) * 100) / 100 : 0;

        // Process Expenses & Deliveries
        let totalExpenses = 0;
        const deliveryCount = deliveryBatches.length;
        const supplierExpenseMap: Record<string, { supplierName: string; totalCost: number; batchCount: number }> = {};
        const ingredientExpenseMap: Record<string, { ingredientName: string; totalCost: number; totalQuantity: number; unit: string }> = {};
        const dailyExpensesMap: Record<string, number> = {};

        for (const batch of deliveryBatches) {
            const cost = batch.totalCost || batch.quantityReceived * batch.unitCost || 0;
            const roundedCost = Math.round(cost * 100) / 100;
            totalExpenses += roundedCost;

            const dateStr = batch.receivedAt.toISOString().split('T')[0];
            dailyExpensesMap[dateStr] = (dailyExpensesMap[dateStr] || 0) + roundedCost;

            const suppName = batch.supplier?.name || 'Direct / Unknown Supplier';
            if (!supplierExpenseMap[suppName]) {
                supplierExpenseMap[suppName] = { supplierName: suppName, totalCost: 0, batchCount: 0 };
            }
            supplierExpenseMap[suppName].totalCost += roundedCost;
            supplierExpenseMap[suppName].batchCount += 1;

            const ingName = batch.ingredient?.name || 'Unknown Ingredient';
            const unitName = batch.ingredient?.defaultUnit?.abbreviation || batch.ingredient?.defaultUnit?.name || 'units';
            if (!ingredientExpenseMap[ingName]) {
                ingredientExpenseMap[ingName] = { ingredientName: ingName, totalCost: 0, totalQuantity: 0, unit: unitName };
            }
            ingredientExpenseMap[ingName].totalCost += roundedCost;
            ingredientExpenseMap[ingName].totalQuantity += batch.quantityReceived;
        }
        totalExpenses = Math.round(totalExpenses * 100) / 100;

        const topSuppliers = Object.values(supplierExpenseMap)
            .map((s) => ({ ...s, totalCost: Math.round(s.totalCost * 100) / 100 }))
            .sort((a, b) => b.totalCost - a.totalCost)
            .slice(0, 5);

        const topIngredients = Object.values(ingredientExpenseMap)
            .map((i) => ({ ...i, totalCost: Math.round(i.totalCost * 100) / 100 }))
            .sort((a, b) => b.totalCost - a.totalCost)
            .slice(0, 5);

        // Process Stock Transactions Costing
        let totalCogs = 0;
        let rawIngredientLoss = 0;
        let rawIngredientWastedCount = 0;
        const reasonBreakdown: Record<string, number> = {};
        const lossBreakdownByReason: Record<string, number> = {};
        const dailyLossesMap: Record<string, number> = {};
        const itemLossMap = new Map<string, TTopWastedItem>();
        const consumedIngredientsMap: Record<string, { ingredientName: string; totalQuantity: number; unit: string; totalCost: number }> = {};

        const transactionsByType: Record<string, { count: number; totalQuantity: number; totalCost: number }> = {
            DELIVERY: { count: 0, totalQuantity: 0, totalCost: 0 },
            SALE: { count: 0, totalQuantity: 0, totalCost: 0 },
            WASTE: { count: 0, totalQuantity: 0, totalCost: 0 },
            SPOILED: { count: 0, totalQuantity: 0, totalCost: 0 },
            EXPIRED: { count: 0, totalQuantity: 0, totalCost: 0 },
            THEFT: { count: 0, totalQuantity: 0, totalCost: 0 },
            PROMOTIONAL_USE: { count: 0, totalQuantity: 0, totalCost: 0 },
            PHYSICAL_COUNT_CORRECTION: { count: 0, totalQuantity: 0, totalCost: 0 }
        };

        for (const row of allStockTransactions) {
            const qty = Math.abs(row.quantityChange);
            const unitCost = row.batch?.unitCost ?? 0;
            const cost = Math.round(qty * unitCost * 100) / 100;
            const unitName = row.batch?.ingredient?.defaultUnit?.abbreviation || row.batch?.ingredient?.defaultUnit?.name || 'units';
            const itemName = row.batch?.ingredient?.name || 'Raw Ingredient';
            const dateStr = row.createdAt.toISOString().split('T')[0];

            if (transactionsByType[row.type]) {
                transactionsByType[row.type].count += 1;
                transactionsByType[row.type].totalQuantity = Math.round((transactionsByType[row.type].totalQuantity + qty) * 100) / 100;
                transactionsByType[row.type].totalCost = Math.round((transactionsByType[row.type].totalCost + cost) * 100) / 100;
            }

            if (row.type === 'SALE') {
                totalCogs += cost;
                if (!consumedIngredientsMap[itemName]) {
                    consumedIngredientsMap[itemName] = { ingredientName: itemName, totalQuantity: 0, unit: unitName, totalCost: 0 };
                }
                consumedIngredientsMap[itemName].totalQuantity = Math.round((consumedIngredientsMap[itemName].totalQuantity + qty) * 100) / 100;
                consumedIngredientsMap[itemName].totalCost = Math.round((consumedIngredientsMap[itemName].totalCost + cost) * 100) / 100;
            }

            if (RAW_WASTE_TYPES.includes(row.type) && row.quantityChange < 0) {
                rawIngredientLoss += cost;
                rawIngredientWastedCount += qty;
                reasonBreakdown[row.type] = (reasonBreakdown[row.type] || 0) + qty;
                lossBreakdownByReason[row.type] = (lossBreakdownByReason[row.type] || 0) + cost;
                dailyLossesMap[dateStr] = (dailyLossesMap[dateStr] || 0) + cost;

                const key = `RAW_${itemName}`;
                const existing = itemLossMap.get(key);
                if (existing) {
                    existing.totalQuantity += qty;
                    existing.totalCostLoss += cost;
                } else {
                    itemLossMap.set(key, {
                        itemName,
                        category: 'RAW_INGREDIENT',
                        totalQuantity: qty,
                        unit: unitName,
                        totalCostLoss: cost
                    });
                }
            }
        }

        totalCogs = Math.round(totalCogs * 100) / 100;
        const totalWastage =
            Math.round(
                (transactionsByType.WASTE.totalCost +
                    transactionsByType.SPOILED.totalCost +
                    transactionsByType.EXPIRED.totalCost +
                    transactionsByType.THEFT.totalCost +
                    transactionsByType.PROMOTIONAL_USE.totalCost) *
                    100
            ) / 100;
        const totalCorrections = transactionsByType.PHYSICAL_COUNT_CORRECTION.totalCost;

        const topConsumedIngredients = Object.values(consumedIngredientsMap)
            .sort((a, b) => b.totalCost - a.totalCost)
            .slice(0, 5);

        const stockTransactionsSummary: TStockTransactionCostSummary = {
            totalStockTransactionsCount: allStockTransactions.length,
            totalCogs,
            totalProcurement: totalExpenses,
            totalWastage,
            totalCorrections,
            transactionsByType,
            topConsumedIngredients
        };

        // Process Prepared Food Losses
        let preparedFoodLoss = 0;
        let preparedFoodWastedCount = 0;

        for (const row of prepWasteRows) {
            const qty = Math.abs(row.quantityChange);
            const price = row.batch?.productVariant?.price ?? 0;
            const costLoss = Math.round(qty * price * 100) / 100;
            const itemName = row.batch?.product?.name || 'Prepared Food';

            preparedFoodLoss += costLoss;
            preparedFoodWastedCount += qty;
            reasonBreakdown[row.type] = (reasonBreakdown[row.type] || 0) + qty;
            lossBreakdownByReason[row.type] = (lossBreakdownByReason[row.type] || 0) + costLoss;

            const dateStr = row.createdAt.toISOString().split('T')[0];
            dailyLossesMap[dateStr] = (dailyLossesMap[dateStr] || 0) + costLoss;

            const key = `PREP_${itemName}`;
            const existing = itemLossMap.get(key);
            if (existing) {
                existing.totalQuantity += qty;
                existing.totalCostLoss += costLoss;
            } else {
                itemLossMap.set(key, {
                    itemName,
                    category: 'PREPARED_FOOD',
                    totalQuantity: qty,
                    unit: 'pcs',
                    totalCostLoss: costLoss
                });
            }
        }

        rawIngredientLoss = Math.round(rawIngredientLoss * 100) / 100;
        preparedFoodLoss = Math.round(preparedFoodLoss * 100) / 100;
        const totalFinancialLoss = Math.round((rawIngredientLoss + preparedFoodLoss) * 100) / 100;
        const totalWastedItemsCount = rawIngredientWastedCount + preparedFoodWastedCount;
        for (const key of Object.keys(lossBreakdownByReason)) {
            lossBreakdownByReason[key] = Math.round(lossBreakdownByReason[key] * 100) / 100;
        }

        const topWastedItems = Array.from(itemLossMap.values())
            .map((item) => ({ ...item, totalCostLoss: Math.round(item.totalCostLoss * 100) / 100 }))
            .sort((a, b) => b.totalCostLoss - a.totalCostLoss)
            .slice(0, 5);

        // Profitability calculations
        const grossProfit = Math.round((netSales - totalExpenses) * 100) / 100;
        const netProfit = Math.round((netSales - totalExpenses - totalFinancialLoss) * 100) / 100;
        const grossProfitMargin = netSales > 0 ? Math.round((grossProfit / netSales) * 10000) / 100 : 0;
        const profitMargin = netSales > 0 ? Math.round((netProfit / netSales) * 10000) / 100 : 0;
        const lossRate = grossSales > 0 ? Math.round((totalFinancialLoss / grossSales) * 10000) / 100 : 0;

        const summaryPayload: TFinancialSummary = {
            grossSales,
            discountTotal,
            netSales,
            orderCount,
            averageOrderValue,
            totalExpenses,
            deliveryCount,
            cogs: totalCogs,
            stockTransactionsCount: allStockTransactions.length,
            totalLoss: totalFinancialLoss,
            rawIngredientLoss,
            preparedFoodLoss,
            totalWastedItemsCount,
            lossRate,
            grossProfit,
            netProfit,
            profitMargin
        };

        const pnlPayload: TPnLOverview = {
            revenue: {
                grossSales,
                discounts: discountTotal,
                netSales
            },
            expenses: {
                procurementDeliveries: totalExpenses,
                cogs: totalCogs,
                totalExpenses
            },
            losses: {
                rawIngredientWaste: rawIngredientLoss,
                preparedFoodExpirations: preparedFoodLoss,
                totalLoss: totalFinancialLoss,
                lossBreakdownByReason
            },
            profitability: {
                grossProfit,
                netProfit,
                grossProfitMargin,
                netProfitMargin: profitMargin
            }
        };

        const lossBreakdownPayload: TLossBreakdown = {
            totalFinancialLoss,
            preparedFoodLoss,
            rawIngredientLoss,
            preparedFoodWastedCount,
            rawIngredientWastedCount,
            totalWastedItemsCount,
            reasonBreakdown,
            topWastedItems
        };

        const expenseBreakdownPayload: TExpenseBreakdown = {
            totalExpenses,
            deliveryCount,
            cogs: totalCogs,
            topSuppliers,
            topIngredients,
            stockTransactionsSummary
        };

        if (type === 'summary') {
            return { summary: summaryPayload };
        }

        if (type === 'financials') {
            return { financials: pnlPayload };
        }

        if (type === 'losses') {
            return { lossBreakdown: lossBreakdownPayload };
        }

        if (type === 'expenses') {
            return { expenseBreakdown: expenseBreakdownPayload };
        }

        if (type === 'stock-transactions') {
            return { stockTransactionsSummary };
        }

        if (type === 'daily-trend') {
            const dailyRows = await prisma.order.findMany({
                where: orderWhere,
                orderBy: { createdAt: 'asc' },
                select: {
                    createdAt: true,
                    netTotal: true
                }
            });

            const dailyMap: Record<string, { date: string; sales: number; count: number; expenses: number; losses: number; netProfit: number }> = {};
            const temp = new Date(start);
            while (temp <= end) {
                const dateStr = temp.toISOString().split('T')[0];
                dailyMap[dateStr] = {
                    date: dateStr,
                    sales: 0,
                    count: 0,
                    expenses: Math.round((dailyExpensesMap[dateStr] || 0) * 100) / 100,
                    losses: Math.round((dailyLossesMap[dateStr] || 0) * 100) / 100,
                    netProfit: 0
                };
                temp.setDate(temp.getDate() + 1);
            }

            for (const order of dailyRows) {
                const dateStr = order.createdAt.toISOString().split('T')[0];
                if (dailyMap[dateStr]) {
                    dailyMap[dateStr].sales = Math.round((dailyMap[dateStr].sales + order.netTotal) * 100) / 100;
                    dailyMap[dateStr].count += 1;
                }
            }

            for (const item of Object.values(dailyMap)) {
                item.netProfit = Math.round((item.sales - item.expenses - item.losses) * 100) / 100;
            }

            const dailyTrend = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));
            return { dailyTrend };
        }

        if (type === 'top-products') {
            const itemRows = await prisma.orderItem.findMany({
                where: {
                    order: {
                        is: orderWhere
                    }
                },
                select: {
                    quantity: true,
                    totalPrice: true,
                    variant: {
                        select: {
                            product: {
                                select: {
                                    name: true
                                }
                            }
                        }
                    }
                }
            });

            const productMap: Record<string, { name: string; quantity: number; revenue: number }> = {};
            for (const item of itemRows) {
                const name = item.variant.product.name;
                if (!name) continue;

                if (!productMap[name]) {
                    productMap[name] = { name, quantity: 0, revenue: 0 };
                }

                productMap[name].quantity += item.quantity;
                productMap[name].revenue += item.totalPrice;
            }

            const topProducts = Object.values(productMap)
                .map((p) => ({ ...p, revenue: Math.round(p.revenue * 100) / 100 }))
                .sort((a, b) => b.quantity - a.quantity)
                .slice(0, 5);

            return { topProducts };
        }

        if (type === 'order-type-breakdown') {
            const orderTypeRows = (await prisma.order.groupBy({
                by: ['orderType'],
                where: orderWhere,
                _count: { id: true },
                _sum: { netTotal: true }
            })) as unknown as SalesOrderTypeRow[];

            const orderTypeBreakdown = {
                DINE_IN: { count: 0, revenue: 0 },
                TAKE_OUT: { count: 0, revenue: 0 },
                DELIVERY: { count: 0, revenue: 0 }
            };

            for (const row of orderTypeRows) {
                if (!orderTypeBreakdown[row.orderType]) continue;
                orderTypeBreakdown[row.orderType].count = row._count.id;
                orderTypeBreakdown[row.orderType].revenue = Math.round((row._sum.netTotal ?? 0) * 100) / 100;
            }

            return { orderTypeBreakdown };
        }

        if (type === 'payment-breakdown') {
            const paymentRows = (await prisma.orderPayment.groupBy({
                by: ['paymentMethod'],
                where: {
                    order: {
                        paymentStatus: PaymentStatus.PAID,
                        ...orderWhere
                    }
                },
                _count: { id: true },
                _sum: { amount: true }
            })) as unknown as SalesPaymentRow[];

            const paymentBreakdown: Record<string, { count: number; revenue: number }> = {
                CASH: { count: 0, revenue: 0 },
                GCASH: { count: 0, revenue: 0 }
            };

            for (const row of paymentRows) {
                if (!paymentBreakdown[row.paymentMethod]) continue;
                paymentBreakdown[row.paymentMethod].count = row._count.id;
                paymentBreakdown[row.paymentMethod].revenue = Math.round((row._sum.amount ?? 0) * 100) / 100;
            }

            return { paymentBreakdown };
        }

        if (type === 'orders') {
            const orders = await prisma.order.findMany({
                where: orderWhere,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    queueNumber: true,
                    customerName: true,
                    orderType: true,
                    orderSource: true,
                    netTotal: true,
                    createdAt: true,
                    status: true,
                    paymentStatus: true,
                    payments: {
                        select: {
                            id: true,
                            paymentMethod: true,
                            amount: true,
                            paymentReferenceNumber: true,
                            paymentProofPhoto: true
                        }
                    }
                }
            });

            return {
                orders: orders.map((order) => ({
                    id: order.id,
                    queueNumber: order.queueNumber,
                    customerName: order.customerName,
                    orderType: order.orderType,
                    orderSource: order.orderSource,
                    netTotal: order.netTotal,
                    createdAt: order.createdAt.toISOString(),
                    status: order.status,
                    payments: order.payments.map((payment) => ({
                        id: payment.id,
                        paymentMethod: payment.paymentMethod,
                        paymentStatus: order.paymentStatus,
                        amount: payment.amount,
                        paymentReferenceNumber: payment.paymentReferenceNumber,
                        paymentProofPhoto: payment.paymentProofPhoto
                    }))
                }))
            };
        }

        // Full compiled dataset (when type is omitted)
        const [paymentRows, orderTypeRows, itemRows, dailyRows, orders] = await Promise.all([
            prisma.orderPayment.groupBy({
                by: ['paymentMethod'],
                where: {
                    order: {
                        paymentStatus: PaymentStatus.PAID,
                        ...orderWhere
                    }
                },
                _count: { id: true },
                _sum: { amount: true }
            }) as unknown as Promise<SalesPaymentRow[]>,
            prisma.order.groupBy({
                by: ['orderType'],
                where: orderWhere,
                _count: { id: true },
                _sum: { netTotal: true }
            }) as unknown as Promise<SalesOrderTypeRow[]>,
            prisma.orderItem.findMany({
                where: { order: { is: orderWhere } },
                select: {
                    quantity: true,
                    totalPrice: true,
                    variant: { select: { product: { select: { name: true } } } }
                }
            }),
            prisma.order.findMany({
                where: orderWhere,
                orderBy: { createdAt: 'asc' },
                select: { createdAt: true, netTotal: true }
            }),
            prisma.order.findMany({
                where: orderWhere,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    queueNumber: true,
                    customerName: true,
                    orderType: true,
                    orderSource: true,
                    netTotal: true,
                    createdAt: true,
                    status: true,
                    paymentStatus: true,
                    payments: {
                        select: {
                            id: true,
                            paymentMethod: true,
                            amount: true,
                            paymentReferenceNumber: true,
                            paymentProofPhoto: true
                        }
                    }
                }
            })
        ]);

        const paymentBreakdown: Record<string, { count: number; revenue: number }> = {
            CASH: { count: 0, revenue: 0 },
            GCASH: { count: 0, revenue: 0 }
        };

        for (const row of paymentRows) {
            if (!paymentBreakdown[row.paymentMethod]) continue;
            paymentBreakdown[row.paymentMethod].count = row._count.id;
            paymentBreakdown[row.paymentMethod].revenue = Math.round((row._sum.amount ?? 0) * 100) / 100;
        }

        const orderTypeBreakdown = {
            DINE_IN: { count: 0, revenue: 0 },
            TAKE_OUT: { count: 0, revenue: 0 },
            DELIVERY: { count: 0, revenue: 0 }
        };

        for (const row of orderTypeRows) {
            if (!orderTypeBreakdown[row.orderType]) continue;
            orderTypeBreakdown[row.orderType].count = row._count.id;
            orderTypeBreakdown[row.orderType].revenue = Math.round((row._sum.netTotal ?? 0) * 100) / 100;
        }

        const productMap: Record<string, { name: string; quantity: number; revenue: number }> = {};
        for (const item of itemRows) {
            const name = item.variant.product.name;
            if (!name) continue;

            if (!productMap[name]) {
                productMap[name] = { name, quantity: 0, revenue: 0 };
            }

            productMap[name].quantity += item.quantity;
            productMap[name].revenue += item.totalPrice;
        }

        const topProducts = Object.values(productMap)
            .map((p) => ({ ...p, revenue: Math.round(p.revenue * 100) / 100 }))
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 5);

        const dailyMap: Record<string, { date: string; sales: number; count: number; expenses: number; losses: number; netProfit: number }> = {};
        const temp = new Date(start);
        while (temp <= end) {
            const dateStr = temp.toISOString().split('T')[0];
            dailyMap[dateStr] = {
                date: dateStr,
                sales: 0,
                count: 0,
                expenses: Math.round((dailyExpensesMap[dateStr] || 0) * 100) / 100,
                losses: Math.round((dailyLossesMap[dateStr] || 0) * 100) / 100,
                netProfit: 0
            };
            temp.setDate(temp.getDate() + 1);
        }

        for (const order of dailyRows) {
            const dateStr = order.createdAt.toISOString().split('T')[0];
            if (dailyMap[dateStr]) {
                dailyMap[dateStr].sales = Math.round((dailyMap[dateStr].sales + order.netTotal) * 100) / 100;
                dailyMap[dateStr].count += 1;
            }
        }

        for (const item of Object.values(dailyMap)) {
            item.netProfit = Math.round((item.sales - item.expenses - item.losses) * 100) / 100;
        }

        const dailyTrend = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));

        return {
            summary: summaryPayload,
            financials: pnlPayload,
            paymentBreakdown,
            orderTypeBreakdown,
            topProducts,
            lossBreakdown: lossBreakdownPayload,
            expenseBreakdown: expenseBreakdownPayload,
            dailyTrend,
            orders: orders.map((order) => ({
                id: order.id,
                queueNumber: order.queueNumber,
                customerName: order.customerName,
                orderType: order.orderType,
                orderSource: order.orderSource,
                netTotal: order.netTotal,
                createdAt: order.createdAt.toISOString(),
                status: order.status,
                payments: order.payments.map((payment) => ({
                    id: payment.id,
                    paymentMethod: payment.paymentMethod,
                    paymentStatus: order.paymentStatus,
                    amount: payment.amount,
                    paymentReferenceNumber: payment.paymentReferenceNumber,
                    paymentProofPhoto: payment.paymentProofPhoto
                }))
            }))
        };
    }
}
