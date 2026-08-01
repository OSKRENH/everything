import { apiFetch } from './client.js';

export const getConfig = () => apiFetch('/config');
