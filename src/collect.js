import { ghFetch } from './gh.js';
import {
  ORG, TAG_FIRED_REPOS, FORK_EXT_REPOS, COMMUNITY_REPO,
  TAG_PREFIX, TAG_REF_PATH, DISCLAIMER, DEFAULT_VERSION,
  npmName, pypiName, KNOWN_UPSTREAM_ISSUES,
  CORE_EXTENSIONS, r2CoreBinaryUrl,
} from './repos.js';
import { enumerateCatalog } from './catalog.js';

function summarizeJob(j) {
  // Duration in seconds when the job has both timestamps; the renderer uses
  // it for per-leg build-time tooltips and stuck-job detection.
  const startMs = j.started_at ? Date.parse(j.started_at) : NaN;
  const endMs = j.completed_at ? Date.parse(j.completed_at) : NaN;
  const durationSec = Number.isFinite(startMs) && Number.isFinite(endMs)
    ? Math.max(0, Math.round((endMs - startMs) / 1000))
    : null;
  return {
    name: j.name, status: j.status, conclusion: j.conclusion, htmlUrl: j.html_url,
    startedAt: j.started_at, completedAt: j.completed_at, durationSec,
  };
}

function summarizeRun(r, jobs) {
  return {
    id: r.id,
    runNumber: r.run_number,
    workflowName: r.name,
    workflowPath: r.path,
    event: r.event,
    status: r.status,
    conclusion: r.conclusion,
    headBranch: r.head_branch,
    headSha: r.head_sha,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    htmlUrl: r.html_url,
    jobs: jobs ? jobs.map(summarizeJob) : null,
  };
}

function needsJobs(run) {
  return run.status !== 'completed' || run.conclusion === 'failure';
}

async function fetchRepoRunsForTag(env, repo, tag) {
  // Live state from the webhook collector (StatusFeed), keyed on the tag as
  // head_branch. Only runs that fired since the collector went live appear.
  const runs = await env.FEED.runsForBranch(`${ORG}/${repo}`, tag, 20);
  const enriched = await Promise.all(runs.map(async r => {
    const jobs = needsJobs(r) ? await env.FEED.jobsForRun(r.id) : null;
    return summarizeRun(r, jobs);
  }));
  return enriched;
}

export async function buildRcView(env, tag) {
  const repos = await Promise.all(TAG_FIRED_REPOS.map(async ({ repo, label }) => {
    let runs = [];
    let error = null;
    try {
      runs = await fetchRepoRunsForTag(env, repo, tag);
    } catch (e) {
      error = String(e.message || e);
    }
    return { repo, label, runs, error };
  }));
  return {
    tag,
    fetchedAt: new Date().toISOString(),
    repos,
    sidePanel: null,
    _disclaimer: DISCLAIMER,
  };
}

// Recent build activity for the live page — grouped by workflow run with its
// nested jobs, so the run→job topology is visible and the wall-clock "8h" can
// be broken into elapsed vs Σ-compute vs max-queue.
export async function buildActivity(env, limit = 30) {
  try {
    const runs = await env.FEED.recentRunActivity(limit);
    return { fetchedAt: new Date().toISOString(), runs, _disclaimer: DISCLAIMER };
  } catch (e) {
    return { fetchedAt: new Date().toISOString(), runs: [], error: String(e.message || e), _disclaimer: DISCLAIMER };
  }
}

// Aggregate Actions-time stats for the /insights charts. Cheap fixed-size
// result sets computed in the DO; we just pass them through (+ a fetch stamp).
export async function buildActionsInsights(env) {
  try {
    const stats = await env.FEED.actionsTimeStats();
    return { fetchedAt: new Date().toISOString(), ...stats, _disclaimer: DISCLAIMER };
  } catch (e) {
    return {
      fetchedAt: new Date().toISOString(), error: String(e.message || e),
      byRepo: [], byConclusion: [], byDay: [], topJobs: [], _disclaimer: DISCLAIMER,
    };
  }
}

