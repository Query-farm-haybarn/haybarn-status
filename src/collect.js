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

export async function buildSidePanel(env) {
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

  let community = { repo: COMMUNITY_REPO.repo, run: null, jobsSummary: null, error: null };
  try {
    const data = await ghFetch(
      env,
      `/repos/${ORG}/${COMMUNITY_REPO.repo}/actions/workflows/${COMMUNITY_REPO.workflowFile}/runs?branch=${COMMUNITY_REPO.branch}&per_page=1`,
    );
    const run = (data.workflow_runs || [])[0];
    if (run) {
      const jobs = await fetchRunJobs(env, ORG, COMMUNITY_REPO.repo, run.id, 3);
      const counts = { success: 0, failure: 0, cancelled: 0, in_progress: 0, other: 0 };
      for (const j of jobs) {
        const c = j.conclusion || j.status;
        if (c in counts) counts[c]++;
        else counts.other++;
      }
      community = {
        repo: COMMUNITY_REPO.repo,
        run: summarizeRun(run, null),
        jobsSummary: { total: jobs.length, counts },
        error: null,
      };
    }
  } catch (e) {
    community.error = String(e.message || e);
  }

  return {
    fetchedAt: new Date().toISOString(),
    forks,
    community,
    _disclaimer: DISCLAIMER,
  };
}
