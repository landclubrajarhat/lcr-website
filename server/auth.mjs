import { createRemoteJWKSet, jwtVerify } from 'jose';

const keys = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
export async function verifyGoogle(credential, clientId, nonce) {
  return verifyWithKeys(credential, clientId, nonce, keys);
}
// The key resolver is injectable for offline cryptographic tests, never from HTTP input.
export async function verifyWithKeys(credential, clientId, nonce, resolver) {
  const { payload } = await jwtVerify(credential, resolver, {
    audience: clientId,
    issuer: ['accounts.google.com', 'https://accounts.google.com'],
    algorithms: ['RS256'],
    maxTokenAge: '10 minutes',
    requiredClaims: ['sub', 'iat', 'exp', 'email', 'email_verified', 'nonce'],
  });
  if (payload.nonce !== nonce || payload.email_verified !== true ||
      typeof payload.sub !== 'string' || !payload.sub || typeof payload.email !== 'string') {
    throw new Error('Invalid Google identity');
  }
  return payload;
}

export const randomToken = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('');
export async function digest(value) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), b => b.toString(16).padStart(2, '0')).join('');
}
export function cookie(request, name) {
  return (request.headers.get('cookie') || '').split(';').map(s => s.trim()).find(s => s.startsWith(name + '='))?.slice(name.length + 1) || '';
}
export const setCookie = (name, value, age) => `${name}=${value}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${age}`;
