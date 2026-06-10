import {
  buildRcView, buildForks, buildCommunityMatrix, listEngineTags,
  buildRegistryPresence, buildR2Presence, buildCoreCatalog,
  buildActivity, buildActionsInsights,
} from './collect.js';
import { renderIndex, renderRcPage, renderError, renderActivityPage, renderInsightsPage } from './render.js';
import { DISCLAIMER, TAG_PREFIX, DEFAULT_VERSION, parseVersionFromTag } from './repos.js';
import { notifyDiscord } from './discord.js';

// Must match the second entry in wrangler.toml [triggers] crons.
const NOTIFY_CRON = '*/2 * * * *';

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
  // The Haybarn (DuckDB) version is encoded in the tag (haybarn-v1.5.3-rc1 →
  // 1.5.3). All version-dependent probes (R2 / npm / PyPI / upstream) and their
  // cache keys are scoped to this version, so 1.5.2 and 1.5.3 rc pages each
  // probe their own artifact paths.
  const version = parseVersionFromTag(tag) || DEFAULT_VERSION;
  const [view, forks, community, core] = await Promise.all([
    // rc/forks/community now read live CI state from the webhook collector
    // (StatusFeed) — cheap DO-RPC reads, no GitHub Actions API. Short fresh
    // windows keep the page within seconds of the webhook stream; the
    // stale-while-revalidate window still shields against a transient feed blip.
    getCached(env, ctx, `rc:${tag}`, 10, 300, () => buildRcView(env, tag)),
    getCached(env, ctx, 'forks', 15, 300, () => buildForks(env)),
    // Community matrix (catalog list + CI runs) is version-independent.
    getCached(env, ctx, 'community', 30, 86400, () => buildCommunityMatrix(env)),
    // Core catalog — small, fast (~26 R2 HEADs + ~52 registry probes). Version-scoped.
    getCached(env, ctx, `core:${version}`, 60, 3600, () => buildCoreCatalog(env, version)),
  ]);

  // Registry + R2 presence — the authoritative "is this extension actually
  // installable today" signal, independent of recent CI activity. We probe
  // npm/PyPI/R2 directly. On cache miss, compute synchronously so the first
  // visit after deploy isn't blocked on a 15-min cron tick.
  const extensionNames = Array.isArray(community.extensions)
    ? community.extensions.map(e => e.name).filter(Boolean)
    : [];

  let registryPresence = null;
  try {
    const cached = await env.STATUS_KV.get(`registry-presence:${version}`, { type: 'json' });
    if (cached && cached.data) registryPresence = cached.data;
  } catch (_) {}
  if (!registryPresence && extensionNames.length) {
    try {
      registryPresence = await buildRegistryPresence(env, extensionNames, version);
      ctx.waitUntil(env.STATUS_KV.put(`registry-presence:${version}`, JSON.stringify({
        fetchedAtMs: Date.now(), data: registryPresence,
      }), { expirationTtl: 86400 }));
    } catch (e) { console.log('registry-presence sync compute failed:', e?.message || e); }
  }

  let r2Presence = null;
  try {
    const cached = await env.STATUS_KV.get(`r2-presence:${version}`, { type: 'json' });
    if (cached && cached.data) r2Presence = cached.data;
  } catch (_) {}
  if (!r2Presence && extensionNames.length) {
    try {
      r2Presence = await buildR2Presence(env, extensionNames, version);
      ctx.waitUntil(env.STATUS_KV.put(`r2-presence:${version}`, JSON.stringify({
        fetchedAtMs: Date.now(), data: r2Presence,
      }), { expirationTtl: 86400 }));
    } catch (e) { console.log('r2-presence sync compute failed:', e?.message || e); }
  }

  if (registryPresence) community.registries = registryPresence;

  if (Array.isArray(community.extensions)) {
    const regMap = (registryPresence && registryPresence.presence) || {};
    const r2Map  = (r2Presence       && r2Presence.presence)       || {};
    community.extensions = community.extensions.map(ext => ({
      ...ext,
      registries: regMap[ext.name] || null,
      r2:         r2Map[ext.name]  || null,
    }));
  }

  // Stamp core extensions with the commit sha that produced what's on R2.
  // - `fork`-layer extensions are rebuilt independently from their build-fork
  //   repos (haybarn-httpfs, haybarn-iceberg, …); their version is the
  //   fork's latest run head_sha.
  // - `in_tree` and `rebuilt`-layer extensions are built by the engine
  //   release pipeline and share the engine repo's head_sha.
  if (core && Array.isArray(core.extensions)) {
    const engineRepo = view?.repos?.find(r => r.label === 'Engine');
    const engineSha  = engineRepo?.runs?.[0]?.headSha || null;
    const forkShaByExt = {};
    for (const f of (forks.forks || [])) {
      const extName = String(f.repo || '').replace(/^haybarn-/, '').toLowerCase();
      if (extName) forkShaByExt[extName] = f.run?.headSha || null;
    }
    core.extensions = core.extensions.map(ext => {
      let commitSha = ext.commitSha || null;
      if (ext.layer === 'fork') {
        commitSha = forkShaByExt[ext.name] || commitSha;
      } else if (ext.layer === 'in_tree' || ext.layer === 'rebuilt') {
        commitSha = engineSha || commitSha;
      }
      return { ...ext, commitSha };
    });
  }

  const merged = { ...view, version, sidePanel: { forks: forks.forks, community, core } };
  return asJson ? json(merged) : html(renderRcPage(merged));
}

