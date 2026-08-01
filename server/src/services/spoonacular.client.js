import { config } from '../config.js';
import { ApiError } from '../utils/ApiError.js';

const BASE_URL = 'https://api.spoonacular.com';

export class SpoonacularKeyMissingError extends ApiError {
  constructor() {
    super(503, 'SPOONACULAR_KEY_MISSING', 'Поиск рецептов временно недоступен: не настроен API-ключ.');
  }
}

function ensureKey() {
  if (!config.hasSpoonacularKey) {
    throw new SpoonacularKeyMissingError();
  }
}

async function request(pathname, params) {
  ensureKey();
  const url = new URL(BASE_URL + pathname);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }
  url.searchParams.set('apiKey', config.spoonacularApiKey);

  let response;
  try {
    response = await fetch(url);
  } catch {
    throw new ApiError(502, 'SPOONACULAR_UPSTREAM_ERROR', 'Не удалось связаться с сервисом рецептов.');
  }

  if (!response.ok) {
    throw new ApiError(502, 'SPOONACULAR_UPSTREAM_ERROR', 'Сервис рецептов вернул ошибку. Попробуйте позже.');
  }

  return response.json();
}

export function findByIngredients(ingredients, number = 10) {
  return request('/recipes/findByIngredients', {
    ingredients: ingredients.join(','),
    number,
    ranking: 2,
    ignorePantry: true,
  });
}

export function getRecipeInformation(recipeId) {
  return request(`/recipes/${recipeId}/information`, {
    includeNutrition: false,
  });
}
