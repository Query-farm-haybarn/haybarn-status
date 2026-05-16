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

// Returns the single extension this commit touched, or null when the commit
// touched zero or multiple descriptors. Multi-descriptor commits are bulk
// import/refactor operations (e.g. sync_from_upstream landing 240 descriptors
// in one go) — the workflow only ever builds ONE extension per run, so we
// can't reliably attribute a multi-descriptor commit to a specific extension.
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

// Scan the most recent N community runs to build a per-extension status matrix.
// Strategy: a given community workflow run builds ONE extension (the one whose
// descriptor was touched on the commit, or workflow_dispatch input). We identify
// the extension via the head_commit's changed files (deduped by SHA across
// runs). For each extension we keep the run with the highest run_number and
// fetch its jobs to expose the platform-leg matrix.
export async function buildCommunityMatrix(env, { perPage = 100 } = {}) {
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

  // Resolve each unique head_sha to the single extension that commit touched
  // (or null if it was a bulk-import / non-descriptor commit).
  const uniqueShas = [...new Set(runs.map(r => r.head_sha).filter(Boolean))];
  const shaExt = new Map();
  await Promise.all(uniqueShas.map(async (sha) => {
    shaExt.set(sha, await commitSingleExtension(env, sha));
  }));

  // Group runs by attributable extension, keeping the highest run_number.
  const byExt = new Map();
  let skippedBulk = 0;
  for (const r of runs) {
    const ext = shaExt.get(r.head_sha);
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
