import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables
dotenv.config();

// Define the schema for environment variables
const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.string().default('8000').transform(Number),
    FRONTEND_URL: z.url().default('http://localhost:3000'),
    DATABASE_URL: z.string().url(),
    JWT_ACCESS_SECRET: z.string().min(1, 'JWT access secret is required'),
    JWT_REFRESH_SECRET: z.string().min(1, 'JWT refresh secret is required'),
    JWT_ACCESS_EXPIRY: z.string().default('15m'),
    JWT_REFRESH_EXPIRY: z.string().default('7d')
});

// Validate and export the environment variables
export const env = envSchema.parse(process.env);
