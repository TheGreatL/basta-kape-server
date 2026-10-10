import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { UserRepository } from '../user/user.repository';
import type { IJwtPayload } from './auth.types';
import type { z } from 'zod';
import type { RegisterSchema } from './auth.types';
import { UnauthorizedException, ConflictException, BadRequestException, NotFoundException } from '@/exceptions';
import { randomUUID } from 'crypto';

import { env } from '@/env';
import { EmailService } from '@/feature/email/email.service';

// In-memory store for password reset tokens: Maps token -> { userId, expiresAt }
const resetTokens = new Map<string, { userId: string; expiresAt: Date }>();

function signTokens(payload: IJwtPayload) {
    // @ts-expect-error jsonwebtoken types expect specific string formats like "15m" instead of generic string
    const accessToken = jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: env.JWT_ACCESS_EXPIRY });
    // @ts-expect-error jsonwebtoken types expect specific string formats like "15m" instead of generic string
    const refreshToken = jwt.sign({ sub: payload.sub, jti: randomUUID() }, env.JWT_REFRESH_SECRET, { expiresIn: env.JWT_REFRESH_EXPIRY });
    return { accessToken, refreshToken };
}

const formatUser = (user: Awaited<ReturnType<UserRepository['findUserByIdentifier']>>) => {
    if (!user) {
        throw new UnauthorizedException('User no longer exists.');
    }

    return {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        roles: user.role
            ? [
                  {
                      name: user.role.name,
                      permissions: user.role.rolePermissions.map((rp) => ({
                          module: rp.modulePermission.module.name,
                          permission: rp.modulePermission.permission.name
                      }))
                  }
              ]
            : []
    };
};

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

        const roles = user.role ? [user.role.name] : [];
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

        return {
            accessToken,
            refreshToken,
            user: formatUser(user)
        };
    }

    /**
     * Register a new user account.
     */
    async register(data: z.infer<typeof RegisterSchema>) {
        // If an OTP code was generated for this email or submitted, verify it
        const hasPendingOtp = AuthService.otpStore.has(data.email.toLowerCase());
        if (data.otp || hasPendingOtp) {
            if (!data.otp || !this.verifyOtp(data.email, data.otp)) {
                throw new BadRequestException('Invalid or expired verification code.');
            }
        }

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

        const roles = user.role ? [user.role.name] : [];
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

        return {
            accessToken,
            refreshToken,
            user: formatUser(user)
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

        const roles = user.role ? [user.role.name] : [];
        const payload: IJwtPayload = {
            sub: user.id,
            email: user.email,
            username: user.username,
            roles
        };

        // @ts-expect-error jsonwebtoken types expect specific string formats like "15m" instead of generic string
        const accessToken = jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: env.JWT_ACCESS_EXPIRY });
        return {
            accessToken,
            user: formatUser(user)
        };
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

    /**
     * Generate password reset token and store it.
     */
    async forgotPassword(email: string) {
        const user = await this.userRepository.findUserByIdentifier(email);
        if (!user) {
            return {
                success: true,
                message: 'If an account with that email exists, a password reset token has been generated.'
            };
        }

        const token = randomUUID();
        resetTokens.set(token, {
            userId: user.id,
            expiresAt: new Date(Date.now() + 60 * 60 * 1000) // 1 hour expiration
        });

        const frontendBase = Array.isArray(env.FRONTEND_URL) ? env.FRONTEND_URL[0] : env.FRONTEND_URL;
        const resetLink = `${frontendBase}/reset-password?token=${token}`;
        const toName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username;

        // Dispatch EmailJS password reset email asynchronously
        EmailService.sendPasswordResetEmail({
            toEmail: user.email,
            toName,
            resetLink,
            resetToken: token,
            expiryMinutes: 60
        }).catch((err) => {
            console.error('[AuthService] Error dispatching password reset email:', err);
        });

        return {
            success: true,
            message: 'If an account with that email exists, a password reset token has been generated.',
            resetToken: process.env.NODE_ENV !== 'production' ? token : undefined
        };
    }

    /**
     * In-memory store for OTPs: Maps email -> { code, expiresAt }
     */
    private static otpStore = new Map<string, { code: string; expiresAt: Date }>();

    /**
     * Generate and dispatch a 6-digit OTP code to user's email.
     */
    async sendOtp(email: string, firstName?: string, username?: string, type: 'register' | 'general' = 'general') {
        if (type === 'register') {
            const conflict = await this.userRepository.findConflict(email, username || '');
            if (conflict) {
                if (conflict.email === email) {
                    throw new ConflictException('An account with this email already exists.');
                }
                if (username && conflict.username === username) {
                    throw new ConflictException('An account with this username already exists.');
                }
            }
        }

        const user = await this.userRepository.findUserByIdentifier(email);
        const toName = firstName || (user ? [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username : 'Customer');

        // Generate 6-digit random code
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        AuthService.otpStore.set(email.toLowerCase(), {
            code: otpCode,
            expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
        });

        EmailService.sendOtpEmail({
            toEmail: email,
            toName,
            otpCode,
            expiryMinutes: 10
        }).catch((err) => {
            console.error('[AuthService] Error dispatching OTP email:', err);
        });

        return {
            success: true,
            message: 'A 6-digit verification code has been sent to your email.',
            otpCode: process.env.NODE_ENV !== 'production' ? otpCode : undefined
        };
    }

    /**
     * Verifies an OTP code against the stored value.
     */
    verifyOtp(email: string, code: string): boolean {
        const record = AuthService.otpStore.get(email.toLowerCase());
        if (!record || record.expiresAt.getTime() < Date.now()) {
            return false;
        }

        if (record.code === code.trim()) {
            AuthService.otpStore.delete(email.toLowerCase());
            return true;
        }

        return false;
    }

    /**
     * Resets a user's password using a valid token.
     */
    async resetPassword(token: string, newPassword: string) {
        const record = resetTokens.get(token);
        if (!record || record.expiresAt.getTime() < Date.now()) {
            throw new BadRequestException('Reset token is invalid or has expired.');
        }

        const user = await this.userRepository.findUserByIdentifier(record.userId);
        if (!user) {
            throw new NotFoundException('User no longer exists.');
        }

        const SALT_ROUNDS = 12;
        const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
        await this.userRepository.updatePassword(user.id, hashedPassword);

        // Revoke all current active refresh tokens to force log out of other sessions
        await this.userRepository.revokeAllUserTokens(user.id);

        // Delete the used reset token
        resetTokens.delete(token);

        return { success: true, message: 'Password has been reset successfully.' };
    }

    /**
     * Changes password for an authenticated user session.
     */
    async changePassword(userId: string, oldPassword: string, newPassword: string) {
        const user = await this.userRepository.findUserByIdentifier(userId);
        if (!user) {
            throw new NotFoundException('User no longer exists.');
        }

        const passwordMatch = await bcrypt.compare(oldPassword, user.password);
        if (!passwordMatch) {
            throw new BadRequestException('Incorrect old password.');
        }

        const SALT_ROUNDS = 12;
        const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
        await this.userRepository.updatePassword(user.id, hashedPassword);

        // Revoke all refresh tokens
        await this.userRepository.revokeAllUserTokens(user.id);

        return { success: true, message: 'Password changed successfully.' };
    }
}
