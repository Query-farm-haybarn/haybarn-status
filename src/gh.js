const GH_API = 'https://api.github.com';
const UA = 'haybarn-status/1.0';
const TOKEN_KV_KEY = 'gh:installation_token';
const TOKEN_TTL_SECONDS = 50 * 60;

function b64urlEncode(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function pemToDer(pem) {
  const body = pem
    .replace(/-----BEGIN [^-]+-----/, '')
    .replace(/-----END [^-]+-----/, '')
    .replace(/\s+/g, '');
  const bin = atob(body);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function signAppJwt(appId, privateKeyPem) {
  const der = pemToDer(privateKeyPem);
  const key = await crypto.subtle.importKey(
    'pkcs8',
    der,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const now = Math.floor(Date.now() / 1000);
  const header = b64urlEncode(new TextEncoder().encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const payload = b64urlEncode(new TextEncoder().encode(JSON.stringify({
    iat: now - 30,
    exp: now + 9 * 60,
    iss: String(appId),
  })));
  const data = new TextEncoder().encode(`${header}.${payload}`);
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, data));
  return `${header}.${payload}.${b64urlEncode(sig)}`;
}

async function mintInstallationToken(env) {
  const jwt = await signAppJwt(env.GH_APP_ID, env.GH_APP_PRIVATE_KEY);
  const r = await fetch(`${GH_API}/app/installations/${env.GH_APP_INSTALLATION_ID}/access_tokens`, {
    method: 'POST',
    headers: {
      'authorization': `Bearer ${jwt}`,
      'accept': 'application/vnd.github+json',
      'user-agent': UA,
    },
  });
  if (!r.ok) {
    const body = await r.text();
    throw new Error(`installation token mint failed: ${r.status} ${body.slice(0, 200)}`);
  }
  return r.json();
}

export async function getInstallationToken(env) {
  const cached = await env.STATUS_KV.get(TOKEN_KV_KEY, { type: 'json' });
  if (cached && cached.expiresAtMs > Date.now() + 60_000) return cached.token;
  const minted = await mintInstallationToken(env);
  const expiresAtMs = new Date(minted.expires_at).getTime();
  await env.STATUS_KV.put(
    TOKEN_KV_KEY,
    JSON.stringify({ token: minted.token, expiresAtMs }),
    { expirationTtl: TOKEN_TTL_SECONDS },
  );
  return minted.token;
}

export async function ghFetch(env, path, init = {}) {
  const token = await getInstallationToken(env);
  const headers = {
    'authorization': `Bearer ${token}`,
    'accept': 'application/vnd.github+json',
    'user-agent': UA,
    'x-github-api-version': '2022-11-28',
    ...(init.headers || {}),
  };
  const url = path.startsWith('http') ? path : `${GH_API}${path}`;
  const r = await fetch(url, { ...init, headers });
  if (!r.ok) {
    const body = await r.text();
    throw new Error(`GH ${r.status} ${path}: ${body.slice(0, 200)}`);
  }
  return r.json();
}
