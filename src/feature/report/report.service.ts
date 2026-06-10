import { ActivityLogService } from '@/feature/activity-log/activity-log.service';
import { BadRequestException, NotFoundException } from '@/exceptions';
import { prisma } from '@/lib/prisma';
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
}
