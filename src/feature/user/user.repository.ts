import { prisma } from '@/lib/prisma';
import type { RegisterSchema } from '@/feature/auth/auth.types';
import type { z } from 'zod';
import bcrypt from 'bcryptjs';
import { BaseRepository } from '@/repository/base.repository';

import type { IPaginatedResult } from '@/types/base.types';
import { Prisma } from '@prisma/client';
import { TGetUserListQuery, TUpdateUser } from './user.types';

const SALT_ROUNDS = 12;

// The select shape returned for auth queries — only what we need
const userAuthSelect = {
    id: true,
    email: true,
    username: true,
    password: true,
    firstName: true,
    lastName: true,
    deletedAt: true,
    userRoles: {
        where: { deletedAt: null },
        select: {
            role: {
                select: {
                    name: true,
                    rolePermissions: {
                        select: {
                            modulePermission: {
                                select: {
                                    accessScope: true,
                                    module: { select: { name: true } },
                                    permission: { select: { name: true } }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
} as const;

export class UserRepository extends BaseRepository {
    /**
     * Finds a user by email OR username (for flexible login).
     */
    async findUserByIdentifier(identifier: string) {
        return prisma.user.findFirst({
            where: {
                OR: [{ id: identifier }, { email: identifier }, { username: identifier }],
                deletedAt: null
            },
            select: userAuthSelect
        });
    }

    /**
     * Checks if email or username is already taken.
     */
    async findConflict(email: string, username: string) {
        return prisma.user.findFirst({
            where: {
                OR: [{ email }, { username }],
                deletedAt: null
            },
            select: { email: true, username: true }
        });
    }

    /**
     * Creates a new user with a hashed password.
     */
    async createUser(data: z.infer<typeof RegisterSchema>) {
        const hashedPassword = await bcrypt.hash(data.password, SALT_ROUNDS);
        return prisma.user.create({
            data: {
                email: data.email,
                username: data.username,
                password: hashedPassword,
                firstName: data.firstName,
                middleName: data.middleName,
                lastName: data.lastName,
                phoneNumber: data.phoneNumber
            },
            select: {
                id: true,
                email: true,
                username: true,
                firstName: true,
                lastName: true
            }
        });
    }

    /**
     * Retrieves a paginated list of users.
     */
    async getList(params: TGetUserListQuery): Promise<IPaginatedResult<unknown>> {
        const { skip, take, page } = this.normalizePagination(params);

        const where: Prisma.UserWhereInput = {};

        if (params.status === 'active') {
            where.deletedAt = null;
        } else if (params.status === 'archive') {
            where.deletedAt = { not: null };
        }

        if (params.role) {
            where.userRoles = {
                some: {
                    role: {
                        name: params.role
                    }
                }
            };
        }

        if (params.search) {
            const searchLower = params.search.toLowerCase();
            where.OR = [
                { email: { contains: searchLower } },
                { username: { contains: searchLower } },
                { firstName: { contains: searchLower } },
                { lastName: { contains: searchLower } }
            ];
        }

        const [data, totalRows] = await Promise.all([
            prisma.user.findMany({
                where,
                skip,
                take,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    email: true,
                    username: true,
                    firstName: true,
                    middleName: true,
                    lastName: true,
                    phoneNumber: true,
                    profilePhoto: true,
                    createdAt: true,
                    updatedAt: true,
                    deletedAt: true,
                    userRoles: {
                        where: { deletedAt: null },
                        select: {
                            role: {
                                select: {
                                    id: true,
                                    name: true
                                }
                            }
                        }
                    }
                }
            }),
            prisma.user.count({ where })
        ]);

        return this.formatPaginatedResult(data, totalRows, page, take);
    }

    /**
     * Finds a user by ID with nested roles.
     */
    async findById(id: string) {
        return prisma.user.findFirst({
            where: { id, deletedAt: null },
            select: {
                id: true,
                email: true,
                username: true,
                firstName: true,
                middleName: true,
                lastName: true,
                phoneNumber: true,
                profilePhoto: true,
                createdAt: true,
                updatedAt: true,
                deletedAt: true,
                userRoles: {
                    where: { deletedAt: null },
                    select: {
                        role: {
                            select: {
                                id: true,
                                name: true
                            }
                        }
                    }
                }
            }
        });
    }

    /**
     * Updates an existing user and optionally syncs roles.
     */
    async updateUser(id: string, data: TUpdateUser) {
        const { roleIds, ...rest } = data;

        return prisma.$transaction(async (tx) => {
            await tx.user.update({
                where: { id },
                data: rest,
                select: {
                    id: true
                }
            });

            if (roleIds !== undefined) {
                // Delete existing role relations
                await tx.userRole.deleteMany({
                    where: { userId: id }
                });

                // Create new role relations
                if (roleIds.length > 0) {
                    await tx.userRole.createMany({
                        data: roleIds.map((roleId: string) => ({
                            userId: id,
                            roleId
                        }))
                    });
                }
            }

            // Fetch the user with roles to return
            const finalUser = await tx.user.findUnique({
                where: { id },
                select: {
                    id: true,
                    email: true,
                    username: true,
                    firstName: true,
                    middleName: true,
                    lastName: true,
                    phoneNumber: true,
                    profilePhoto: true,
                    createdAt: true,
                    updatedAt: true,
                    deletedAt: true,
                    userRoles: {
                        where: { deletedAt: null },
                        select: {
                            role: {
                                select: {
                                    id: true,
                                    name: true
                                }
                            }
                        }
                    }
                }
            });

            return finalUser;
        });
    }

    /**
     * Soft deletes a user.
     */
    async softDeleteUser(id: string) {
        return prisma.user.update({
            where: { id },
            data: { deletedAt: new Date() }
        });
    }

    /**
     * Updates the user's profile photo.
     */
    async updateProfilePhoto(id: string, url: string) {
        return prisma.user.update({
            where: { id },
            data: { profilePhoto: url },
            select: {
                id: true,
                profilePhoto: true
            }
        });
    }

    // ==========================================
    // REFRESH TOKEN MANAGEMENT
    // ==========================================

    async saveRefreshToken(userId: string, token: string, expiresAt: Date) {
        return prisma.refreshToken.create({
            data: { userId, token, expiresAt }
        });
    }

    async findRefreshToken(token: string) {
        return prisma.refreshToken.findUnique({
            where: { token },
            include: { user: true }
        });
    }

    async revokeRefreshToken(token: string) {
        return prisma.refreshToken.update({
            where: { token },
            data: { isRevoked: true }
        });
    }

    async revokeAllUserTokens(userId: string) {
        return prisma.refreshToken.updateMany({
            where: { userId, isRevoked: false },
            data: { isRevoked: true }
        });
    }
}
