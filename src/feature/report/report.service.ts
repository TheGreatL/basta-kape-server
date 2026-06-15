import { ActivityLogService } from '@/feature/activity-log/activity-log.service';
import { BadRequestException, NotFoundException } from '@/exceptions';
import { prisma } from '@/lib/prisma';
import { OrderStatus, OrderType, PaymentMethod, PaymentStatus, Prisma } from '@prisma/client';
import { ReportGenerator } from './report.generator';
import { ReportRepository } from './report.repository';
import {
    REPORT_BRAND_NAME,
    REPORT_MAX_EXPORT_ROWS,
    REPORT_MODULE_CATALOG,
    type TReportActor,
    type TReportDataset,
    type TReportExportRequest,
    type TReportModule,
    type TReportPreviewRequest,
    type TReportStoreInfo
} from './report.types';

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

        const { rows, total } = await this.repository.fetchReportData(payload.module, filters, { page, limit });
        const pageCount = Math.ceil(total / limit) || 1;

        return {
            module: payload.module,
            title: definition.label,
            columns: definition.columns,
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

        const dataset: TReportDataset = {
            module: payload.module,
            title: payload.title ?? `${definition.label} Report`,
            columns: definition.columns,
            rows,
            meta: {
                total,
                generatedAt: new Date().toLocaleString('en-PH', {
                    year: 'numeric',
                    month: 'long',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                }),
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

    async getSalesAnalytics(dateFrom?: string, dateTo?: string) {
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
            createdAt: {
                gte: start,
                lte: end
            }
        };

        const summary = await prisma.order.aggregate({
            where: orderWhere,
            _count: { id: true },
            _sum: {
                subtotal: true,
                discountAmount: true,
                netTotal: true
            }
        });

        const paymentRows = (await prisma.orderPayment.groupBy({
            by: ['paymentMethod'],
            where: {
                paymentStatus: PaymentStatus.PAID,
                order: {
                    is: orderWhere
                }
            },
            _count: { id: true },
            _sum: { amount: true }
        })) as unknown as SalesPaymentRow[];

        const orderTypeRows = (await prisma.order.groupBy({
            by: ['orderType'],
            where: orderWhere,
            _count: { id: true },
            _sum: { netTotal: true }
        })) as unknown as SalesOrderTypeRow[];

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

        const dailyRows = await prisma.order.findMany({
            where: orderWhere,
            orderBy: { createdAt: 'asc' },
            select: {
                createdAt: true,
                netTotal: true
            }
        });

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
                payments: {
                    select: {
                        id: true,
                        paymentMethod: true,
                        paymentStatus: true,
                        amount: true,
                        gcashReferenceNumber: true,
                        paymentProofPhoto: true
                    }
                }
            }
        });

        const grossSales = summary._sum?.subtotal ?? 0;
        const discountTotal = summary._sum?.discountAmount ?? 0;
        const netSales = summary._sum?.netTotal ?? 0;
        const orderCount = summary._count?.id ?? 0;
        const averageOrderValue = orderCount > 0 ? netSales / orderCount : 0;

        const paymentBreakdown = {
            CASH: { count: 0, revenue: 0 },
            GCASH: { count: 0, revenue: 0 },
            PAYMAYA: { count: 0, revenue: 0 },
            CREDIT_CARD: { count: 0, revenue: 0 }
        };

        for (const row of paymentRows) {
            if (!paymentBreakdown[row.paymentMethod]) continue;
            paymentBreakdown[row.paymentMethod].count = row._count.id;
            paymentBreakdown[row.paymentMethod].revenue = row._sum.amount ?? 0;
        }

        const orderTypeBreakdown = {
            DINE_IN: { count: 0, revenue: 0 },
            TAKE_OUT: { count: 0, revenue: 0 },
            DELIVERY: { count: 0, revenue: 0 }
        };

        for (const row of orderTypeRows) {
            if (!orderTypeBreakdown[row.orderType]) continue;
            orderTypeBreakdown[row.orderType].count = row._count.id;
            orderTypeBreakdown[row.orderType].revenue = row._sum.netTotal ?? 0;
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
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 5);

        const dailyMap: Record<string, { date: string; sales: number; count: number }> = {};
        const temp = new Date(start);
        while (temp <= end) {
            const dateStr = temp.toISOString().split('T')[0];
            dailyMap[dateStr] = { date: dateStr, sales: 0, count: 0 };
            temp.setDate(temp.getDate() + 1);
        }

        for (const order of dailyRows) {
            const dateStr = order.createdAt.toISOString().split('T')[0];
            if (dailyMap[dateStr]) {
                dailyMap[dateStr].sales += order.netTotal;
                dailyMap[dateStr].count += 1;
            }
        }

        const dailyTrend = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));

        return {
            summary: {
                grossSales,
                discountTotal,
                netSales,
                orderCount,
                averageOrderValue
            },
            paymentBreakdown,
            orderTypeBreakdown,
            topProducts,
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
                    paymentStatus: payment.paymentStatus,
                    amount: payment.amount,
                    gcashReferenceNumber: payment.gcashReferenceNumber,
                    paymentProofPhoto: payment.paymentProofPhoto
                }))
            }))
        };
    }
}
