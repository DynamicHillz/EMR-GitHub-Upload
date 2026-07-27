/**
 * File Upload Middleware
 *
 * Multer disk-storage config for clinic logo uploads — replaces the
 * URL-paste-only flow branding.controller.ts previously had a TODO for.
 */

import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { Request } from 'express';

const LOGOS_DIR = path.join(__dirname, '../../../../uploads/logos');

if (!fs.existsSync(LOGOS_DIR)) {
  fs.mkdirSync(LOGOS_DIR, { recursive: true });
}

const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, LOGOS_DIR),
  filename: (req, file, cb) => {
    // Random filename (not the original) — avoids path traversal /
    // collisions from the client-supplied name, and avoids leaking the
    // tenant's id in a predictable/guessable URL.
    const tenantId = req.user?.tenantId || 'unknown';
    const ext = path.extname(file.originalname).toLowerCase();
    const random = crypto.randomBytes(8).toString('hex');
    cb(null, `${tenantId}-${Date.now()}-${random}${ext}`);
  },
});

export const uploadLogoMiddleware = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (_req: Request, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return cb(new Error('Only PNG, JPEG, WEBP, or SVG images are allowed'));
    }
    cb(null, true);
  },
}).single('logo');