export async function listEngineTags(env) {
  // Primary source: tags materialized from release/create webhooks in the
  // collector — gives us each tag's publish time for "published Xh ago" and
  // avoids a GitHub API call in steady state. The git/matching-refs API is a
  // completeness backstop, since the webhook history only reaches back to when
  // the collector went live (older tags wouldn't have a create/release event).
  let feedTags = [];
  try {
    feedTags = await env.FEED.listTags(`${ORG}/haybarn`, TAG_PREFIX);
  } catch (e) {
    console.log('FEED.listTags failed:', e?.message || e);
  }

  let apiTags = [];
  try {
    const refs = await ghFetch(env, `/repos/${ORG}/haybarn/git/matching-refs/${TAG_REF_PATH}`);
    apiTags = refs.map(r => r.ref.replace('refs/tags/', ''));
  } catch (e) {
    // Non-fatal: if the API is unavailable we still have the feed tags.
    console.log('matching-refs failed:', e?.message || e);
  }

  const publishedByTag = {};
  for (const t of feedTags) {
    if (t.published_at) publishedByTag[t.tag] = t.published_at;
  }

  const tags = [...new Set([...feedTags.map(t => t.tag), ...apiTags])]
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));

  return { fetchedAt: new Date().toISOString(), tags, published: publishedByTag, _disclaimer: DISCLAIMER };
}

export async function buildForks(env) {
  const forks = await Promise.all(FORK_EXT_REPOS.map(async ({ repo, label }) => {
    try {
      const run = await env.FEED.latestRunForBranch(`${ORG}/${repo}`, 'haybarn');
      return { repo, label, run: run ? summarizeRun(run, null) : null, error: null };
    } catch (e) {
      return { repo, label, run: null, error: String(e.message || e) };
    }
  }));
  return { fetchedAt: new Date().toISOString(), forks, _disclaimer: DISCLAIMER };
}

// haybarn-community-extensions/build.yml sets its run-name to "🐤 <extname>"
// whenever extension_name comes in via workflow_dispatch or workflow_call
// inputs (this is what build_all and any per-extension manual builds look
// like). Pull the name out of display_title cheaply — no API call needed.
const DISPLAY_TITLE_RE = /🐤\s+([\w.-]+)/;

function extensionFromDisplayTitle(title) {
  if (!title) return null;
  const m = title.match(DISPLAY_TITLE_RE);
  return m ? m[1] : null;
}

// build_all.yml fans out 240+ per-extension builds via workflow_call
// (matrix on the descriptor list). These don't appear as separate
// workflow_runs of build.yml — they're nested JOBS inside the one
// build_all run, named like:
//   "build_all (h3) / build / Linux (linux_amd64, ...)"
//   "build_all (h3) / prepare"
//   "build_all (chess) / ..."
// We detect that pattern and pull the extension name out of the parens.
const BUILD_ALL_NAME_RE = /^build_all\s*\(([\w.-]+)\)\s*\/\s*(.+)$/;

function parseBuildAllJobName(name) {
  const m = name.match(BUILD_ALL_NAME_RE);
  if (!m) return null;
  return { extension: m[1], inner: m[2] };
}

// The engine version a community build run targeted is a run-level DISPATCH
// INPUT (duckdb_version), never a job-name dimension — so it only surfaces in
// the run's display_title, which build_all.yml / build.yml encode as the
// `haybarn-v<X.Y.Z>[-rcN]` tag (e.g. "🐝 sweep haybarn-v1.5.3-rc10 (all
// extensions)" or "🐤 chess (haybarn-v1.5.3-rc10)"). Pull the plain X.Y.Z out
// so the matrix can be scoped to the rc page's engine version. Returns null
// when the title carries no parseable engine tag (older, pre-versioned runs);
// such runs are intentionally NOT attributed to any version.
function engineVersionFromTitle(title) {
  const m = String(title || '').match(/haybarn-v(\d+\.\d+\.\d+)/);
  return m ? m[1] : null;
}