// Newest X.Y.Z among the discovered haybarn-v* tags (numeric compare).
function latestVersionFromTags(tags) {
  const versions = [...new Set((tags || []).map(parseVersionFromTag).filter(Boolean))];
  versions.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  return versions[0] || null;
}

async function handleIndex(env, ctx) {
  const tags = await getCached(env, ctx, 'tags', 300, 1800, () => listEngineTags(env));
  return html(renderIndex(tags));
}

// Live activity feed — a tail of the webhook stream. Not cached (the whole
// point is freshness); the client polls /api/activity on an interval. `before`
// (a row's receivedAt) pages backwards into history.
async function handleActivity(env, url, asJson) {
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 30, 1), 100);
  const data = await buildActivity(env, limit);
  return asJson
    ? json(data, { headers: { 'cache-control': 'no-store' } })
    : html(renderActivityPage(data), { headers: { 'cache-control': 'no-store' } });
}

// Actions-time insights — Vega-Lite charts over the aggregated job stats.
// Cached briefly; the aggregation is cheap but stable minute to minute.
async function handleInsights(env, ctx, asJson) {
  const data = await getCached(env, ctx, 'insights', 120, 900, () => buildActionsInsights(env));
  return asJson ? json(data) : html(renderInsightsPage(data));
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
    // Two crons share this handler. */2 only runs the Discord notifier —
    // a StatusFeed DO-RPC read plus a webhook POST, no GitHub API calls,
    // so the fast cadence doesn't touch the installation-token budget.
    // Everything else (the */15 tick) does the heavy cache prewarm below.
    if (event.cron === NOTIFY_CRON) {
      ctx.waitUntil(
        notifyDiscord(env).catch(e => console.log('discord notify:', e?.message || e)),
      );
      return;
    }
    ctx.waitUntil((async () => {
      // Version-independent caches first.
      await Promise.all([
        refreshCacheKey(env, ctx, 'community', 86400, () => buildCommunityMatrix(env)),
        refreshCacheKey(env, ctx, 'forks',     300,   () => buildForks(env)),
        refreshCacheKey(env, ctx, 'tags',      1800,  () => listEngineTags(env)),
      ]);

      // Presence probes are version-scoped. We prewarm only the LATEST version
      // each tick; older versions' presence is computed lazily on first visit
      // and then cached.
      let version = DEFAULT_VERSION;
      try {
        const t = await env.STATUS_KV.get('tags', { type: 'json' });
        version = latestVersionFromTags(t && t.data && t.data.tags) || DEFAULT_VERSION;
      } catch (_) {}

      await refreshCacheKey(env, ctx, `core:${version}`, 3600,
        () => buildCoreCatalog(env, version));

      try {
        const cm = await env.STATUS_KV.get('community', { type: 'json' });
        const exts = (cm && cm.data && cm.data.extensions) || [];
        const names = exts.map(e => e.name).filter(Boolean);
        if (names.length) {
          await Promise.all([
            refreshCacheKey(env, ctx, `registry-presence:${version}`, 86400,
              () => buildRegistryPresence(env, names, version)),
            refreshCacheKey(env, ctx, `r2-presence:${version}`, 86400,
              () => buildR2Presence(env, names, version)),
          ]);
        } else {
          console.log('prewarm presence: no extensions in matrix');
        }
      } catch (e) {
        console.log('prewarm presence:', e?.message || e);
      }
    })());
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
      if (pathname === '/activity') return handleActivity(env, url, false);
      if (pathname === '/api/activity') return handleActivity(env, url, true);
      if (pathname === '/insights') return handleInsights(env, ctx, false);
      if (pathname === '/api/insights') return handleInsights(env, ctx, true);

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
