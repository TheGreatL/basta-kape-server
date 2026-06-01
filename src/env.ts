import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables
dotenv.config();

// Define the schema for environment variables
const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.string().default('8000').transform(Number),
    FRONTEND_URL: z.url().default('http://localhost:3000'),
    DATABASE_URL: z.string().url()
});

// Validate and export the environment variables
export const env = envSchema.parse(process.env);
