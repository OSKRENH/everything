import { Link } from 'react-router-dom';

export default function RecipeCard({ recipe }) {
  return (
    <Link to={`/recipes/${recipe.id}`} className="recipe-card">
      {recipe.image && <img src={recipe.image} alt={recipe.title} />}
      <div className="recipe-card-body">
        <span className="match-badge">{recipe.matchPercent}% совпадение</span>
        <h3>{recipe.title}</h3>
        <p>
          Есть {recipe.usedIngredientCount} из{' '}
          {recipe.usedIngredientCount + recipe.missedIngredientCount} ингредиентов
        </p>
        {recipe.missedIngredients.length > 0 && (
          <div>
            {recipe.missedIngredients.map((ing) => (
              <span key={ing.id} className="missing-chip">
                {ing.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
