import { apiFetch } from './client.js';

export const searchRecipes = (ingredients) =>
  apiFetch('/recipes/search', { method: 'POST', body: { ingredients } });

export const getRecipe = (id, equipment) =>
  apiFetch(`/recipes/${id}`, { method: 'POST', body: { equipment } });
