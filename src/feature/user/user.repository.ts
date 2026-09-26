import { prisma } from '@/lib/prisma';
import type { RegisterSchema } from '@/feature/auth/auth.types';
import type { z } from 'zod';
import bcrypt from 'bcryptjs';
import { BaseRepository } from '@/repository/base.repository';

import type { IPaginatedResult } from '@/types/base.types';
import { Prisma } from '@prisma/client';
import { TCreateUser, TGetUserListQuery, TUpdateUser, TUpdateSelfProfile } from './user.types';

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
    role: {
        select: {
            name: true,
            rolePermissions: {
                where: { deletedAt: null },
                select: {
                    modulePermission: {
                        select: {
                            module: { select: { name: true } },
                            permission: { select: { name: true } }
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
     * Creates a new user with a hashed password, and automatically assigns the Customer role.
     * Used by the public /auth/register endpoint.
     */
    async createCustomerUser(data: z.infer<typeof RegisterSchema>) {
        const hashedPassword = await bcrypt.hash(data.password, SALT_ROUNDS);

        const customerRole = await prisma.role.findFirst({
            where: { name: 'Customer', deletedAt: null }
        });

        if (!customerRole) {
            throw new Error('Default Customer role not found');
        }

        const userData: Prisma.UserCreateInput = {
            email: data.email,
            username: data.username,
            password: hashedPassword,
            firstName: data.firstName,
            middleName: data.middleName,
            lastName: data.lastName,
            phoneNumber: data.phoneNumber,
            role: {
                connect: { id: customerRole.id }
            },
            customer: {
                create: {}
            }
        };

        return prisma.user.create({
            data: userData,
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
     * Creates a new user from the admin panel with a selected role.
     */
    async createUser(data: TCreateUser) {
        const { roleId, ...rest } = data;
        const hashedPassword = await bcrypt.hash(rest.password, SALT_ROUNDS);

        return prisma.user.create({
            data: {
                ...rest,
                password: hashedPassword,
                role: {
                    connect: { id: roleId }
                }
            },
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
                role: {
                    select: {
                        id: true,
                        name: true
                    }
                }
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
            where.role = {
                name: params.role
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
        where.customer = { is: null };

        const [data, totalRows] = await Promise.all([
            prisma.user.findMany({
                where,
                skip,
                take,
                orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
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
                    role: {
                        select: {
                            id: true,
                            name: true
                        }
                    }
                }
            }),
            prisma.user.count({ where })
        ]);

        return this.formatPaginatedResult(data, totalRows, page, take);
    }

    /**
     * Finds a user by ID or Username with nested role.
     */
    async findById(idOrUsername: string) {
        return prisma.user.findFirst({
            where: {
                OR: [{ id: idOrUsername }, { username: idOrUsername }],
                deletedAt: null
            },
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
                role: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            }
        });
    }

    /**
     * Finds a user by ID or Username, including soft-deleted ones.
     */
    async findByIdIncludingDeleted(idOrUsername: string) {
        return prisma.user.findFirst({
            where: {
                OR: [{ id: idOrUsername }, { username: idOrUsername }]
            },
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
                role: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            }
        });
    }

    /**
     * Checks if email or username is already taken, excluding a specific user.
     */
    async findConflictExcluding(email: string | undefined, username: string | undefined, excludeUserId: string) {
        const orConditions: Prisma.UserWhereInput[] = [];
        if (email) orConditions.push({ email });
        if (username) orConditions.push({ username });

        if (orConditions.length === 0) return null;

        return prisma.user.findFirst({
            where: {
                OR: orConditions,
                id: { not: excludeUserId },
                deletedAt: null
            },
            select: { email: true, username: true }
        });
    }

    /**
     * Updates a user's own profile fields (no role changes).
     */
    async updateSelfProfile(id: string, data: TUpdateSelfProfile) {
        return prisma.user.update({
            where: { id },
            data,
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
                role: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            }
        });
    }

    /**
     * Updates an existing user and optionally updates role.
     */
    async updateUser(id: string, data: TUpdateUser) {
        const { roleId, ...rest } = data;

        const updateData: Prisma.UserUpdateInput = {
            ...rest
        };

        if (roleId !== undefined) {
            updateData.role = {
                connect: { id: roleId }
            };
        }

        return prisma.user.update({
            where: { id },
            data: updateData,
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
                role: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            }
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
     * Restores a soft-deleted user.
     */
    async restoreUser(id: string) {
        return prisma.user.update({
            where: { id },
            data: { deletedAt: null }
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

    async updatePassword(id: string, passwordHash: string) {
        return prisma.user.update({
            where: { id },
            data: { password: passwordHash }
        });
    }
}
