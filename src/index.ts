import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();

const app: Express = express();
const port = process.env.PORT || 8000;

// CORS configuration: Allow requests from frontend only, and allow cookies
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
app.use(cors({
  origin: frontendUrl,
  credentials: true
}));
app.use(express.json());

app.get('/', (req: Request, res: Response) => {
  res.send('Express + TypeScript Server is running');
});

app.listen(port, () => {
  console.log(`[server]: Server is running at http://localhost:${port}`);
});
