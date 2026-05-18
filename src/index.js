import {
  buildRcView, buildForks, buildCommunityMatrix, listEngineTags,
  buildRegistryPresence,
} from './collect.js';
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
  const [view, forks, community] = await Promise.all([
    getCached(env, ctx, `rc:${tag}`, 30, 300, () => buildRcView(env, tag)),
    getCached(env, ctx, 'forks', 60, 300, () => buildForks(env)),
    // Community matrix is the expensive one (paginated build_all job
    // list, 20+ GH API calls per cold fetch). Aggressive stale window
    // keeps users on cache forever after first load — background
    // refreshes via ctx.waitUntil populate the new data invisibly.
    // A scheduled() handler below also pre-warms on a cron.
    getCached(env, ctx, 'community', 60, 86400, () => buildCommunityMatrix(env)),
  ]);

  // Registry-presence is the second-most-expensive (240+ HTTPS GETs to
  // npm + PyPI). Cache aggressively + only refresh on the cron, never
  // synchronously on a page load. If the cache is empty, we just don't
  // show registry pills until the first cron tick. Page renders fine
  // without them.
  let registryPresence = null;
  try {
    const cached = await env.STATUS_KV.get('registry-presence', { type: 'json' });
    if (cached && cached.data) registryPresence = cached.data;
  } catch (_) {}
  if (registryPresence) {
    // Fold into the community matrix so the renderer can decorate rows.
    community.registries = registryPresence;
  }

  const merged = { ...view, sidePanel: { forks: forks.forks, community } };
  return asJson ? json(merged) : html(renderRcPage(merged));
}

async function handleIndex(env, ctx) {
  const tags = await getCached(env, ctx, 'tags', 300, 1800, () => listEngineTags(env));
  return html(renderIndex(tags));
}

// Cron handler — refresh the most-expensive caches on a schedule so
// human visits never see a cold miss. Fires per the [triggers] crons
// in wrangler.toml. Errors are non-fatal (logged + swallowed) so a
// transient GH API blip doesn't break the schedule.
async function refreshCacheKey(env, ctx, key, staleSec, fetcher) {
  try {
    const data = await fetcher();
    const payload = JSON.stringify({ fetchedAtMs: Date.now(), data });
    await env.STATUS_KV.put(key, payload, { expirationTtl: Math.max(60, staleSec) });
    console.log(`prewarm ${key}: ok`);
  } catch (e) {
    console.log(`prewarm ${key}: ${e?.message || e}`);
  }
}

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(Promise.all([
      refreshCacheKey(env, ctx, 'community', 86400, () => buildCommunityMatrix(env)),
      refreshCacheKey(env, ctx, 'forks',     300,   () => buildForks(env)),
      refreshCacheKey(env, ctx, 'tags',      1800,  () => listEngineTags(env)),
      // Registry presence is bigger than the others (~480 outbound
      // GETs against npm + PyPI) so we run it after the community
      // matrix is hot — it reads back the extension list from the
      // matrix it just refreshed, avoiding a duplicate GH fetch.
      (async () => {
        try {
          const cm = await env.STATUS_KV.get('community', { type: 'json' });
          const exts = (cm && cm.data && cm.data.extensions) || [];
          const names = exts.map(e => e.name).filter(Boolean);
          if (names.length) {
            await refreshCacheKey(env, ctx, 'registry-presence', 86400,
              () => buildRegistryPresence(env, names));
          } else {
            console.log('prewarm registry-presence: no extensions in matrix');
          }
        } catch (e) {
          console.log('prewarm registry-presence:', e?.message || e);
        }
      })(),
    ]));
  },

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
