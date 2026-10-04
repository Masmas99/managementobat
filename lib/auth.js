import { can } from './permissions';

export const SESSION_COOKIE = 'medistock_session';
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

const encoder = new TextEncoder();

function secret() {
  return process.env.AUTH_SECRET || 'medistock-local-dev-secret';
}

function toBase64Url(bytes) {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function hmacKey() {
  return crypto.subtle.importKey('raw', encoder.encode(secret()), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export async function signSession(payload) {
  const body = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign('HMAC', await hmacKey(), encoder.encode(body));
  return `${body}.${toBase64Url(new Uint8Array(signature))}`;
}

export async function verifySession(token) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [body, signature] = token.split('.');
  if (!body || !signature) return null;
  try {
    const key = await hmacKey();
    const valid = await crypto.subtle.verify('HMAC', key, fromBase64Url(signature), encoder.encode(body));
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(body)));
    if (payload.exp && payload.exp < Date.now() / 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

export function readSessionToken(request) {
  const cookieHeader = request?.headers?.get?.('cookie') || '';
  for (const pair of cookieHeader.split(';')) {
    const [name, ...value] = pair.trim().split('=');
    if (name === SESSION_COOKIE) return decodeURIComponent(value.join('='));
  }
  return null;
}

export async function getSession(request) {
  return verifySession(readSessionToken(request));
}

export function sessionCookie(token) {
  return `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_SECONDS}`;
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
}

export async function requireSession(request) {
  const session = await getSession(request);
  if (!session) return { session: null, error: Response.json({ error: 'Anda belum login.' }, { status: 401 }) };
  return { session, error: null };
}

export async function requirePermission(request, action) {
  const { session, error } = await requireSession(request);
  if (error) return { session: null, error };
  if (!can(session.role, action)) {
    return {
      session,
      error: Response.json({ error: `Role "${session.role}" tidak memiliki akses untuk tindakan ini.` }, { status: 403 }),
    };
  }
  return { session, error: null };
}
