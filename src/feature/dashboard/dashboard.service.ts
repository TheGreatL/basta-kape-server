import { prisma } from '@/lib/prisma';
import { UserRepository } from '@/feature/user/user.repository';
import { appModules, appPermissions } from '@/constant';

const userRepository = new UserRepository();

export class DashboardService {
    async getSummary(userId: string) {
        // 1. Fetch user to resolve their permissions
        const user = await userRepository.findUserByIdentifier(userId);
        if (!user) {
            return {
                message: 'User not found'
            };
        }

        // 2. Resolve user's permissions
        const permissions: Array<{ module: string; permission: string }> = [];
        for (const ur of user.userRoles) {
            for (const rp of ur.role.rolePermissions) {
                permissions.push({
                    module: rp.modulePermission.module.name.toLowerCase(),
                    permission: rp.modulePermission.permission.name.toLowerCase()
                });
            }
        }

        const hasPermission = (moduleName: string, action: string) => {
            return permissions.some((p) => p.module === moduleName.toLowerCase() && p.permission === action.toLowerCase());
        };

        // Date bounds for Today's metrics
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        // 3. Compile stats based on permissions
        const summary: Record<string, unknown> = {
            user: {
                username: user.username,
                firstName: user.firstName,
                lastName: user.lastName
            }
        };

        // SALES & REPORTS MANAGEMENT
        const canReadSales =
            hasPermission(appModules.SALES_MANAGEMENT, appPermissions.READ) || hasPermission(appModules.REPORTS_MANAGEMENT, appPermissions.READ);

        if (canReadSales) {
            const todayCompletedOrders = await prisma.order.findMany({
                where: {
                    status: 'COMPLETED',
                    createdAt: {
                        gte: todayStart,
                        lte: todayEnd
                    }
                },
                select: {
                    subtotal: true,
                    discountAmount: true,
                    netTotal: true
                }
            });

            let grossSales = 0;
            let discountTotal = 0;
            let netSales = 0;
            const orderCount = todayCompletedOrders.length;

            for (const order of todayCompletedOrders) {
                grossSales += order.subtotal;
                discountTotal += order.discountAmount;
                netSales += order.netTotal;
            }

            const averageOrderValue = orderCount > 0 ? netSales / orderCount : 0;

            summary.salesToday = {
                grossSales,
                discountTotal,
                netSales,
                orderCount,
                averageOrderValue
            };
        }

        // INVENTORY MANAGEMENT
        const canReadInventory = hasPermission(appModules.INVENTORY_MANAGEMENT, appPermissions.READ);
        if (canReadInventory) {
            const [totalItems, criticalCount, outOfStockCount, lowStockItems] = await Promise.all([
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
                }))
            };
        }

        // ORDERS MANAGEMENT
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

        // POINT OF SALE / ACTIVE REGISTER SHIFT
        const canReadPOS = hasPermission(appModules.POINT_OF_SALE, appPermissions.READ);
        if (canReadPOS) {
            const activeShift = await prisma.registerShift.findFirst({
                where: {
                    cashierId: userId,
                    closedAt: null
                },
                select: {
                    id: true,
                    openedAt: true,
                    startBalance: true
                }
            });

            summary.activeShift = activeShift || null;
        }

        return summary;
    }
}
