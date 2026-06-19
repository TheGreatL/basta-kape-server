import { z } from 'zod';

// ── Login ────────────────────────────────────────────────────────────────────
export const LoginSchema = z.object({
    identifier: z.string().min(1, 'Email or username is required'), // accepts email OR username
    password: z.string().min(1, 'Password is required')
});

// ── Register ─────────────────────────────────────────────────────────────────
export const RegisterSchema = z.object({
    email: z.string().email('Invalid email address'),
    username: z.string().min(3, 'Username must be at least 3 characters'),
    password: z
        .string()
        .min(8, 'Password must be at least 8 characters')
        .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
        .regex(/[0-9]/, 'Password must contain at least one number'),
    firstName: z.string().min(1, 'First name is required'),
    middleName: z.string().optional(),
    lastName: z.string().min(1, 'Last name is required'),
    phoneNumber: z.string().optional()
});

// ── JWT Payload (what we embed in the token) ──────────────────────────────────
export interface IJwtPayload {
    sub: string; // userId
    email: string;
    username: string;
    roles: string[]; // role names
}

// ── Auth Response ─────────────────────────────────────────────────────────────
export const AuthTokenResponseSchema = z.object({
    accessToken: z.string(),
    userId: z.string()
});

// ── Password Reset & Change ───────────────────────────────────────────────────
export const ForgotPasswordSchema = z.object({
    email: z.string().email('Invalid email address')
});

export type TForgotPassword = z.infer<typeof ForgotPasswordSchema>;

export const ResetPasswordSchema = z.object({
    token: z.string().min(1, 'Reset token is required'),
    newPassword: z
        .string()
        .min(8, 'Password must be at least 8 characters')
        .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
        .regex(/[0-9]/, 'Password must contain at least one number')
});

export type TResetPassword = z.infer<typeof ResetPasswordSchema>;

export const ChangePasswordSchema = z.object({
    oldPassword: z.string().min(1, 'Old password is required'),
    newPassword: z
        .string()
        .min(8, 'Password must be at least 8 characters')
        .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
        .regex(/[0-9]/, 'Password must contain at least one number')
});

export type TChangePassword = z.infer<typeof ChangePasswordSchema>;