// Pull the latest run of build_all.yml (the bulk fan-out workflow) and
// derive a per-extension matrix from its job list. Used in preference to
// the per-workflow-run scan when a recent build_all exists — that one
// run captures every extension being built across the catalog, whereas
// the per-run scan can only see the most recent ~100 direct invocations
// of build.yml (which excludes workflow_call children of build_all).
async function buildMatrixFromBuildAll(env, version = DEFAULT_VERSION) {
  // Pick the most recent build_all that (a) targeted THIS engine version and
  // (b) wasn't cancelled.
  //
  // (a) The engine version is a run-level dispatch input, so a single sweep
  // builds every extension against ONE version. We must not show a 1.5.2 sweep
  // on a 1.5.3 rc page — so we scan recent sweeps and keep the newest whose
  // run-name encodes `version`. Sweeps with no parseable engine tag (older runs
  // dispatched before build_all.yml embedded the version) are skipped: the page
  // shows "not yet built for this version" rather than misattributing them.
  //
  // (b) A cancelled run only has the subset of extensions whose matrix legs got
  // scheduled before cancellation — using it would mean the status page only
  // shows that subset (the bug once surfaced as "only 92 extensions starting at
  // 'oast'" while 240+ were expected).
  const recent = await env.FEED.recentRunsForWorkflow(
    `${ORG}/${COMMUNITY_REPO.repo}`,
    COMMUNITY_REPO.buildAllWorkflowFile,
    COMMUNITY_REPO.branch,
    50,
  );
  const run = (recent || []).find(
    (r) =>
      r.conclusion !== 'cancelled' &&
      engineVersionFromTitle(r.display_title || r.name) === version,
  );
  if (!run) return null;

  // The feed returns every materialized job for the run (240 extensions ×
  // ~9 jobs each ≈ 2200), no pagination needed.
  const allJobs = await env.FEED.jobsForRun(run.id);

  const byExt = new Map();
  let nonMatching = 0;
  for (const j of allJobs) {
    const parsed = parseBuildAllJobName(j.name);
    if (!parsed) { nonMatching++; continue; }
    if (!byExt.has(parsed.extension)) byExt.set(parsed.extension, []);
    // Reshape: synthesize a job entry whose `name` retains the inner part,
    // so the existing renderer's parseCommunityJob() can pull a platform
    // label out of the "Linux (linux_amd64, ...)" parens just like before.
    byExt.get(parsed.extension).push({
      name: parsed.inner,
      status: j.status,
      conclusion: j.conclusion,
      html_url: j.html_url,
      // Carry timing so summarizeJob can derive per-leg build time (the
      // build_all fan-out is the primary community source; without these the
      // build-time view would be empty for most extensions).
      started_at: j.started_at,
      completed_at: j.completed_at,
    });
  }

  // Compute per-extension rolled-up status (worst-case): failure > in_progress
  // > queued > success.
  const STATUS_RANK = {
    failure: 5, cancelled: 4, timed_out: 4,
    in_progress: 3, queued: 3, waiting: 3, pending: 3,
    success: 1, skipped: 0, neutral: 0,
  };

  const extensions = [...byExt.entries()].map(([name, rawJobs]) => {
    // Keep only matrix jobs (those with a paren, i.e. platform-leg jobs).
    // Drop control jobs like "prepare" + "build / Generate matrix" so the
    // matrix grid stays clean.
    const matrixJobs = rawJobs.filter(j => /\(/.test(j.name)).map(summarizeJob);

    // Roll up the worst-case status across all this extension's jobs
    // (matrix + control) so the row's pill reflects reality even if
    // control jobs fail.
    let worst = { status: 'completed', conclusion: 'success' };
    for (const j of rawJobs) {
      const cur = j.status === 'completed' ? (j.conclusion || 'neutral') : (j.status || 'unknown');
      const next = worst.status === 'completed' ? (worst.conclusion || 'neutral') : worst.status;
      if ((STATUS_RANK[cur] || 2) > (STATUS_RANK[next] || 2)) {
        worst = { status: j.status, conclusion: j.conclusion };
      }
    }

    return {
      name,
      run: {
        ...summarizeRun(run, null),
        status: worst.status,
        conclusion: worst.conclusion,
      },
      jobs: matrixJobs,
    };
  });

  extensions.sort((a, b) => a.name.localeCompare(b.name));

  return {
    fetchedAt: new Date().toISOString(),
    scannedRuns: 1,
    sourceRunId: run.id,
    sourceRunUrl: run.html_url,
    extensions,
    totalJobs: allJobs.length,
    nonMatchingJobs: nonMatching,
    _disclaimer: DISCLAIMER,
  };
}

// Scan the most recent N community runs to build a per-extension status matrix.
// Strategy:
//   1. If a recent build_all run exists with substantive job count, use it —
//      one run gives us EVERY extension being built across the catalog.
//   2. Otherwise fall back to scanning recent direct build.yml runs, with
//      extension-name resolution from display_title or commit file-diff.
//
// For each identified extension we keep the run with the highest run_number
// and fetch its jobs to expose the platform-leg matrix.
// ---------------------------------------------------------------------------
// Registry presence — does `haybarn-ext-<ext>-h<hv>` exist on npm/PyPI?
//
// Lookup is one GET per (ext, registry); the workers-fetch implementation
// follows redirects + caches at the edge automatically. 240 extensions ×
// 2 registries = ~480 subrequests per refresh — fine on paid Worker
// plans (1000 limit) but we batch in waves of 32 to keep the fetch
// queue from saturating outbound connections.
// ---------------------------------------------------------------------------

const NPM_REGISTRY = 'https://registry.npmjs.org';
const PYPI_REGISTRY = 'https://pypi.org';

function npmPath(name) {
  // npm accepts both `@scope/name` and `@scope%2Fname`; the encoded
  // form is friendlier to URL parsers in proxies.
  return name.replace('/', '%2F');
}

async function _probeNpm(name) {
  try {
    const r = await fetch(`${NPM_REGISTRY}/${npmPath(name)}`, {
      method: 'GET',
      headers: { accept: 'application/json' },
    });
    if (r.status === 404) return { exists: false };
    if (!r.ok) return { exists: false, error: `npm ${r.status}` };
    const d = await r.json();
    return {
      exists: true,
      latest: (d['dist-tags'] || {}).latest || null,
      url: `https://www.npmjs.com/package/${name}`,
    };
  } catch (e) {
    return { exists: false, error: `npm ${e && e.message ? e.message : 'fetch'}` };
  }
}

async function _probePypi(name) {
  try {
    const r = await fetch(`${PYPI_REGISTRY}/pypi/${encodeURIComponent(name)}/json`, {
      method: 'GET',
      headers: { accept: 'application/json' },
    });
    if (r.status === 404) return { exists: false };
    if (!r.ok) return { exists: false, error: `pypi ${r.status}` };
    const d = await r.json();
    return {
      exists: true,
      latest: (d.info || {}).version || null,
      url: `https://pypi.org/project/${name}/`,
    };
  } catch (e) {
    return { exists: false, error: `pypi ${e && e.message ? e.message : 'fetch'}` };
  }
}

export async function buildRegistryPresence(env, extensionNames, version = DEFAULT_VERSION) {
  const out = {};
  const BATCH = 32;
  for (let i = 0; i < extensionNames.length; i += BATCH) {
    const slice = extensionNames.slice(i, i + BATCH);
    const results = await Promise.all(slice.map(async (ext) => {
      const [npm, pypi] = await Promise.all([
        _probeNpm(npmName(ext, version)),
        _probePypi(pypiName(ext, version)),
      ]);
      return [ext, { npm, pypi }];
    }));
    for (const [ext, r] of results) out[ext] = r;
  }
  return {
    fetchedAt: new Date().toISOString(),
    version,
    extensionsProbed: extensionNames.length,
    presence: out,
    knownIssues: KNOWN_UPSTREAM_ISSUES,
    _disclaimer: DISCLAIMER,
  };
}

// ---------------------------------------------------------------------------
// R2 presence — does the signed `.duckdb_extension.gz` actually exist on the
// Haybarn extension bucket for this DuckDB version?
//
// This is the authoritative "can a user INSTALL this today" check —
// independent of whether CI has fired recently for the extension. We probe
// one canonical platform (linux_amd64) per extension; the build pipeline
// publishes all 12 platforms atomically, so a single hit is a reliable
// proxy for the others.
// ---------------------------------------------------------------------------

import { r2BinaryUrl as _r2BinaryUrl } from './repos.js';

const R2_PROBE_PLATFORM = 'linux_amd64';

async function _probeR2(extension, version = DEFAULT_VERSION) {
  const url = _r2BinaryUrl(extension, R2_PROBE_PLATFORM, version);
  try {
    const r = await fetch(url, { method: 'HEAD' });
    if (r.status === 404) return { exists: false, url, platform: R2_PROBE_PLATFORM };
    if (!r.ok)             return { exists: false, url, platform: R2_PROBE_PLATFORM, error: `r2 ${r.status}` };
    return {
      exists: true,
      url,
      platform: R2_PROBE_PLATFORM,
      lastModified: r.headers.get('last-modified') || null,
      contentLength: r.headers.get('content-length') || null,
    };
  } catch (e) {
    return { exists: false, url, platform: R2_PROBE_PLATFORM, error: `r2 ${e && e.message ? e.message : 'fetch'}` };
  }
}

export async function buildR2Presence(env, extensionNames, version = DEFAULT_VERSION) {
  const out = {};
  const BATCH = 32;
  for (let i = 0; i < extensionNames.length; i += BATCH) {
    const slice = extensionNames.slice(i, i + BATCH);
    const results = await Promise.all(slice.map(async (ext) => [ext, await _probeR2(ext, version)]));
    for (const [ext, r] of results) out[ext] = r;
  }
  return {
    fetchedAt: new Date().toISOString(),
    version,
    extensionsProbed: extensionNames.length,
    platform: R2_PROBE_PLATFORM,
    presence: out,
    _disclaimer: DISCLAIMER,
  };
}

// ---------------------------------------------------------------------------
// Core catalog — extensions Haybarn ships on the `/core/` R2 channel. Same
// shape as the community matrix so the website can render both with one
// table, but the data source is different:
//   - Catalog list is the static CORE_EXTENSIONS table in repos.js (mirrors
//     haybarn_extensions.cmake; rarely changes).
//   - R2 probe hits the `/core/` channel instead of `/community/`.
//   - npm/PyPI naming is identical to community (`@haybarn/ext-<name>-h1-5-2`,
//     `haybarn-ext-<name>-h1-5-2`) — those packages don't exist yet today,
//     but the deterministic URLs are still useful as "where it'll land."
// ---------------------------------------------------------------------------

async function _probeR2Core(extension, version = DEFAULT_VERSION) {
  const url = r2CoreBinaryUrl(extension, R2_PROBE_PLATFORM, version);
  try {
    const r = await fetch(url, { method: 'HEAD' });
    if (r.status === 404) return { exists: false, url, platform: R2_PROBE_PLATFORM };
    if (!r.ok)             return { exists: false, url, platform: R2_PROBE_PLATFORM, error: `r2 ${r.status}` };
    return {
      exists: true,
      url,
      platform: R2_PROBE_PLATFORM,
      lastModified: r.headers.get('last-modified') || null,
      contentLength: r.headers.get('content-length') || null,
    };
  } catch (e) {
    return { exists: false, url, platform: R2_PROBE_PLATFORM, error: `r2 ${e && e.message ? e.message : 'fetch'}` };
  }
}

export async function buildCoreCatalog(env, version = DEFAULT_VERSION) {
  const BATCH = 32;
  const out = [];
  for (let i = 0; i < CORE_EXTENSIONS.length; i += BATCH) {
    const slice = CORE_EXTENSIONS.slice(i, i + BATCH);
    const batch = await Promise.all(slice.map(async (ext) => {
      const [r2, npm, pypi] = await Promise.all([
        _probeR2Core(ext.name, version),
        _probeNpm(npmName(ext.name, version)),
        _probePypi(pypiName(ext.name, version)),
      ]);
      return {
        name: ext.name,
        layer: ext.layer,
        version: null,    // core extensions don't carry a description.yml version today
        commitSha: null,
        description: null,
        repo: null,
        run: null,        // no per-extension CI run for core; engine carries it
        registries: { npm, pypi },
        r2,
      };
    }));
    out.push(...batch);
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return {
    fetchedAt: new Date().toISOString(),
    version,
    extensions: out,
    catalogSize: CORE_EXTENSIONS.length,
    platform: R2_PROBE_PLATFORM,
    _disclaimer: DISCLAIMER,
  };
}

// Latest build.yml run per extension on the community repo, straight from the
// DO (webhook feed). runsForWorkflow reduces per display_title ("🐤 <ext>") in
// SQL and applies NO row cap — so every extension's current run appears even
// when the DO holds many runs per extension (re-dispatches + old cancelled +
// historical). The earlier capped query showed only partial data once
// duplicates filled the window.
async function listRecentCommunityRuns(env) {
  return env.FEED.runsForWorkflow(
    `${ORG}/${COMMUNITY_REPO.repo}`, COMMUNITY_REPO.branch, COMMUNITY_REPO.workflowFile,
  );
}

// Per-extension reliability over the last N decisive runs, reduced in the DO
// from full build.yml history. Returns { extName -> { ok, total } } so the
// matrix can flag extensions that are chronically red vs flaky vs healthy —
// invisible in the latest-run-only view. Best-effort: empty map on failure.
async function communityReliabilityMap(env) {
  const out = {};
  let rows = [];
  try {
    rows = await env.FEED.reliabilityForWorkflow(
      `${ORG}/${COMMUNITY_REPO.repo}`, COMMUNITY_REPO.branch, COMMUNITY_REPO.workflowFile,
    );
  } catch (e) {
    console.log('FEED.reliabilityForWorkflow failed:', e?.message || e);
    return out;
  }
  for (const r of rows) {
    const ext = extensionFromDisplayTitle(r.display_title);
    if (!ext) continue;
    const total = (r.ok || 0) + (r.fail || 0);
    if (total > 0) out[ext] = { ok: r.ok || 0, total };
  }
  return out;
}

export async function buildCommunityMatrix(env, version = DEFAULT_VERSION) {
  // Canonical catalog enumeration — every extensions/<name>/ subdir in the
  // haybarn-community-extensions repo, with parsed description.yml metadata
  // (version, repo.github, repo.ref). The CI-run sources below fill in the
  // build-state side; extensions without a recent run still appear with
  // `run: null` so the page can show "not yet built".
  let catalog = [];
  try {
    catalog = await enumerateCatalog(env);
  } catch (e) {
    console.log('enumerateCatalog failed:', e?.message || e);
  }

  // Reliability ratios (last-N pass rate per extension) from build.yml history.
  const reliability = await communityReliabilityMap(env);

  // Prefer build_all source when it has substantive data: that single
  // workflow run captures every extension built across the catalog.
  let buildAllMatrix = null;
  try {
    buildAllMatrix = await buildMatrixFromBuildAll(env, version);
  } catch (e) {
    console.log('buildMatrixFromBuildAll fallback:', e?.message || e);
  }

  // Also scan recent build.yml runs (from the feed) so we catch all the
  // per-extension dispatches that happened outside any build_all run.
  // The two sources are MERGED: build_all matrix entries take
  // precedence (they carry the full per-platform job grid), but
  // build.yml runs fill in extensions that build_all didn't include
  // or that were dispatched independently afterwards.
  let runs = [];
  try {
    runs = await listRecentCommunityRuns(env);
    // Scope to this engine version: a direct build.yml dispatch encodes its
    // target tag in the run-name ("🐤 <ext> (haybarn-v<X.Y.Z>...)"), so we keep
    // only runs that built against `version`. Runs with no parseable engine tag
    // (older, pre-versioned dispatches, or path-filtered "push:" runs we can't
    // attribute anyway) are dropped rather than shown under the wrong version.
    runs = runs.filter((r) => engineVersionFromTitle(r.display_title || r.name) === version);
  } catch (e) {
    if (!buildAllMatrix) {
      return { fetchedAt: new Date().toISOString(), scannedRuns: 0, extensions: [], error: String(e.message || e), _disclaimer: DISCLAIMER };
    }
  }
  // If we got nothing from build.yml AND build_all had data, return that.
  if (runs.length === 0 && buildAllMatrix) {
    return buildAllMatrix;
  }
  // If both empty, surface an empty matrix rather than 500.
  if (runs.length === 0 && !buildAllMatrix) {
    return { fetchedAt: new Date().toISOString(), scannedRuns: 0, extensions: [], _disclaimer: DISCLAIMER };
  }

  // Attribute each build.yml run to an extension via display_title (e.g.
  // "🐤 <extname>"). Commit-based fallback isn't possible from webhook data
  // (no commits API), so runs without an identifiable title are skipped —
  // build_all already covers the full catalog, so this only drops the odd
  // bulk/refactor run we couldn't have attributed reliably anyway.
  const runExt = new Map();          // runId → extension name
  for (const r of runs) {
    const fromTitle = extensionFromDisplayTitle(r.display_title || r.name);
    if (fromTitle) runExt.set(r.id, fromTitle);
  }

  // Group runs by attributable extension, keeping the highest run_number.
  // Track in-flight runs we COULDN'T attribute (e.g. a bulk build.yml dispatch
  // started without an `extension_name` input, so the run-name is the generic
  // workflow name rather than "🐤 <ext>"). We can't map these to a row, but we
  // surface the count so the activity is at least visible.
  const byExt = new Map();
  let skippedBulk = 0;
  let unattributedInflight = 0;
  for (const r of runs) {
    const ext = runExt.get(r.id);
    if (!ext) {
      skippedBulk++;
      if (r.status === 'queued' || r.status === 'in_progress') unattributedInflight++;
      continue;
    }
    const existing = byExt.get(ext);
    if (!existing || existing.run_number < r.run_number) byExt.set(ext, r);
  }

  // Fetch jobs for each kept run from the feed (parallel).
  const extensions = await Promise.all([...byExt.entries()].map(async ([name, run]) => {
    let jobs = [];
    try {
      const all = await env.FEED.jobsForRun(run.id);
      jobs = all.filter(j => /\(/.test(j.name)).map(summarizeJob);
    } catch (_) { /* leave jobs empty */ }
    return { name, run: summarizeRun(run, null), jobs };
  }));

  // Merge in any build_all entries we didn't already see from build.yml.
  // This guarantees that extensions only built via build_all (no recent
  // standalone dispatch) still show up in the matrix.
  if (buildAllMatrix && buildAllMatrix.extensions) {
    const have = new Set(extensions.map(e => e.name));
    for (const ext of buildAllMatrix.extensions) {
      if (!have.has(ext.name)) extensions.push(ext);
    }
  }

  // Left-join the CI-run-derived extensions onto the catalog enumeration so
  // every extension on disk appears, even if it has never been built. The
  // catalog is authoritative for the row list and for metadata (version,
  // commitSha, repo); the run-data side fills in build state.
  let merged;
  if (catalog.length > 0) {
    const runByName = new Map(extensions.map(e => [e.name, e]));
    merged = catalog.map(c => {
      const r = runByName.get(c.name);
      return {
        name: c.name,
        version: c.version,
        commitSha: c.commitSha,
        description: c.description,
        license: c.license,
        language: c.language,
        repo: c.repo,
        run: r?.run ?? null,
        jobs: r?.jobs ?? null,
        reliability: reliability[c.name] ?? null,
      };
    });
    // Surface anything CI saw but the catalog didn't (shouldn't happen, but
    // safer than silently dropping rows).
    const inCatalog = new Set(catalog.map(c => c.name));
    for (const r of extensions) {
      if (!inCatalog.has(r.name)) {
        merged.push({
          name: r.name,
          version: null, commitSha: null, description: null,
          license: null, language: null, repo: null,
          run: r.run, jobs: r.jobs,
          reliability: reliability[r.name] ?? null,
        });
      }
    }
  } else {
    // Fallback: catalog enumeration failed — keep the legacy CI-only list
    // shape so the page still has something to render.
    merged = extensions.map(r => ({
      name: r.name,
      version: null, commitSha: null, description: null,
      license: null, language: null, repo: null,
      run: r.run, jobs: r.jobs,
      reliability: reliability[r.name] ?? null,
    }));
  }

  merged.sort((a, b) => a.name.localeCompare(b.name));

  return {
    fetchedAt: new Date().toISOString(),
    scannedRuns: runs.length,
    scannedBuildAllExtensions: buildAllMatrix ? buildAllMatrix.extensions.length : 0,
    skippedBulkRuns: skippedBulk,
    unattributedInflight,
    catalogSize: catalog.length,
    extensions: merged,
    _disclaimer: DISCLAIMER,
  };
}
