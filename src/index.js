import { buildRcView, buildSidePanel, listEngineTags } from './collect.js';
import { renderIndex, renderRcPage, renderError } from './render.js';
import { DISCLAIMER, TAG_PREFIX } from './repos.js';

const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#161b22"/><text x="16" y="22" font-family="ui-monospace,Menlo,monospace" font-size="18" font-weight="700" fill="#58a6ff" text-anchor="middle">h</text></svg>`;

async function getCached(env, ctx, key, freshSec, staleSec, fetcher) {
  const now = Date.now();
  const cached = await env.STATUS_KV.get(key, { type: 'json' });
  if (cached && cached.fetchedAtMs && cached.data) {
    const age = (now - cached.fetchedAtMs) / 1000;
    if (age < freshSec) return cached.data;
    if (age < staleSec) {
      ctx.waitUntil(refreshCache(env, key, staleSec, fetcher));
      return cached.data;
    }
  }
  return refreshCache(env, key, staleSec, fetcher);
}

async function refreshCache(env, key, staleSec, fetcher) {
  const data = await fetcher();
  const payload = JSON.stringify({ fetchedAtMs: Date.now(), data });
  await env.STATUS_KV.put(key, payload, { expirationTtl: Math.max(60, staleSec) });
  return data;
}

function json(data, init = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status: init.status || 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=15',
      ...(init.headers || {}),
    },
  });
}

function html(body, init = {}) {
  return new Response(body, {
    status: init.status || 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=15',
      ...(init.headers || {}),
    },
  });
}

function isValidTag(tag) {
  return /^[A-Za-z0-9._+-]{1,128}$/.test(tag) && tag.startsWith(TAG_PREFIX);
}

async function handleRcPage(env, ctx, tag, asJson) {
  if (!isValidTag(tag)) {
    return asJson
      ? json({ error: 'invalid tag', _disclaimer: DISCLAIMER }, { status: 400 })
      : html(renderError(`invalid tag: ${tag}`, 400).body, { status: 400 });
  }
  const [view, side] = await Promise.all([
    getCached(env, ctx, `rc:${tag}`, 30, 300, () => buildRcView(env, tag)),
    getCached(env, ctx, 'side', 60, 300, () => buildSidePanel(env)),
  ]);
  const merged = { ...view, sidePanel: side };
  return asJson ? json(merged) : html(renderRcPage(merged));
}

async function handleIndex(env, ctx) {
  const tags = await getCached(env, ctx, 'tags', 300, 1800, () => listEngineTags(env));
  return html(renderIndex(tags));
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname } = url;

    try {
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        return new Response('method not allowed', { status: 405 });
      }
      if (pathname === '/healthz') return new Response('ok', { headers: { 'content-type': 'text/plain' } });
      if (pathname === '/favicon.ico') {
        return new Response(FAVICON_SVG, {
          headers: { 'content-type': 'image/svg+xml', 'cache-control': 'public, max-age=86400' },
        });
      }
      if (pathname === '/') return handleIndex(env, ctx);

      const rcMatch = pathname.match(/^\/r\/([^/]+)\/?$/);
      if (rcMatch) return handleRcPage(env, ctx, decodeURIComponent(rcMatch[1]), false);

      const apiMatch = pathname.match(/^\/api\/r\/([^/]+)\/?$/);
      if (apiMatch) return handleRcPage(env, ctx, decodeURIComponent(apiMatch[1]), true);

      return new Response('not found', { status: 404 });
    } catch (e) {
      const msg = String(e?.message || e);
      const wantsJson = pathname.startsWith('/api/');
      if (wantsJson) return json({ error: msg, _disclaimer: DISCLAIMER }, { status: 500 });
      const { body, status } = renderError(msg, 500);
      return html(body, { status });
    }
  },
};
