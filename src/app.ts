import express, { Express } from 'express';
import cors from 'cors';
import routes from './routes';
import { env } from './env';

const app: Express = express();

// CORS configuration: Allow requests from frontend only, and allow cookies
app.use(
    cors({
        origin: env.FRONTEND_URL,
        credentials: true
    })
);
app.use(express.json());

app.use('/api', routes);

export default app;
