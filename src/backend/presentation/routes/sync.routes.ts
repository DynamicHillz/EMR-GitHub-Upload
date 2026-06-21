import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

router.post('/push', asyncHandler(async (_req: Request, res: Response) => {
  res.json({ message: 'Push sync data - To be implemented' });
}));

router.get('/pull', asyncHandler(async (_req: Request, res: Response) => {
  res.json({ message: 'Pull sync data - To be implemented' });
}));

export default router;
