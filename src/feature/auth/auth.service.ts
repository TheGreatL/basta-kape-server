import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { UserRepository } from '../user/user.repository';
import type { IJwtPayload } from './auth.types';
import type { z } from 'zod';
import type { RegisterSchema } from './auth.types';
import { UnauthorizedException, ConflictException } from '@/exceptions';
import { randomUUID } from 'crypto';

import { env } from '@/env';

function signTokens(payload: IJwtPayload) {
    // @ts-expect-error jsonwebtoken types expect specific string formats like "15m" instead of generic string
    const accessToken = jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: env.JWT_ACCESS_EXPIRY });
    // @ts-expect-error jsonwebtoken types expect specific string formats like "15m" instead of generic string
    const refreshToken = jwt.sign({ sub: payload.sub, jti: randomUUID() }, env.JWT_REFRESH_SECRET, { expiresIn: env.JWT_REFRESH_EXPIRY });
    return { accessToken, refreshToken };
}

type AuthServiceConstructor = {
    userRepository?: UserRepository;
};

export class AuthService {
    private userRepository: UserRepository;

    constructor(params?: AuthServiceConstructor) {
        this.userRepository = params?.userRepository ?? new UserRepository();
    }

    /**
     * Login with email OR username + password.
     * Returns a signed accessToken and refreshToken on success.
     */
    async login(identifier: string, password: string) {
        const user = await this.userRepository.findUserByIdentifier(identifier);

        // Generic 401 to avoid leaking whether the identifier exists
        if (!user) {
            throw new UnauthorizedException('Invalid credentials.');
        }

        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            throw new UnauthorizedException('Invalid credentials.');
        }

        const roles = user.userRoles.map((ur) => ur.role.name);
        const payload: IJwtPayload = {
            sub: user.id,
            email: user.email,
            username: user.username,
            roles
        };

        const { accessToken, refreshToken } = signTokens(payload);

        // Save refresh token to DB
        const decodedRefresh = jwt.decode(refreshToken) as jwt.JwtPayload;
        const expiresAt = new Date(decodedRefresh.exp! * 1000);
        await this.userRepository.saveRefreshToken(user.id, refreshToken, expiresAt);

        const formattedRoles = user.userRoles.map((ur) => ({
            name: ur.role.name,
            permissions: ur.role.rolePermissions.map((rp) => ({
                module: rp.modulePermission.module.name,
                permission: rp.modulePermission.permission.name,
                scope: rp.modulePermission.accessScope
            }))
        }));

        return {
            accessToken,
            refreshToken,
            user: {
                id: user.id,
                email: user.email,
                username: user.username,
                firstName: user.firstName,
                lastName: user.lastName,
                roles: formattedRoles
            }
        };
    }

    /**
     * Register a new user account.
     */
    async register(data: z.infer<typeof RegisterSchema>) {
        // Check for duplicate email or username
        const conflict = await this.userRepository.findConflict(data.email, data.username);
        if (conflict) {
            if (conflict.email === data.email) {
                throw new ConflictException('An account with this email already exists.');
            }
            throw new ConflictException('An account with this username already exists.');
        }

        const createdUser = await this.userRepository.createCustomerUser(data);

        // Re-fetch to get the assigned Customer role and match login format
        const user = (await this.userRepository.findUserByIdentifier(createdUser.id))!;

        const roles = user.userRoles.map((ur) => ur.role.name);
        const payload: IJwtPayload = {
            sub: user.id,
            email: user.email,
            username: user.username,
            roles
        };

        const { accessToken, refreshToken } = signTokens(payload);

        // Save refresh token to DB
        const decodedRefresh = jwt.decode(refreshToken) as jwt.JwtPayload;
        const expiresAt = new Date(decodedRefresh.exp! * 1000);
        await this.userRepository.saveRefreshToken(user.id, refreshToken, expiresAt);

        const formattedRoles = user.userRoles.map((ur) => ({
            name: ur.role.name,
            permissions: ur.role.rolePermissions.map((rp) => ({
                module: rp.modulePermission.module.name,
                permission: rp.modulePermission.permission.name,
                scope: rp.modulePermission.accessScope
            }))
        }));

        return {
            accessToken,
            refreshToken,
            user: {
                id: user.id,
                email: user.email,
                username: user.username,
                firstName: user.firstName,
                lastName: user.lastName,
                roles: formattedRoles
            }
        };
    }

    /**
     * Exchange a valid refreshToken for a new accessToken.
     */
    async refreshAccessToken(refreshToken: string) {
        let decoded: jwt.JwtPayload;
        try {
            decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as jwt.JwtPayload;
        } catch {
            throw new UnauthorizedException('Refresh token is invalid or expired.');
        }

        // Verify token is active in DB
        const dbToken = await this.userRepository.findRefreshToken(refreshToken);
        if (!dbToken || dbToken.isRevoked) {
            throw new UnauthorizedException('Refresh token is invalid or has been revoked.');
        }

        // Re-fetch user to ensure they still exist and get current roles
        const user = await this.userRepository.findUserByIdentifier(decoded.sub as string);
        if (!user) {
            throw new UnauthorizedException('User no longer exists.');
        }

        const roles = user.userRoles.map((ur) => ur.role.name);
        const payload: IJwtPayload = {
            sub: user.id,
            email: user.email,
            username: user.username,
            roles
        };

        // @ts-expect-error jsonwebtoken types expect specific string formats like "15m" instead of generic string
        const accessToken = jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: env.JWT_ACCESS_EXPIRY });
        return { accessToken };
    }

    /**
     * Verifies a JWT access token and returns the decoded payload.
     * Used by the authenticate middleware.
     */
    verifyAccessToken(token: string): IJwtPayload {
        try {
            return jwt.verify(token, env.JWT_ACCESS_SECRET) as IJwtPayload;
        } catch {
            throw new UnauthorizedException('Access token is invalid or expired.');
        }
    }

    /**
     * Revoke a refresh token to end the session.
     */
    async logout(refreshToken: string) {
        try {
            await this.userRepository.revokeRefreshToken(refreshToken);
        } catch {
            // It might already be revoked or not exist, which is fine for logout.
        }
        return { success: true };
    }
}
