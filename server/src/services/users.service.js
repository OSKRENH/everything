import { db } from '../db/index.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import { ApiError } from '../utils/ApiError.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateCredentials(email, password) {
  if (typeof email !== 'string' || !EMAIL_RE.test(email)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Введите корректный email.');
  }
  if (typeof password !== 'string' || password.length < 6) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Пароль должен содержать не менее 6 символов.');
  }
}

export async function createUser(email, password) {
  validateCredentials(email, password);
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    throw new ApiError(409, 'EMAIL_TAKEN', 'Этот email уже зарегистрирован.');
  }
  const passwordHash = await hashPassword(password);
  const result = db
    .prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)')
    .run(email, passwordHash);
  return { id: result.lastInsertRowid, email };
}

export async function authenticateUser(email, password) {
  const row = db.prepare('SELECT id, email, password_hash FROM users WHERE email = ?').get(email);
  if (!row) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Неверный email или пароль.');
  }
  const ok = await comparePassword(password, row.password_hash);
  if (!ok) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Неверный email или пароль.');
  }
  return { id: row.id, email: row.email };
}

export function getUserById(id) {
  const row = db.prepare('SELECT id, email FROM users WHERE id = ?').get(id);
  if (!row) {
    throw new ApiError(404, 'NOT_FOUND', 'Пользователь не найден.');
  }
  return row;
}
