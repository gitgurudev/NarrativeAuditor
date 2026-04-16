import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.js';
import User from '../models/User.js';
import { sendUploadAlert } from '../utils/mailer.js';

const router = Router();
const MAX_EVAL = 2;

// multer: store PDF in memory (we only need it to email as attachment)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: (_, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Only PDF files are allowed.'));
  },
});

/**
 * POST /api/evaluate/start
 * - Requires auth JWT
 * - Accepts the PDF as multipart/form-data (field: "pdf")
 * - Checks user hasn't exceeded 2-evaluation limit
 * - Increments counter
 * - Sends email alert to admin with PDF attached
 */
router.post('/start', requireAuth, upload.single('pdf'), async (req, res) => {
  try {
    const user = req.user;

    if (user.evaluationsUsed >= MAX_EVAL) {
      return res.status(403).json({
        error: `Evaluation limit reached. Each account is allowed ${MAX_EVAL} evaluations. Contact us for more access.`,
        limitReached: true,
      });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'PDF file is required.' });
    }

    // Increment counter
    await User.findByIdAndUpdate(user._id, { $inc: { evaluationsUsed: 1 } });

    // Fire-and-forget email to admin
    sendUploadAlert(
      { username: user.username, email: user.email, evaluationsUsed: user.evaluationsUsed + 1 },
      req.file
    );

    res.json({
      ok: true,
      evaluationsUsed: user.evaluationsUsed + 1,
      remaining: MAX_EVAL - (user.evaluationsUsed + 1),
    });
  } catch (err) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'File too large. Maximum 50 MB.' });
    }
    console.error(err);
    res.status(500).json({ error: 'Could not start evaluation.' });
  }
});

export default router;
