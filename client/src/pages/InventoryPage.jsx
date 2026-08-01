import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as inventoryStore from '../api/inventoryStore.js';
import InventoryList from '../components/InventoryList.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function InventoryPage() {
  const { user } = useAuth();
  const [inventory, setInventory] = useState({ ingredients: [], equipment: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    inventoryStore
      .listInventory()
      .then(setInventory)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [user]);

  async function handleAdd(type, name) {
    const item = await inventoryStore.addItem(type, name);
    setInventory((prev) => ({
      ...prev,
      [type === 'ingredient' ? 'ingredients' : 'equipment']: [
        ...prev[type === 'ingredient' ? 'ingredients' : 'equipment'],
        item,
      ],
    }));
  }

  async function handleDelete(type, id) {
    await inventoryStore.deleteItem(id);
    setInventory((prev) => ({
      ...prev,
      [type]: prev[type].filter((item) => item.id !== id),
    }));
  }

  if (loading) return <p className="status-message">Загрузка…</p>;

  return (
    <div>
      <h1>Мой инвентарь</h1>
      {error && <p className="error-message">{error}</p>}
      {!user && (
        <div className="hint-banner">
          Вы не авторизованы — продукты сохраняются только в этом браузере.{' '}
          <Link to="/register">Зарегистрируйтесь</Link>, чтобы сохранить их в аккаунте и открывать с
          других устройств.
        </div>
      )}
      <div className="hint-banner">
        Для лучших результатов поиска рецептов вводите названия продуктов и техники на английском,
        например: tomato, onion, chicken, oven, blender.
      </div>
      <div className="inventory-columns">
        <InventoryList
          title="Продукты"
          placeholder="Например: tomato"
          items={inventory.ingredients}
          onAdd={(name) => handleAdd('ingredient', name)}
          onDelete={(id) => handleDelete('ingredients', id)}
        />
        <InventoryList
          title="Кухонная техника"
          placeholder="Например: oven"
          items={inventory.equipment}
          onAdd={(name) => handleAdd('equipment', name)}
          onDelete={(id) => handleDelete('equipment', id)}
        />
      </div>
    </div>
  );
}
