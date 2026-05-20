// Catalog enumeration + description.yml parsing for haybarn-community-extensions.
//
// The previous community-matrix path enumerated extensions from CI runs only
// (collect.js:buildCommunityMatrix), which misses anything that hasn't built
// in the rolling 500-run window — including extensions that have never been
// triggered. This module is the authoritative source: list every subdir of
// `extensions/` and parse its `description.yml` for version + repo pin info.

import { ghFetch } from './gh.js';
import { ORG, COMMUNITY_REPO } from './repos.js';

// Lightweight extractor for the description.yml subset we need.
//
// We deliberately don't add a YAML dep — the file layout is two top-level
// sections (`extension:` and `repo:`), each with simple scalar keys. We pull
// out a fixed list of fields and ignore the rest. Block scalars / list values
// (docs.extended_description, maintainers, etc.) we don't read.
export function parseDescriptionYml(text) {
  const out = {
    name: null,
    version: null,
    description: null,
    license: null,
    language: null,
    repoGithub: null,
    repoRef: null,
  };
  if (!text) return out;

  let section = null;
  for (const rawLine of text.split('\n')) {
    const line = rawLine.replace(/\r$/, '');
    // Top-level section start: no leading whitespace, name + colon, no value.
    const sec = line.match(/^([a-z_]+):\s*$/);
    if (sec) { section = sec[1]; continue; }
    // Top-level scalar (e.g. `name: foo` at column 0) ends any current section.
    if (/^[a-z_]+:\s+\S/.test(line)) { section = null; continue; }
    if (!section) continue;

    // Indented (2-space) key: value within the current section.
    const kv = line.match(/^\s{2}([a-z_]+):\s*(.*)$/);
    if (!kv) continue;
    const key = kv[1];
    let value = kv[2].trim();
    // Strip surrounding single or double quotes.
    if (value.length >= 2 && (
      (value.startsWith("'") && value.endsWith("'")) ||
      (value.startsWith('"') && value.endsWith('"'))
    )) {
      value = value.slice(1, -1);
    }
    if (!value) continue;

    if (section === 'extension') {
      if (key === 'name') out.name = value;
      else if (key === 'version') out.version = value;
      else if (key === 'description') out.description = value;
      else if (key === 'license') out.license = value;
      else if (key === 'language') out.language = value;
    } else if (section === 'repo') {
      if (key === 'github') out.repoGithub = value;
      else if (key === 'ref') out.repoRef = value;
    }
  }
  return out;
}

// List `extensions/<name>` subdirectories in the haybarn-community-extensions
// repo via the GitHub Contents API. Each entry carries `{name, sha}` where
// `sha` is the *tree* sha for the subdir — useful as a stable cache key.
async function listCatalogDirs(env) {
  const path = `/repos/${ORG}/${COMMUNITY_REPO.repo}/contents/extensions`;
  const items = await ghFetch(env, path);
  if (!Array.isArray(items)) return [];
  return items
    .filter(it => it.type === 'dir')
    .map(it => ({ name: it.name, sha: it.sha }));
}

// Fetch + parse `extensions/<name>/description.yml`. Cached in KV keyed by the
// directory tree sha — when the descriptor changes, the tree sha changes,
// invalidating the cache automatically. KV entries live for 30 days.
async function fetchDescription(env, name, dirSha) {
  const cacheKey = `descyml:${name}:${dirSha}`;
  try {
    const cached = await env.STATUS_KV.get(cacheKey, { type: 'json' });
    if (cached) return cached;
  } catch (_) { /* fall through */ }

  // GitHub Contents API returns base64-encoded file body; small (<2KB) for
  // every descriptor in this repo. atob() handles it cleanly in Workers.
  const path = `/repos/${ORG}/${COMMUNITY_REPO.repo}/contents/extensions/${name}/description.yml`;
  let parsed;
  try {
    const meta = await ghFetch(env, path);
    if (meta && meta.content) {
      const decoded = atob(meta.content.replace(/\n/g, ''));
      parsed = parseDescriptionYml(decoded);
    } else {
      parsed = { name, version: null, description: null, license: null, language: null, repoGithub: null, repoRef: null };
    }
  } catch (_) {
    // Missing descriptor (or transient 404) — return an empty record so the
    // row still appears in the catalog with `version: null`.
    parsed = { name, version: null, description: null, license: null, language: null, repoGithub: null, repoRef: null };
  }

  try {
    await env.STATUS_KV.put(cacheKey, JSON.stringify(parsed), {
      expirationTtl: 30 * 86400,
    });
  } catch (_) { /* non-fatal */ }
  return parsed;
}

// Enumerate every extension in the haybarn-community-extensions repo and
// return its parsed descriptor metadata.
//
// Cost: 1 Contents API call (list) + N parallel Contents calls (descriptors),
// with each descriptor cached per-tree-sha. After the first cold call most
// subsequent calls return from KV.
export async function enumerateCatalog(env) {
  const dirs = await listCatalogDirs(env);
  const BATCH = 32;
  const out = [];
  for (let i = 0; i < dirs.length; i += BATCH) {
    const slice = dirs.slice(i, i + BATCH);
    const batch = await Promise.all(
      slice.map(d => fetchDescription(env, d.name, d.sha).then(meta => ({
        name: d.name,
        dirSha: d.sha,
        version: meta?.version ?? null,
        commitSha: meta?.repoRef ?? null,
        description: meta?.description ?? null,
        license: meta?.license ?? null,
        language: meta?.language ?? null,
        repo: meta?.repoGithub ? { github: meta.repoGithub, ref: meta.repoRef ?? null } : null,
      }))),
    );
    out.push(...batch);
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}
