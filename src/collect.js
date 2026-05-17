import { ghFetch } from './gh.js';
import {
  ORG, TAG_FIRED_REPOS, FORK_EXT_REPOS, COMMUNITY_REPO,
  TAG_PREFIX, TAG_REF_PATH, DISCLAIMER,
} from './repos.js';

function summarizeJob(j) {
  return { name: j.name, status: j.status, conclusion: j.conclusion, htmlUrl: j.html_url };
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

async function fetchRunJobs(env, owner, repo, runId, maxPages = 1) {
  const all = [];
  for (let page = 1; page <= maxPages; page++) {
    const url = `/repos/${owner}/${repo}/actions/runs/${runId}/jobs?per_page=100&filter=latest&page=${page}`;
    const data = await ghFetch(env, url);
    const jobs = data.jobs || [];
    all.push(...jobs);
    if (jobs.length < 100) break;
  }
  return all;
}

async function fetchRepoRunsForTag(env, repo, tag) {
  const path = `/repos/${ORG}/${repo}/actions/runs?branch=${encodeURIComponent(tag)}&per_page=20`;
  const data = await ghFetch(env, path);
  const runs = data.workflow_runs || [];
  const enriched = await Promise.all(runs.map(async r => {
    const jobs = needsJobs(r) ? await fetchRunJobs(env, ORG, repo, r.id) : null;
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

export async function listEngineTags(env) {
  const path = `/repos/${ORG}/haybarn/git/matching-refs/${TAG_REF_PATH}`;
  const refs = await ghFetch(env, path);
  const tags = refs.map(r => r.ref.replace('refs/tags/', ''));
  tags.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  return { fetchedAt: new Date().toISOString(), tags, _disclaimer: DISCLAIMER };
}

export async function buildForks(env) {
  const forks = await Promise.all(FORK_EXT_REPOS.map(async ({ repo, label }) => {
    try {
      const data = await ghFetch(
        env,
        `/repos/${ORG}/${repo}/actions/runs?branch=haybarn&per_page=1`,
      );
      const run = (data.workflow_runs || [])[0];
      return { repo, label, run: run ? summarizeRun(run, null) : null, error: null };
    } catch (e) {
      return { repo, label, run: null, error: String(e.message || e) };
    }
  }));
  return { fetchedAt: new Date().toISOString(), forks, _disclaimer: DISCLAIMER };
}

const EXT_PATH_RE = /^extensions\/([\w.-]+)\/description\.yml$/;

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

// Returns the single extension this commit touched, or null when the commit
// touched zero or multiple descriptors. Multi-descriptor commits are bulk
// import/refactor operations (e.g. sync_from_upstream landing 240 descriptors
// in one go) — the workflow only ever builds ONE extension per run, so we
// can't reliably attribute a multi-descriptor commit to a specific extension
// via files alone. (Workflow_dispatch invocations DO know which extension
// they built; we read those from display_title above, before this fallback.)
async function commitSingleExtension(env, sha) {
  try {
    const commit = await ghFetch(env, `/repos/${ORG}/${COMMUNITY_REPO.repo}/commits/${sha}`);
    const exts = new Set();
    for (const f of commit.files || []) {
      const m = f.filename.match(EXT_PATH_RE);
      if (m) exts.add(m[1]);
    }
    return exts.size === 1 ? [...exts][0] : null;
  } catch (_) {
    return null;
  }
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

// Pull the latest run of build_all.yml (the bulk fan-out workflow) and
// derive a per-extension matrix from its job list. Used in preference to
// the per-workflow-run scan when a recent build_all exists — that one
// run captures every extension being built across the catalog, whereas
// the per-run scan can only see the most recent ~100 direct invocations
// of build.yml (which excludes workflow_call children of build_all).
async function buildMatrixFromBuildAll(env) {
  // Latest build_all run on main.
  const listPath = `/repos/${ORG}/${COMMUNITY_REPO.repo}/actions/workflows/${COMMUNITY_REPO.buildAllWorkflowFile}/runs?branch=${COMMUNITY_REPO.branch}&per_page=1`;
  const data = await ghFetch(env, listPath);
  const run = (data.workflow_runs || [])[0];
  if (!run) return null;

  // 240 extensions × ~9 jobs each = ~2200 jobs. Paginate generously.
  // GH caps per_page at 100; we'll pull up to 30 pages = 3000 jobs.
  const allJobs = await fetchRunJobs(env, ORG, COMMUNITY_REPO.repo, run.id, 30);

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
export async function buildCommunityMatrix(env, { perPage = 100 } = {}) {
  // Prefer build_all source when it has substantive data: that single
  // workflow run captures every extension built across the catalog.
  try {
    const fromBuildAll = await buildMatrixFromBuildAll(env);
    if (fromBuildAll && fromBuildAll.extensions.length >= 5) {
      return fromBuildAll;
    }
  } catch (e) {
    // Fall through to per-run scan on any error.
    console.log('buildMatrixFromBuildAll fallback:', e?.message || e);
  }

  let runs = [];
  try {
    const data = await ghFetch(
      env,
      `/repos/${ORG}/${COMMUNITY_REPO.repo}/actions/workflows/${COMMUNITY_REPO.workflowFile}/runs?branch=${COMMUNITY_REPO.branch}&per_page=${perPage}`,
    );
    runs = data.workflow_runs || [];
  } catch (e) {
    return { fetchedAt: new Date().toISOString(), scannedRuns: 0, extensions: [], error: String(e.message || e), _disclaimer: DISCLAIMER };
  }

  // Pass 1: try display_title (free, no API call). Mark which runs still
  // need commit-based attribution.
  const runExt = new Map();          // runId → extension name
  const needCommit = new Map();      // sha → list of runs needing fallback
  for (const r of runs) {
    const fromTitle = extensionFromDisplayTitle(r.display_title || r.name);
    if (fromTitle) {
      runExt.set(r.id, fromTitle);
    } else if (r.head_sha) {
      if (!needCommit.has(r.head_sha)) needCommit.set(r.head_sha, []);
      needCommit.get(r.head_sha).push(r);
    }
  }

  // Pass 2: for runs without a display_title-derived name, look up the
  // commit (deduped by sha). Multi-descriptor commits stay unattributed.
  await Promise.all([...needCommit.keys()].map(async (sha) => {
    const ext = await commitSingleExtension(env, sha);
    if (ext) {
      for (const r of needCommit.get(sha)) runExt.set(r.id, ext);
    }
  }));

  // Group runs by attributable extension, keeping the highest run_number.
  const byExt = new Map();
  let skippedBulk = 0;
  for (const r of runs) {
    const ext = runExt.get(r.id);
    if (!ext) { skippedBulk++; continue; }
    const existing = byExt.get(ext);
    if (!existing || existing.run_number < r.run_number) byExt.set(ext, r);
  }

  // Fetch jobs for each kept run (parallel, max 1 page → first 100 jobs).
  const extensions = await Promise.all([...byExt.entries()].map(async ([name, run]) => {
    let jobs = [];
    try {
      const all = await fetchRunJobs(env, ORG, COMMUNITY_REPO.repo, run.id, 1);
      jobs = all.filter(j => /\(/.test(j.name)).map(summarizeJob);
    } catch (_) { /* leave jobs empty */ }
    return { name, run: summarizeRun(run, null), jobs };
  }));

  extensions.sort((a, b) => a.name.localeCompare(b.name));

  return {
    fetchedAt: new Date().toISOString(),
    scannedRuns: runs.length,
    skippedBulkRuns: skippedBulk,
    extensions,
    _disclaimer: DISCLAIMER,
  };
}
