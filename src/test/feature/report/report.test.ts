import { vi, describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

vi.mock('@/middleware/rbac.middleware', () => ({
    requireAccess: vi.fn(() => (req: Request, _res: Response, next: NextFunction) => {
        req.user = {
            sub: 'test-report-user-id',
            email: 'testreport@example.com',
            username: 'testreportuser',
            roles: ['Administrator']
        };
        req.rbacScope = 'All';
        next();
    }),
    authenticate: vi.fn((req: Request, _res: Response, next: NextFunction) => {
        req.user = {
            sub: 'test-report-user-id',
            email: 'testreport@example.com',
            username: 'testreportuser',
            roles: ['Administrator']
        };
        next();
    })
}));

vi.mock('@/feature/activity-log/activity-log.service', () => {
    return {
        ActivityLogService: class {
            logActivity = vi.fn().mockResolvedValue(true);
        }
    };
});

import request from 'supertest';
import express from 'express';
import ExcelJS from 'exceljs';
import { ZodError } from 'zod';
import { PrismaClient } from '@prisma/client';
import reportRouter from '@/feature/report/report.route';
import { HttpException } from '@/exceptions/http.exception';

describe('Report Feature', () => {
    let app: express.Application;
    let prisma: PrismaClient;
    let testSupplierId: string;

    beforeAll(async () => {
        prisma = new PrismaClient();
        app = express();
        app.use(express.json());
        app.use('/reports', reportRouter);

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        app.use((err: HttpException | Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
            if (err instanceof ZodError) {
                res.status(400).json({ error: 'Validation failed', details: err.issues });
                return;
            }

            const status = err instanceof HttpException ? err.statusCode : 500;
            res.status(status).json({ error: err.message });
        });

        await prisma.user.upsert({
            where: { id: 'test-report-user-id' },
            update: {},
            create: {
                id: 'test-report-user-id',
                email: 'testreport@example.com',
                username: 'testreportuser',
                password: 'hashedpassword123',
                firstName: 'Report',
                lastName: 'Tester'
            }
        });

        const supplier = await prisma.supplier.create({
            data: {
                name: 'Report Test Supplier',
                contactPerson: 'Jane Supplier',
                contactNumber: '09171234567',
                address: '123 Report Street',
                createdById: 'test-report-user-id',
                updatedById: 'test-report-user-id'
            }
        });
        testSupplierId = supplier.id;
    });

    afterAll(async () => {
        if (testSupplierId) {
            await prisma.supplier.deleteMany({ where: { id: testSupplierId } });
        }
        await prisma.user.deleteMany({ where: { id: 'test-report-user-id' } });
        await prisma.$disconnect();
    });

    it('should list available report modules with filters and columns', async () => {
        const res = await request(app).get('/reports/modules');
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('data');
        expect(Array.isArray(res.body.data)).toBe(true);
        expect(res.body.data.length).toBeGreaterThan(0);

        const suppliersModule = res.body.data.find((module: { id: string }) => module.id === 'suppliers');
        expect(suppliersModule).toBeDefined();
        expect(suppliersModule.columns.length).toBeGreaterThan(0);
        expect(suppliersModule.filters.length).toBeGreaterThan(0);
    });

    it('should preview supplier report data with filters', async () => {
        const res = await request(app)
            .post('/reports/preview')
            .send({
                module: 'suppliers',
                filters: { search: 'Report Test Supplier', status: 'active' },
                page: 1,
                limit: 10
            });

        expect(res.status).toBe(200);
        expect(res.body.module).toBe('suppliers');
        expect(res.body).toHaveProperty('columns');
        expect(res.body).toHaveProperty('rows');
        expect(res.body.meta.total).toBeGreaterThanOrEqual(1);

        const row = res.body.rows.find((entry: { name: string }) => entry.name === 'Report Test Supplier');
        expect(row).toBeDefined();
        expect(row.contactPerson).toBe('Jane Supplier');
    });

    it('should export supplier report as Excel', async () => {
        const res = await request(app)
            .post('/reports/export')
            .send({
                module: 'suppliers',
                filters: { search: 'Report Test Supplier', status: 'active' },
                format: 'excel',
                title: 'Supplier Export Test'
            })
            .buffer(true)
            .parse((response, callback) => {
                const chunks: Buffer[] = [];
                response.on('data', (chunk: Buffer) => chunks.push(chunk));
                response.on('end', () => callback(null, Buffer.concat(chunks)));
            });

        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toContain('spreadsheetml.sheet');
        expect(res.headers['content-disposition']).toContain('attachment');
        expect(Buffer.isBuffer(res.body)).toBe(true);
        expect((res.body as Buffer).length).toBeGreaterThan(100);

        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(res.body as unknown as ExcelJS.Buffer);
        const sheet = workbook.getWorksheet('Report');
        expect(sheet).toBeDefined();

        const sheetValues = sheet!.getSheetValues().flat().filter(Boolean).map(String);
        expect(sheetValues.some((value) => value.includes('Generated By'))).toBe(true);
        expect(sheetValues.some((value) => value.includes('Report Tester -'))).toBe(true);
    });

    it('should export supplier report as PDF', async () => {
        const res = await request(app)
            .post('/reports/export')
            .send({
                module: 'suppliers',
                filters: { search: 'Report Test Supplier', status: 'active' },
                format: 'pdf'
            })
            .buffer(true)
            .parse((response, callback) => {
                const chunks: Buffer[] = [];
                response.on('data', (chunk: Buffer) => chunks.push(chunk));
                response.on('end', () => callback(null, Buffer.concat(chunks)));
            });

        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toBe('application/pdf');
        expect(Buffer.isBuffer(res.body)).toBe(true);
        expect((res.body as Buffer).subarray(0, 4).toString()).toBe('%PDF');
    });

    it('should include actor audit metadata when generating PDF export', async () => {
        const { ReportGenerator } = await import('@/feature/report/report.generator');

        const generator = new ReportGenerator();
        const { buffer, extension, mimeType } = await generator.generate(
            {
                module: 'suppliers',
                title: 'Supplier Audit Test',
                columns: [{ key: 'name', header: 'Name' }],
                rows: [{ name: 'Test Supplier' }],
                meta: {
                    total: 1,
                    generatedAt: 'Jun 09, 2026, 03:30 PM',
                    filters: {},
                    truncated: false,
                    generatedBy: {
                        id: 'test-report-user-id',
                        fullName: 'Report Tester',
                        email: 'testreport@example.com',
                        username: 'testreportuser'
                    },
                    store: {
                        storeName: 'Basta Kape',
                        address: '50 K-1st, Quezon City, Metro Manila'
                    }
                }
            },
            'pdf'
        );

        expect(extension).toBe('pdf');
        expect(mimeType).toBe('application/pdf');
        expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
        expect(buffer.length).toBeGreaterThan(100);
    });

    it('should reject invalid report module on preview', async () => {
        const res = await request(app).post('/reports/preview').send({
            module: 'invalid-module',
            filters: {}
        });

        expect(res.status).toBe(400);
    });
});
