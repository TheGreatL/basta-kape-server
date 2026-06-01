import { Router, Request, Response } from 'express';

const router = Router();

router.get('/health', (req: Request, res: Response) => {
    res.send('Server is healthy');
});

router.get('/', (req: Request, res: Response) => {
    res.send('Express + TypeScript Server is running');
});

export default router;
