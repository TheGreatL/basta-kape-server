import { prisma } from '@/lib/prisma';
import { UserRepository } from '@/feature/user/user.repository';
import { appModules, appPermissions } from '@/constant';

const userRepository = new UserRepository();

export class DashboardService {
    async getSummary(userId: string, dateFrom?: string, dateTo?: string) {
        // 1. Fetch user to resolve their permissions
        const user = await userRepository.findUserByIdentifier(userId);
        if (!user) {
            return {
                message: 'User not found'
            };
        }

        // 2. Resolve user's permissions
        const permissions: Array<{ module: string; permission: string }> = [];
        if (user.role) {
            for (const rp of user.role.rolePermissions) {
                permissions.push({
                    module: rp.modulePermission.module.name.toLowerCase(),
                    permission: rp.modulePermission.permission.name.toLowerCase()
                });
            }
        }

        const hasPermission = (moduleName: string, action: string) => {
            return permissions.some((p) => p.module === moduleName.toLowerCase() && p.permission === action.toLowerCase());
        };

        // Date bounds for metrics (defaults to Today)
        const startDate = dateFrom ? new Date(dateFrom) : new Date();
        startDate.setHours(0, 0, 0, 0);

        const endDate = dateTo ? new Date(dateTo) : new Date();
        endDate.setHours(23, 59, 59, 999);

        // 3. Compile stats based on permissions
        const summary: Record<string, unknown> = {
            user: {
                username: user.username,
                firstName: user.firstName,
                lastName: user.lastName
            }
        };

        // 1. SALES, PROFITABILITY, PAYMENTS & CHANNELS
        const canReadSales =
            hasPermission(appModules.SALES_MANAGEMENT, appPermissions.READ) || hasPermission(appModules.REPORTS_MANAGEMENT, appPermissions.READ);

        if (canReadSales) {
            const [todaySales, paymentsGroup, ordersTypeGroup, saleStockTransactions, rawWasteRows, prepWasteRows] = await Promise.all([
                prisma.order.aggregate({
                    _sum: {
                        subtotal: true,
                        discountAmount: true,
                        netTotal: true
                    },
                    _count: {
                        _all: true
                    },
                    where: {
                        paymentStatus: 'PAID',
                        status: { not: 'CANCELLED' },
                        createdAt: {
                            gte: startDate,
                            lte: endDate
                        }
                    }
                }),
                prisma.orderPayment.groupBy({
                    by: ['paymentMethod'],
                    where: {
                        paymentStatus: 'PAID',
                        createdAt: { gte: startDate, lte: endDate },
                        order: { status: { not: 'CANCELLED' } }
                    },
                    _sum: { amount: true },
                    _count: { id: true }
                }),
                prisma.order.groupBy({
                    by: ['orderType'],
                    where: {
                        paymentStatus: 'PAID',
                        status: { not: 'CANCELLED' },
                        createdAt: { gte: startDate, lte: endDate }
                    },
                    _sum: { netTotal: true },
                    _count: { id: true }
                }),
                prisma.stockTransaction.findMany({
                    where: {
                        type: 'SALE',
                        createdAt: { gte: startDate, lte: endDate }
                    },
                    include: { batch: { select: { unitCost: true } } }
                }),
                prisma.stockTransaction.findMany({
                    where: {
                        type: { in: ['WASTE', 'SPOILED', 'EXPIRED', 'THEFT'] },
                        quantityChange: { lt: 0 },
                        createdAt: { gte: startDate, lte: endDate }
                    },
                    include: { batch: { select: { unitCost: true } } }
                }),
                prisma.preparedItemTransaction.findMany({
                    where: {
                        type: { in: ['EXPIRED', 'SPOILED', 'WASTE', 'DISPOSED'] },
                        quantityChange: { lt: 0 },
                        createdAt: { gte: startDate, lte: endDate }
                    },
                    include: {
                        batch: {
                            include: {
                                productVariant: {
                                    select: { price: true }
                                }
                            }
                        }
                    }
                })
            ]);

            const grossSales = Math.round((todaySales._sum.subtotal ?? 0) * 100) / 100;
            const discountTotal = Math.round((todaySales._sum.discountAmount ?? 0) * 100) / 100;
            const netSales = Math.round((todaySales._sum.netTotal ?? 0) * 100) / 100;
            const orderCount = todaySales._count._all;
            const averageOrderValue = orderCount > 0 ? Math.round((netSales / orderCount) * 100) / 100 : 0;

            // COGS Calculation
            let totalCogs = 0;
            for (const s of saleStockTransactions) {
                totalCogs += Math.abs(s.quantityChange) * (s.batch?.unitCost ?? 0);
            }
            totalCogs = Math.round(totalCogs * 100) / 100;

            // Waste / Loss Calculation
            let rawLoss = 0;
            for (const r of rawWasteRows) {
                rawLoss += Math.abs(r.quantityChange) * (r.batch?.unitCost ?? 0);
            }
            let prepLoss = 0;
            for (const p of prepWasteRows) {
                prepLoss += Math.abs(p.quantityChange) * (p.batch?.productVariant?.price ?? 0);
            }
            const totalFinancialLoss = Math.round((rawLoss + prepLoss) * 100) / 100;

            // Gross Profit & Margins
            const grossProfit = Math.round((netSales - totalCogs) * 100) / 100;
            const grossProfitMargin = netSales > 0 ? Math.round((grossProfit / netSales) * 10000) / 100 : 0;
            const netProfit = Math.round((netSales - totalCogs - totalFinancialLoss) * 100) / 100;
            const netProfitMargin = netSales > 0 ? Math.round((netProfit / netSales) * 10000) / 100 : 0;

            const salesData = {
                grossSales,
                discountTotal,
                netSales,
                orderCount,
                averageOrderValue
            };

            summary.salesToday = salesData;
            summary.salesOverview = salesData;

            summary.profitability = {
                grossSales,
                netSales,
                discountTotal,
                cogs: totalCogs,
                grossProfit,
                grossProfitMargin,
                totalLoss: totalFinancialLoss,
                netProfit,
                netProfitMargin
            };

            // Payment method breakdown
            const totalPaidAmount = paymentsGroup.reduce((sum, p) => sum + (p._sum.amount ?? 0), 0) || netSales || 1;
            summary.paymentBreakdown = paymentsGroup.map((p) => {
                const amount = Math.round((p._sum.amount ?? 0) * 100) / 100;
                return {
                    paymentMethod: p.paymentMethod,
                    amount,
                    count: p._count.id,
                    percentage: Math.round((amount / totalPaidAmount) * 10000) / 100
                };
            });

            // Channel / Order type breakdown
            const totalOrdersNet = ordersTypeGroup.reduce((sum, o) => sum + (o._sum.netTotal ?? 0), 0) || netSales || 1;
            summary.channelBreakdown = ordersTypeGroup.map((o) => {
                const amount = Math.round((o._sum.netTotal ?? 0) * 100) / 100;
                return {
                    channel: o.orderType,
                    netTotal: amount,
                    count: o._count.id,
                    percentage: Math.round((amount / totalOrdersNet) * 10000) / 100
                };
            });
        }

        // 2. PURCHASE ORDERS & PROCUREMENT SUMMARY
        const canReadPO = hasPermission(appModules.PURCHASE_ORDERS_MANAGEMENT, appPermissions.READ);
        if (canReadPO) {
            const [openPOCount, openPOSum, procurementBatches] = await Promise.all([
                prisma.purchaseOrder.count({
                    where: {
                        status: { in: ['SENT', 'PARTIALLY_RECEIVED', 'FINAL_DRAFT', 'DRAFT'] },
                        deletedAt: null
                    }
                }),
                prisma.purchaseOrder.aggregate({
                    where: {
                        status: { in: ['SENT', 'PARTIALLY_RECEIVED', 'FINAL_DRAFT', 'DRAFT'] },
                        deletedAt: null
                    },
                    _sum: { totalAmount: true }
                }),
                prisma.ingredientBatch.aggregate({
                    where: {
                        receivedAt: { gte: startDate, lte: endDate },
                        deletedAt: null
                    },
                    _sum: { totalCost: true }
                })
            ]);

            summary.procurementSummary = {
                openPOCount,
                openPOAmount: Math.round((openPOSum._sum.totalAmount ?? 0) * 100) / 100,
                procurementSpend: Math.round((procurementBatches._sum.totalCost ?? 0) * 100) / 100
            };
        }

        // 3. INVENTORY MANAGEMENT (WITH EXPIRING FOOD PREP BATCHES)
        const canReadInventory = hasPermission(appModules.INVENTORY_MANAGEMENT, appPermissions.READ);
        if (canReadInventory) {
            const [totalItems, criticalCount, outOfStockCount, lowStockItems, expiringBatches] = await Promise.all([
                prisma.ingredientInventory.count(),
                prisma.ingredientInventory.count({
                    where: { status: 'CRITICAL' }
                }),
                prisma.ingredientInventory.count({
                    where: { status: 'OUT_OF_STOCK' }
                }),
                prisma.ingredientInventory.findMany({
                    where: {
                        status: { in: ['CRITICAL', 'OUT_OF_STOCK'] }
                    },
                    include: {
                        ingredient: {
                            include: {
                                defaultUnit: true
                            }
                        }
                    },
                    orderBy: {
                        currentQuantity: 'asc'
                    },
                    take: 5
                }),
                prisma.preparedItemBatch.findMany({
                    where: {
                        status: { in: ['FRESH', 'NEAR_EXPIRY'] },
                        currentQuantity: { gt: 0 },
                        expiresAt: { lte: new Date(Date.now() + 48 * 60 * 60 * 1000) }
                    },
                    include: {
                        product: { select: { name: true } },
                        productVariant: { select: { id: true, sku: true } }
                    },
                    orderBy: { expiresAt: 'asc' },
                    take: 5
                })
            ]);

            summary.inventorySummary = {
                totalItems,
                criticalCount,
                outOfStockCount,
                lowStockItems: lowStockItems.map((item) => ({
                    id: item.id,
                    name: item.ingredient.name,
                    currentQuantity: item.currentQuantity,
                    status: item.status,
                    unit: item.ingredient.defaultUnit?.abbreviation || 'g'
                })),
                expiringPreparedBatches: expiringBatches.map((b) => ({
                    id: b.id,
                    batchNumber: b.batchNumber,
                    productName: b.product.name,
                    variantTitle: b.productVariant?.sku || null,
                    currentQuantity: b.currentQuantity,
                    expiryDate: b.expiresAt ? b.expiresAt.toISOString() : ''
                }))
            };
        }

        // 4. ORDERS MANAGEMENT
        const canReadOrders = hasPermission(appModules.ORDERS_MANAGEMENT, appPermissions.READ);
        if (canReadOrders) {
            const [pendingCount, preparingCount, readyCount, recentOrders] = await Promise.all([
                prisma.order.count({ where: { status: 'PENDING' } }),
                prisma.order.count({ where: { status: 'PREPARING' } }),
                prisma.order.count({ where: { status: 'READY' } }),
                prisma.order.findMany({
                    orderBy: { createdAt: 'desc' },
                    take: 5,
                    select: {
                        id: true,
                        queueNumber: true,
                        status: true,
                        orderType: true,
                        netTotal: true,
                        customerName: true,
                        createdAt: true
                    }
                })
            ]);

            summary.ordersSummary = {
                queueStats: {
                    pending: pendingCount,
                    preparing: preparingCount,
                    ready: readyCount
                },
                recentOrders
            };
        }

        // 5. CUSTOMERS METRICS
        const canReadCustomers = hasPermission(appModules.CUSTOMERS_MANAGEMENT, appPermissions.READ);
        if (canReadCustomers) {
            const [totalCustomers, newCustomersInPeriod] = await Promise.all([
                prisma.customer.count({ where: { deletedAt: null } }),
                prisma.customer.count({
                    where: {
                        createdAt: { gte: startDate, lte: endDate },
                        deletedAt: null
                    }
                })
            ]);

            summary.customerMetrics = {
                totalCustomers,
                newCustomersInPeriod
            };
        }

        // 6. ACTIVITY LOGS AUDIT SNAPSHOT
        const canReadActivityLogs = hasPermission(appModules.ACTIVITY_LOGS, appPermissions.READ);
        if (canReadActivityLogs) {
            const activities = await prisma.activityLog.findMany({
                orderBy: { createdAt: 'desc' },
                take: 6,
                include: {
                    actor: {
                        select: {
                            username: true,
                            firstName: true,
                            lastName: true
                        }
                    }
                }
            });

            summary.recentActivities = activities.map((a) => ({
                id: a.id,
                title: a.title,
                details: a.details,
                createdAt: a.createdAt.toISOString(),
                actorName: a.actor ? `${a.actor.firstName} ${a.actor.lastName}`.trim() || a.actor.username : 'System'
            }));
        }

        // 7. POINT OF SALE / ACTIVE REGISTER SHIFT
        const canReadPOS = hasPermission(appModules.POINT_OF_SALE, appPermissions.READ);
        if (canReadPOS) {
            summary.activeShift = null;
        }

        return summary;
    }
}
