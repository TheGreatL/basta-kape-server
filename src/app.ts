import express, { Express } from 'express';
import cors from 'cors';
import routes from './routes';

const app: Express = express();

// CORS configuration: Allow requests from frontend only, and allow cookies
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
app.use(cors({
  origin: frontendUrl,
  credentials: true
}));
app.use(express.json());

app.use('/', routes);

export default app;
