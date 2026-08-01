import { Router } from 'express';
import { createUser, authenticateUser, getUserById } from '../services/users.service.js';
import { signToken } from '../utils/jwt.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const authRouter = Router();

authRouter.post(
  '/register',
  asyncHandler(async (req, res) => {
    const { email, password } = req.body ?? {};
    const user = await createUser(email, password);
    const token = signToken({ sub: user.id });
    res.status(201).json({ token, user });
  }),
);

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = req.body ?? {};
    const user = await authenticateUser(email, password);
    const token = signToken({ sub: user.id });
    res.json({ token, user });
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = getUserById(req.userId);
    res.json(user);
  }),
);
