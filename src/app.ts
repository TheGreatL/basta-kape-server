import express, { Express } from 'express';
import path from 'path';
import routes from './routes';
import { setupGlobalMiddleware, globalErrorHandler } from './middleware/global.middleware';

const app: Express = express();

// Apply Global Middlewares
setupGlobalMiddleware(app);

// Serve uploads folder statically
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

app.use('/api', routes);

// Global Error Handler (Must be the last middleware)
app.use(globalErrorHandler);

export default app;
