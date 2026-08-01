import { db } from '../db/index.js';
import { ApiError } from '../utils/ApiError.js';

const TYPES = new Set(['ingredient', 'equipment']);

export function listInventory(userId) {
  const rows = db
    .prepare('SELECT id, type, name, created_at as createdAt FROM inventory_items WHERE user_id = ? ORDER BY created_at ASC')
    .all(userId);
  return {
    ingredients: rows.filter((r) => r.type === 'ingredient'),
    equipment: rows.filter((r) => r.type === 'equipment'),
  };
}

export function addInventoryItem(userId, type, name) {
  if (!TYPES.has(type)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Тип должен быть "ingredient" или "equipment".');
  }
  const trimmed = typeof name === 'string' ? name.trim() : '';
  if (!trimmed) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Введите название.');
  }
  try {
    const result = db
      .prepare('INSERT INTO inventory_items (user_id, type, name) VALUES (?, ?, ?)')
      .run(userId, type, trimmed);
    return db
      .prepare('SELECT id, type, name, created_at as createdAt FROM inventory_items WHERE id = ?')
      .get(result.lastInsertRowid);
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      throw new ApiError(409, 'DUPLICATE_ITEM', 'Такой элемент уже есть в списке.');
    }
    throw err;
  }
}

export function deleteInventoryItem(userId, id) {
  const result = db
    .prepare('DELETE FROM inventory_items WHERE id = ? AND user_id = ?')
    .run(id, userId);
  if (result.changes === 0) {
    throw new ApiError(404, 'NOT_FOUND', 'Элемент не найден.');
  }
}

export function listIngredientNames(userId) {
  return db
    .prepare("SELECT name FROM inventory_items WHERE user_id = ? AND type = 'ingredient'")
    .all(userId)
    .map((r) => r.name);
}

export function listEquipmentNames(userId) {
  return db
    .prepare("SELECT name FROM inventory_items WHERE user_id = ? AND type = 'equipment'")
    .all(userId)
    .map((r) => r.name);
}
