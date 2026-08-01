import { ApiError } from './apiError.js';
import { hashPassword, comparePassword } from './password.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateCredentials(email, password) {
  if (typeof email !== 'string' || !EMAIL_RE.test(email)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Введите корректный email.');
  }
  if (typeof password !== 'string' || password.length < 6) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Пароль должен содержать не менее 6 символов.');
  }
}

export async function createUser(db, email, password) {
  validateCredentials(email, password);
  const existing = await db.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  if (existing) {
    throw new ApiError(409, 'EMAIL_TAKEN', 'Этот email уже зарегистрирован.');
  }
  const passwordHash = await hashPassword(password);
  const result = await db
    .prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)')
    .bind(email, passwordHash)
    .run();
  return { id: result.meta.last_row_id, email };
}

export async function authenticateUser(db, email, password) {
  const row = await db
    .prepare('SELECT id, email, password_hash FROM users WHERE email = ?')
    .bind(email)
    .first();
  if (!row) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Неверный email или пароль.');
  }
  const ok = await comparePassword(password, row.password_hash);
  if (!ok) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Неверный email или пароль.');
  }
  return { id: row.id, email: row.email };
}

export async function findOrCreateGoogleUser(db, email) {
  const existing = await db.prepare('SELECT id, email FROM users WHERE email = ?').bind(email).first();
  if (existing) {
    return existing;
  }
  const result = await db
    .prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)')
    .bind(email, 'google-oauth')
    .run();
  return { id: result.meta.last_row_id, email };
}

export async function getUserById(db, id) {
  const row = await db.prepare('SELECT id, email FROM users WHERE id = ?').bind(id).first();
  if (!row) {
    throw new ApiError(404, 'NOT_FOUND', 'Пользователь не найден.');
  }
  return row;
}
