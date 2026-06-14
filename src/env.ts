import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables
dotenv.config();

const envSchema = z
    .object({
        NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
        PORT: z.string().default('8000').transform(Number),
        FRONTEND_URL: z.url().default('http://localhost:3000'),
        DATABASE_URL: z.string().url(),
        JWT_ACCESS_SECRET: z.string().min(1, 'JWT access secret is required'),
        JWT_REFRESH_SECRET: z.string().min(1, 'JWT refresh secret is required'),
        JWT_ACCESS_EXPIRY: z.string().default('15m'),
        JWT_REFRESH_EXPIRY: z.string().default('7d'),
        // Storage config
        STORAGE_PROVIDER: z.enum(['local', 'r2']).default('local'),
        R2_ACCOUNT_ID: z.string().optional(),
        R2_ACCESS_KEY_ID: z.string().optional(),
        R2_SECRET_ACCESS_KEY: z.string().optional(),
        R2_BUCKET_NAME: z.string().optional(),
        R2_PUBLIC_URL: z.string().optional()
    })
    .superRefine((data, ctx) => {
        if (data.STORAGE_PROVIDER === 'r2') {
            const requiredFields = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME', 'R2_PUBLIC_URL'] as const;
            for (const field of requiredFields) {
                if (!data[field]) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: `${field} is required when STORAGE_PROVIDER is 'r2'`,
                        path: [field]
                    });
                }
            }
        }
    });

// Validate and export the environment variables
export const env = envSchema.parse(process.env);
