import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';
import swaggerUi from 'swagger-ui-express';

import routes from './routes';
import { env } from './env';
import { logger } from './utils/logger';
import { generateOpenAPI } from './docs/swagger';

const app: Express = express();

// Security Middlewares
app.use(helmet());
app.use(
    rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        limit: 1000, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
        message: 'Too many requests from this IP, please try again later.',
        standardHeaders: true, 
        legacyHeaders: false,
    })
);

// Logging Middleware
app.use(pinoHttp({ logger }));

// CORS configuration: Allow requests from frontend only, and allow cookies
app.use(
    cors({
        origin: env.FRONTEND_URL,
        credentials: true
    })
);
app.use(express.json());

// API Documentation (Swagger)
const swaggerDocument = generateOpenAPI();
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.use('/api', routes);

export default app;
