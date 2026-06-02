import { vi, describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// Mock rbac middleware
vi.mock('@/middleware/rbac.middleware', () => ({
    requireAccess: vi.fn(() => (req: Request, res: Response, next: NextFunction) => {
        req.user = {
            sub: 'test-user-id',
            email: 'test@example.com',
            username: 'testuser',
            roles: ['Administrator']
        };
        req.rbacScope = 'All';
        next();
    }),
    authenticate: vi.fn((req: Request, res: Response, next: NextFunction) => {
        req.user = {
            sub: 'test-user-id',
            email: 'test@example.com',
            username: 'testuser',
            roles: ['Administrator']
        };
        next();
    })
}));

// Mock activity log service
vi.mock('@/feature/activity-log/activity-log.service', () => {
    return {
        ActivityLogService: class {
            logActivity = vi.fn().mockResolvedValue(true);
        }
    };
});

// Mock upload service
vi.mock('@/feature/upload/upload.service', () => {
    return {
        UploadService: class {
            uploadImage = vi.fn().mockResolvedValue({ url: '/uploads/images/mocked-profile.png' });
        }
    };
});

import request from 'supertest';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import userRouter from '@/feature/user/user.route';
import { HttpException } from '@/exceptions/http.exception';

describe('User Feature CRUD & Profile Photo Upload', () => {
    let app: express.Application;
    let prisma: PrismaClient;
    let createdUserId: string;
    let seededRoleId: string;

    beforeAll(async () => {
        prisma = new PrismaClient();
        app = express();

        app.use(express.json());
        app.use('/users', userRouter);

        // Error handler
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        app.use((err: HttpException, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
            const status = err.statusCode || 500;
            res.status(status).json({ error: err.message });
        });

        // Seed a role to test role updating
        const role = await prisma.role.findFirst();
        if (role) {
            seededRoleId = role.id;
        } else {
            const newRole = await prisma.role.create({
                data: {
                    name: 'Test Role User Test',
                    description: 'Used for user update tests'
                }
            });
            seededRoleId = newRole.id;
        }

        // Seed a test user
        await prisma.userRole.deleteMany({ where: { userId: 'test-user-id' } });
        await prisma.user.deleteMany({ where: { id: 'test-user-id' } });

        const user = await prisma.user.create({
            data: {
                id: 'test-user-id',
                email: 'crud-test@example.com',
                username: 'crudtestuser',
                password: 'hashedpassword123',
                firstName: 'CRUD',
                lastName: 'Test'
            }
        });
        createdUserId = user.id;
    });

    afterAll(async () => {
        // Cleanup test user and role relations
        await prisma.userRole.deleteMany({ where: { userId: createdUserId } });
        await prisma.user.delete({ where: { id: createdUserId } });
        await prisma.$disconnect();
    });

    describe('GET /users/list', () => {
        it('should retrieve a paginated list of users', async () => {
            const res = await request(app).get('/users/list?limit=5');
            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('data');
            expect(res.body).toHaveProperty('meta');
            expect(Array.isArray(res.body.data)).toBe(true);
        });

        it('should filter users by search term', async () => {
            const res = await request(app).get('/users/list?search=crudtestuser');
            expect(res.status).toBe(200);
            expect(res.body.data.length).toBeGreaterThanOrEqual(1);
            expect(res.body.data[0].email).toBe('crud-test@example.com');
        });

        it('should filter users by status active', async () => {
            const res = await request(app).get('/users/list?status=active');
            expect(res.status).toBe(200);
            expect(Array.isArray(res.body.data)).toBe(true);
        });

        it('should filter users by status archive', async () => {
            const res = await request(app).get('/users/list?status=archive');
            expect(res.status).toBe(200);
            expect(Array.isArray(res.body.data)).toBe(true);
        });

        it('should filter users by role', async () => {
            const res = await request(app).get('/users/list?role=Admin');
            expect(res.status).toBe(200);
            expect(Array.isArray(res.body.data)).toBe(true);
        });
    });

    describe('GET /users/:id', () => {
        it('should return a user by ID', async () => {
            const res = await request(app).get(`/users/${createdUserId}`);
            expect(res.status).toBe(200);
            expect(res.body.id).toBe(createdUserId);
            expect(res.body.username).toBe('crudtestuser');
        });

        it('should return 404 for an unknown user ID', async () => {
            const res = await request(app).get('/users/00000000-0000-0000-0000-000000000000');
            expect(res.status).toBe(404);
        });
    });

    describe('PUT /users/:id', () => {
        it('should update a user details and sync roles', async () => {
            const payload = {
                firstName: 'UpdatedFirstName',
                lastName: 'UpdatedLastName',
                roleIds: [seededRoleId]
            };

            const res = await request(app).put(`/users/${createdUserId}`).send(payload);
            expect(res.status).toBe(200);
            expect(res.body.firstName).toBe('UpdatedFirstName');
            expect(res.body.lastName).toBe('UpdatedLastName');
            expect(res.body.userRoles.length).toBe(1);
            expect(res.body.userRoles[0].role.id).toBe(seededRoleId);
        });
    });

    describe('POST /users/:id/profile-picture', () => {
        it('should upload profile picture successfully and update the DB', async () => {
            // supertest lets us upload file buffers via .attach()
            const res = await request(app)
                .post(`/users/${createdUserId}/profile-picture`)
                .attach('file', Buffer.from('fake-image-data'), 'profile.png');

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('url');
            expect(res.body.url).toBe('/uploads/images/mocked-profile.png');

            // Verify db updated
            const user = await prisma.user.findUnique({ where: { id: createdUserId } });
            expect(user?.profilePhoto).toBe('/uploads/images/mocked-profile.png');
        });
    });

    describe('DELETE /users/:id', () => {
        it('should soft-delete a user', async () => {
            const res = await request(app).delete(`/users/${createdUserId}`);
            expect(res.status).toBe(200);

            // Verify soft-deleted (deletedAt is not null)
            const user = await prisma.user.findUnique({ where: { id: createdUserId } });
            expect(user?.deletedAt).not.toBeNull();
        });
    });
});
