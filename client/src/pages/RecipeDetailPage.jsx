import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import * as inventoryStore from '../api/inventoryStore.js';
import * as recipesApi from '../api/recipes.api.js';
import MissingEquipmentBanner from '../components/MissingEquipmentBanner.jsx';

export default function RecipeDetailPage() {
  const { id } = useParams();
  const [recipe, setRecipe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    inventoryStore
      .listInventory()
      .then((inventory) => recipesApi.getRecipe(id, inventory.equipment.map((e) => e.name)))
      .then(setRecipe)
      .catch((err) => setError(err))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <div>
      <Link to="/recipes" className="back-link">
        ← Назад к рецептам
      </Link>

      {loading && <p className="status-message">Загрузка рецепта…</p>}

      {!loading && error && error.code === 'SPOONACULAR_KEY_MISSING' && (
        <div className="banner banner-warning">
          Рецепт пока недоступен: администратор ещё не настроил API-ключ сервиса рецептов.
        </div>
      )}

      {!loading && error && !['SPOONACULAR_KEY_MISSING'].includes(error.code) && (
        <div className="banner banner-error">{error.message}</div>
      )}

      {!loading && !error && recipe && (
        <div>
          <h1>{recipe.title}</h1>
          {recipe.image && <img src={recipe.image} alt={recipe.title} style={{ maxWidth: '100%', borderRadius: 8 }} />}
          <p>
            {recipe.servings && <>Порций: {recipe.servings}. </>}
            {recipe.readyInMinutes && <>Время приготовления: {recipe.readyInMinutes} мин.</>}
          </p>

          <MissingEquipmentBanner missingEquipment={recipe.missingEquipment} />

          {recipe.steps.length === 0 ? (
            <p className="status-message">
              Пошаговые инструкции для этого рецепта недоступны.
            </p>
          ) : (
            <ol className="recipe-steps">
              {recipe.steps.map((step) => (
                <li key={step.number} className="recipe-step">
                  <span className="recipe-step-number">{step.number}.</span>
                  {step.step}
                  {step.equipment.some((eq) => eq.missing) && (
                    <div className="banner banner-warning" style={{ marginTop: '0.5rem' }}>
                      Нужна техника, которой нет в вашем инвентаре:{' '}
                      {step.equipment
                        .filter((eq) => eq.missing)
                        .map((eq) => eq.name)
                        .join(', ')}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
