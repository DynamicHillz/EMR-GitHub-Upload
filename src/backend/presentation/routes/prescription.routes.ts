import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

router.get('/', asyncHandler(async (_req: Request, res: Response) => {
  res.json({ message: 'List prescriptions - To be implemented' });
}));

router.post('/', asyncHandler(async (_req: Request, res: Response) => {
  res.json({ message: 'Create prescription - To be implemented' });
}));

export default router;
