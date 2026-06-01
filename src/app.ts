import express, { Express } from 'express';
import routes from './routes';
import { setupGlobalMiddleware, globalErrorHandler } from './middleware/global.middleware';

const app: Express = express();

// Apply Global Middlewares
setupGlobalMiddleware(app);

app.use('/api', routes);

// Global Error Handler (Must be the last middleware)
app.use(globalErrorHandler);

export default app;
