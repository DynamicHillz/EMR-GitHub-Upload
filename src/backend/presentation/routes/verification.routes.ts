import { Router } from 'express';
import { verifyDocument } from '../controllers/verification.controller';
import rateLimit from 'express-rate-limit';

const router = Router();

// Rate limiting to prevent brute forcing the PIN
const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 requests per windowMs
  message: {
    success: false,
    message: 'Too many verification attempts, please try again after 15 minutes',
  },
});

router.post('/verify', verifyLimiter, verifyDocument);

export default router;
