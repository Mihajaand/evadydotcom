export const BUNDLE_ID = Deno.env.get('APP_STORE_BUNDLE_ID') || 'com.mihajamahefa.evady';
export const PRODUCT_TIERS: Record<string, string> = {
  basic: 'basic',
  premium_abo: 'premium',
  evady_vip_monthly: 'vip',
};

const decodeBase64Url = (value: string): Uint8Array => {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
};

export const decodeSignedPayload = <T>(signedPayload: string): T => {
  const payload = signedPayload.split('.')[1];
  if (!payload) throw new Error('Réponse signée App Store invalide.');
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(payload))) as T;
};

const encodeBase64Url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

export const createAppleToken = async (): Promise<string> => {
  const issuerId = Deno.env.get('APP_STORE_ISSUER_ID');
  const keyId = Deno.env.get('APP_STORE_KEY_ID');
  const privateKey = Deno.env.get('APP_STORE_PRIVATE_KEY')?.replace(/\\n/g, '\n');
  if (!issuerId || !keyId || !privateKey) {
    throw new Error('Les identifiants API App Store ne sont pas configurés côté serveur.');
  }

  const pem = privateKey.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, '');
  const signingKey = await crypto.subtle.importKey(
    'pkcs8',
    decodeBase64Url(pem.replace(/\+/g, '-').replace(/\//g, '_')),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
  const now = Math.floor(Date.now() / 1000);
  const header = encodeBase64Url(new TextEncoder().encode(JSON.stringify({ alg: 'ES256', kid: keyId, typ: 'JWT' })));
  const claims = encodeBase64Url(new TextEncoder().encode(JSON.stringify({
    iss: issuerId,
    iat: now,
    exp: now + 300,
    aud: 'appstoreconnect-v1',
    bid: BUNDLE_ID,
  })));
  const message = `${header}.${claims}`;
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    signingKey,
    new TextEncoder().encode(message)
  );
  return `${message}.${encodeBase64Url(new Uint8Array(signature))}`;
};

export const appleRequest = async (path: string, token: string): Promise<Response> => {
  const production = await fetch(`https://api.storekit.apple.com${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (production.status !== 404 && production.status !== 401) return production;
  return fetch(`https://api.storekit-sandbox.apple.com${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
};
