import express, { Express } from 'express';
import swaggerUi from 'swagger-ui-express';

import routes from './routes';
import { generateOpenAPI } from './docs/swagger';
import { setupGlobalMiddleware, globalErrorHandler } from './middleware/global.middleware';

const app: Express = express();

// Apply Global Middlewares
setupGlobalMiddleware(app);

// API Documentation (Swagger)
const swaggerDocument = generateOpenAPI();
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.use('/api', routes);

// Global Error Handler (Must be the last middleware)
app.use(globalErrorHandler);

export default app;
