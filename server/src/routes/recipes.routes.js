import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { searchRecipes, getRecipeDetail } from '../services/recipeMatching.service.js';

export const recipesRouter = Router();
recipesRouter.use(requireAuth);

recipesRouter.get(
  '/search',
  asyncHandler(async (req, res) => {
    const number = req.query.number ? Number(req.query.number) : 10;
    const candidates = await searchRecipes(req.userId, number);
    res.json({ candidates });
  }),
);

recipesRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const detail = await getRecipeDetail(req.userId, Number(req.params.id));
    res.json(detail);
  }),
);
