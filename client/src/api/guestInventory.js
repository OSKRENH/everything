const STORAGE_KEY = 'kutno_guest_inventory';

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ingredients: [], equipment: [] };
    const parsed = JSON.parse(raw);
    return {
      ingredients: Array.isArray(parsed.ingredients) ? parsed.ingredients : [],
      equipment: Array.isArray(parsed.equipment) ? parsed.equipment : [],
    };
  } catch {
    return { ingredients: [], equipment: [] };
  }
}

function save(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function listKey(type) {
  return type === 'ingredient' ? 'ingredients' : 'equipment';
}

export async function listInventory() {
  return load();
}

export async function addItem(type, name) {
  const trimmed = typeof name === 'string' ? name.trim() : '';
  if (!trimmed) {
    const err = new Error('Введите название.');
    err.code = 'VALIDATION_ERROR';
    throw err;
  }
  const data = load();
  const list = data[listKey(type)];
  if (list.some((item) => item.name.toLowerCase() === trimmed.toLowerCase())) {
    const err = new Error('Такой элемент уже есть в списке.');
    err.code = 'DUPLICATE_ITEM';
    throw err;
  }
  const item = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type,
    name: trimmed,
    createdAt: new Date().toISOString(),
  };
  list.push(item);
  save(data);
  return item;
}

export async function deleteItem(id) {
  const data = load();
  data.ingredients = data.ingredients.filter((item) => item.id !== id);
  data.equipment = data.equipment.filter((item) => item.id !== id);
  save(data);
}

export function hasGuestData() {
  const data = load();
  return data.ingredients.length > 0 || data.equipment.length > 0;
}

export function clearGuestData() {
  localStorage.removeItem(STORAGE_KEY);
}
