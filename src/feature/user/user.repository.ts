import { prisma } from '@/lib/prisma';
import type { RegisterSchema } from '@/feature/auth/auth.types';
import type { z } from 'zod';
import bcrypt from 'bcryptjs';

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

export class UserRepository {
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
