import { useEffect, useState } from 'react';
import * as inventoryStore from '../api/inventoryStore.js';
import * as recipesApi from '../api/recipes.api.js';
import RecipeCard from '../components/RecipeCard.jsx';

export default function RecipesPage() {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  function load() {
    setLoading(true);
    setError(null);
    inventoryStore
      .listInventory()
      .then((inventory) => recipesApi.searchRecipes(inventory.ingredients.map((i) => i.name)))
      .then((data) => setCandidates(data.candidates))
      .catch((err) => setError(err))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  return (
    <div>
      <div className="recipes-header">
        <h1>Рецепты для вас</h1>
        <button type="button" onClick={load} disabled={loading}>
          Обновить
        </button>
      </div>

      {loading && <p className="status-message">Ищем рецепты…</p>}

      {!loading && error && error.code === 'SPOONACULAR_KEY_MISSING' && (
        <div className="banner banner-warning">
          Поиск рецептов пока недоступен: администратор ещё не настроил API-ключ сервиса рецептов.
        </div>
      )}

      {!loading && error && error.code === 'NO_INGREDIENTS' && (
        <div className="banner banner-warning">
          Добавьте продукты в раздел «Инвентарь», чтобы получить подборку рецептов.
        </div>
      )}

      {!loading && error && !['SPOONACULAR_KEY_MISSING', 'NO_INGREDIENTS'].includes(error.code) && (
        <div className="banner banner-error">{error.message}</div>
      )}

      {!loading && !error && candidates.length === 0 && (
        <p className="status-message">Рецепты не найдены. Попробуйте добавить больше продуктов.</p>
      )}

      {!loading && !error && candidates.length > 0 && (
        <div className="recipe-grid">
          {candidates.map((recipe) => (
            <RecipeCard key={recipe.id} recipe={recipe} />
          ))}
        </div>
      )}
    </div>
  );
}
