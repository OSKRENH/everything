import { ApiError } from './apiError.js';

const TYPES = new Set(['ingredient', 'equipment']);

export async function listInventory(db, userId) {
  const { results } = await db
    .prepare('SELECT id, type, name, created_at as createdAt FROM inventory_items WHERE user_id = ? ORDER BY created_at ASC')
    .bind(userId)
    .all();
  return {
    ingredients: results.filter((r) => r.type === 'ingredient'),
    equipment: results.filter((r) => r.type === 'equipment'),
  };
}

export async function addInventoryItem(db, userId, type, name) {
  if (!TYPES.has(type)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Тип должен быть "ingredient" или "equipment".');
  }
  const trimmed = typeof name === 'string' ? name.trim() : '';
  if (!trimmed) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Введите название.');
  }
  try {
    const result = await db
      .prepare('INSERT INTO inventory_items (user_id, type, name) VALUES (?, ?, ?)')
      .bind(userId, type, trimmed)
      .run();
    return db
      .prepare('SELECT id, type, name, created_at as createdAt FROM inventory_items WHERE id = ?')
      .bind(result.meta.last_row_id)
      .first();
  } catch (err) {
    if (String(err.message).includes('UNIQUE constraint failed')) {
      throw new ApiError(409, 'DUPLICATE_ITEM', 'Такой элемент уже есть в списке.');
    }
    throw err;
  }
}

export async function deleteInventoryItem(db, userId, id) {
  const result = await db
    .prepare('DELETE FROM inventory_items WHERE id = ? AND user_id = ?')
    .bind(id, userId)
    .run();
  if (result.meta.changes === 0) {
    throw new ApiError(404, 'NOT_FOUND', 'Элемент не найден.');
  }
}

export async function listIngredientNames(db, userId) {
  const { results } = await db
    .prepare("SELECT name FROM inventory_items WHERE user_id = ? AND type = 'ingredient'")
    .bind(userId)
    .all();
  return results.map((r) => r.name);
}

export async function listEquipmentNames(db, userId) {
  const { results } = await db
    .prepare("SELECT name FROM inventory_items WHERE user_id = ? AND type = 'equipment'")
    .bind(userId)
    .all();
  return results.map((r) => r.name);
}
