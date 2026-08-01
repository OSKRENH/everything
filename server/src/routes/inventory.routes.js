import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { listInventory, addInventoryItem, deleteInventoryItem } from '../services/inventory.service.js';

export const inventoryRouter = Router();
inventoryRouter.use(requireAuth);

inventoryRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(listInventory(req.userId));
  }),
);

inventoryRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const { type, name } = req.body ?? {};
    const item = addInventoryItem(req.userId, type, name);
    res.status(201).json(item);
  }),
);

inventoryRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    deleteInventoryItem(req.userId, Number(req.params.id));
    res.status(204).end();
  }),
);
