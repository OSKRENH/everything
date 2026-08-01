import { apiFetch } from './client.js';

export const searchRecipes = () => apiFetch('/recipes/search');

export const getRecipe = (id) => apiFetch(`/recipes/${id}`);
