import { Router } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { sendRegistrationAlert } from '../utils/mailer.js';

const router = Router();

function signToken(id) {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email and password are required.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const exists = await User.findOne({ $or: [{ email }, { username }] });
    if (exists) {
      const field = exists.email === email.toLowerCase() ? 'Email' : 'Username';
      return res.status(409).json({ error: `${field} is already registered.` });
    }

    const user = await User.create({ username, email, password });

    // Fire-and-forget admin alert
    sendRegistrationAlert(user);

    res.status(201).json({
      token: signToken(user._id),
      user: { id: user._id, username: user.username, email: user.email, evaluationsUsed: 0 },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    res.json({
      token: signToken(user._id),
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        evaluationsUsed: user.evaluationsUsed,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// GET /api/auth/me  — verify token + return current user
router.get('/me', async (req, res) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'No token.' });
  try {
    const { id } = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    const user = await User.findById(id).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found.' });
    res.json({ id: user._id, username: user.username, email: user.email, evaluationsUsed: user.evaluationsUsed });
  } catch {
    res.status(401).json({ error: 'Invalid token.' });
  }
});

export default router;
