import { apiFetch } from './client.js';

export const register = (email, password) =>
  apiFetch('/auth/register', { method: 'POST', body: { email, password } });

export const login = (email, password) =>
  apiFetch('/auth/login', { method: 'POST', body: { email, password } });

export const me = () => apiFetch('/auth/me');

export const googleLogin = (credential) =>
  apiFetch('/auth/google', { method: 'POST', body: { credential } });
