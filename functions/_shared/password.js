const ITERATIONS = 100_000;
const HASH = 'SHA-256';
const KEY_LENGTH_BITS = 256;

function toBase64(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

function fromBase64(base64) {
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

async function deriveBits(password, salt, iterations) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  return crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: HASH },
    keyMaterial,
    KEY_LENGTH_BITS,
  );
}

export async function hashPassword(plain) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const bits = await deriveBits(plain, salt, ITERATIONS);
  return `pbkdf2$${ITERATIONS}$${toBase64(salt)}$${toBase64(bits)}`;
}

export async function comparePassword(plain, stored) {
  const [scheme, iterationsStr, saltB64, hashB64] = stored.split('$');
  if (scheme !== 'pbkdf2') return false;
  const iterations = Number(iterationsStr);
  const salt = fromBase64(saltB64);
  const bits = await deriveBits(plain, salt, iterations);
  const computed = toBase64(bits);
  if (computed.length !== hashB64.length) return false;
  let mismatch = 0;
  for (let i = 0; i < computed.length; i++) {
    mismatch |= computed.charCodeAt(i) ^ hashB64.charCodeAt(i);
  }
  return mismatch === 0;
}
