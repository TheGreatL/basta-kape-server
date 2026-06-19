import express, { Express, Request, Response, NextFunction } from 'express';
import compression from 'compression';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';
import cookieParser from 'cookie-parser';
import { ZodTypeAny, ZodError } from 'zod';
import { env } from '../env';
import { logger } from '../utils/logger';

export const setupGlobalMiddleware = (app: Express) => {
    // Security Middlewares
    app.use(
        helmet({
            crossOriginResourcePolicy: { policy: 'cross-origin' }
        })
    );
    app.use(
        rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            limit: 1000,
            message: 'Too many requests from this IP, please try again later.',
            standardHeaders: true,
            legacyHeaders: false
        })
    );
    app.use(compression());

    // Logging Middleware
    app.use(pinoHttp({ logger }));

    // CORS configuration
    app.use(
        cors({
            origin: (origin, callback) => {
                // Allow requests with no origin (like mobile apps, curl, or server-to-server)
                if (!origin) return callback(null, true);

                const allowedOrigins = env.FRONTEND_URL;
                if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
                    callback(null, true);
                } else {
                    callback(null, false);
                }
            },
            credentials: true
        })
    );

    // Body Parsing
    app.use(express.json());

    // Cookie Parsing
    app.use(cookieParser());
};

import { HttpException } from '../exceptions/http.exception';

// Global Error Handler
export const globalErrorHandler = (
    err: HttpException | Error,
    req: Request,
    res: Response,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    next: NextFunction
) => {
    logger.error(err);

    const statusCode = err instanceof HttpException ? err.statusCode : 500;
    const message = err.message || 'Internal Server Error';

    res.status(statusCode).json({
        success: false,
        error: message,
        stack: env.NODE_ENV === 'development' ? err.stack : undefined
    });
};

// Zod Schema Validation Middleware
export const validateRequest = <T extends ZodTypeAny>(schema: T, type: 'body' | 'query' | 'params') => {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            if (type === 'body') {
                req.body = await schema.parseAsync(req.body);
            } else if (type === 'query') {
                const parsedQuery = await schema.parseAsync(req.query);
                Object.defineProperty(req, 'query', {
                    value: parsedQuery,
                    writable: true,
                    configurable: true,
                    enumerable: true
                });
            } else if (type === 'params') {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                req.params = (await schema.parseAsync(req.params)) as any;
            }
            return next();
        } catch (error) {
            if (error instanceof ZodError) {
                res.status(400).json({
                    success: false,
                    error: 'Validation failed',
                    details: error.issues
                });
                return;
            }
            return next(error);
        }
    };
};
