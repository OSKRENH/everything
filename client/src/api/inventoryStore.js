import { getToken } from './client.js';
import * as backendInventory from './inventory.api.js';
import * as guestInventory from './guestInventory.js';

const isLoggedIn = () => Boolean(getToken());

export const listInventory = () =>
  isLoggedIn() ? backendInventory.listInventory() : guestInventory.listInventory();

export const addItem = (type, name) =>
  isLoggedIn() ? backendInventory.addItem(type, name) : guestInventory.addItem(type, name);

export const deleteItem = (id) =>
  isLoggedIn() ? backendInventory.deleteItem(id) : guestInventory.deleteItem(id);
