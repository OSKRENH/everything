import { apiFetch } from './client.js';

export const listInventory = () => apiFetch('/inventory');

export const addItem = (type, name) =>
  apiFetch('/inventory', { method: 'POST', body: { type, name } });

export const deleteItem = (id) => apiFetch(`/inventory/${id}`, { method: 'DELETE' });
