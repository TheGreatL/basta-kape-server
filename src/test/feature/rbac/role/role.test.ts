import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { PrismaClient, AccessScope } from '@prisma/client';
import roleRouter from '@/feature/rbac/role/role.route';
import { HttpException } from '@/exceptions/http.exception';

describe('Role Feature (RBAC)', () => {
    let app: express.Application;
    let prisma: PrismaClient;

    let testModulePermissionId: string;
    let createdRoleId: string;

    beforeAll(async () => {
        prisma = new PrismaClient();
        app = express();

        app.use(express.json());

        // Mount the router
        app.use('/roles', roleRouter);

        // Mock error handler
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        app.use((err: HttpException, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
            const status = err.statusCode || 500;
            res.status(status).json({ error: err.message });
        });

        // Pre-clean stuck roles
        const stuckRole = await prisma.role.findFirst({ where: { name: 'Test Role Generator' } });
        if (stuckRole) {
            await prisma.rolePermission.deleteMany({ where: { roleId: stuckRole.id } });
            await prisma.role.delete({ where: { id: stuckRole.id } });
        }

        // Ensure we have at least one ModulePermission to test with
        const module = await prisma.module.findFirst();
        const permission = await prisma.permission.findFirst();
        if (!module || !permission) throw new Error('Seed your database first!');

        let mp = await prisma.modulePermission.findFirst({
            where: { moduleId: module.id, permissionId: permission.id, accessScope: AccessScope.ALL }
        });
        if (!mp) {
            mp = await prisma.modulePermission.create({
                data: { moduleId: module.id, permissionId: permission.id, accessScope: AccessScope.ALL }
            });
        }
        testModulePermissionId = mp.id;
    });

    afterAll(async () => {
        // Clean up our test role if it exists
        if (createdRoleId) {
            await prisma.rolePermission.deleteMany({ where: { roleId: createdRoleId } });
            await prisma.role.delete({ where: { id: createdRoleId } });
        }
        await prisma.$disconnect();
    });

    describe('GET /roles/modules-permissions', () => {
        it('should return the dynamic selection tree', async () => {
            const res = await request(app).get('/roles/modules-permissions');
            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
            if (res.body.length > 0) {
                expect(res.body[0]).toHaveProperty('moduleId');
                expect(res.body[0]).toHaveProperty('permissions');
                expect(res.body[0].permissions[0]).toHaveProperty('modulePermissions');
            }
        });
    });

    describe('POST /roles', () => {
        it('should create a new role', async () => {
            const payload = {
                name: 'Test Role Generator',
                description: 'Generated during vitest',
                permissions: [
                    {
                        modulePermissionId: testModulePermissionId,
                        scope: AccessScope.ALL
                    }
                ]
            };

            const res = await request(app).post('/roles').send(payload);
            expect(res.status).toBe(201);
            expect(res.body.name).toBe('Test Role Generator');

            createdRoleId = res.body.id; // Store for cleanup
        });
    });

    describe('GET /roles/list', () => {
        it('should return a paginated list of roles', async () => {
            const res = await request(app).get('/roles/list?limit=5');
            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('data');
            expect(res.body.meta.total).toBeGreaterThanOrEqual(1);
        });
    });

    describe('GET /roles/:name', () => {
        it('should return a role by name with nested permissions', async () => {
            const res = await request(app).get('/roles/Test Role Generator');
            expect(res.status).toBe(200);
            expect(res.body.name).toBe('Test Role Generator');
            expect(res.body).toHaveProperty('rolePermissions');
        });

        it('should return 404 for unknown role', async () => {
            const res = await request(app).get('/roles/UnknownRoleXYZ');
            expect(res.status).toBe(404);
        });
    });

    describe('PUT /roles/:id', () => {
        it('should return 403 when trying to update a system role', async () => {
            // "Administrator" is a system role seeded by seedUsers
            const admin = await prisma.role.findFirst({ where: { name: 'Administrator' } });
            if (!admin) return;

            const res = await request(app).put(`/roles/${admin.id}`).send({ name: 'Hacked Admin' });
            expect(res.status).toBe(403);
            expect(res.body.error).toContain('System generated roles');
        });

        it('should successfully update a non-system role', async () => {
            const res = await request(app).put(`/roles/${createdRoleId}`).send({
                description: 'Updated description'
            });
            expect(res.status).toBe(200);
            expect(res.body.description).toBe('Updated description');
        });
    });

    describe('DELETE /roles/:id', () => {
        it('should return 403 when trying to delete a system role', async () => {
            const admin = await prisma.role.findFirst({ where: { name: 'Administrator' } });
            if (!admin) return;

            const res = await request(app).delete(`/roles/${admin.id}`);
            expect(res.status).toBe(403);
            expect(res.body.error).toContain('System generated roles');
        });

        it('should soft-delete a non-system role', async () => {
            const res = await request(app).delete(`/roles/${createdRoleId}`);
            expect(res.status).toBe(200);

            // Verify soft delete
            const verify = await prisma.role.findFirst({ where: { id: createdRoleId } });
            expect(verify?.deletedAt).not.toBeNull();
        });
    });
});
