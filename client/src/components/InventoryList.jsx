import { useState } from 'react';

export default function InventoryList({ title, placeholder, items, onAdd, onDelete }) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await onAdd(name);
      setName('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="inventory-list">
      <h2>{title}</h2>
      <form className="inventory-add-form" onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder={placeholder}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <button type="submit" disabled={submitting}>
          Добавить
        </button>
      </form>
      {error && <p className="error-message">{error}</p>}
      {items.length === 0 ? (
        <p className="status-message">Пока пусто.</p>
      ) : (
        <ul className="inventory-items">
          {items.map((item) => (
            <li key={item.id}>
              <span>{item.name}</span>
              <button type="button" onClick={() => onDelete(item.id)} aria-label="Удалить">
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
