import { DISCLAIMER } from './repos.js';

const CSS = `
:root {
  color-scheme: dark;
  --bg: #0d1117;
  --panel: #161b22;
  --panel2: #1c2128;
  --border: #30363d;
  --fg: #e6edf3;
  --muted: #8b949e;
  --accent: #58a6ff;
  --ok: #238636;
  --ok-fg: #ffffff;
  --fail: #da3633;
  --warn: #d29922;
  --warn-fg: #0d1117;
  --grey: #484f58;
}
* { box-sizing: border-box; }
html, body { margin: 0; background: var(--bg); color: var(--fg); }
body { font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
code, pre, .mono { font: 13px/1.5 ui-monospace, "SF Mono", Menlo, monospace; }
a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; }
header { padding: 16px 24px; border-bottom: 1px solid var(--border); display: flex; align-items: baseline; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
header h1 { margin: 0; font-size: 18px; font-weight: 600; }
header h1 a { color: var(--fg); }
header .meta { color: var(--muted); font-size: 12px; }
main { max-width: 1200px; margin: 0 auto; padding: 24px; }
h2 { font-size: 16px; margin: 24px 0 12px; }
section.repo { background: var(--panel); border: 1px solid var(--border); border-radius: 6px; padding: 14px 16px; margin-bottom: 18px; }
section.repo h2 { margin: 0 0 10px; display: flex; align-items: baseline; gap: 8px; }
section.repo h2 .repo-name { color: var(--muted); font-weight: 400; font-size: 13px; }
.empty { color: var(--muted); padding: 8px 0; font-style: italic; }
table { width: 100%; border-collapse: collapse; }
th, td { padding: 6px 10px; text-align: left; border-bottom: 1px solid var(--border); vertical-align: top; }
th { color: var(--muted); font-weight: 500; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; }
tr:last-child td { border-bottom: none; }
.pill { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; background: var(--grey); color: var(--fg); }
.pill.success    { background: var(--ok);   color: var(--ok-fg); }
.pill.failure,
.pill.timed_out  { background: var(--fail); color: var(--ok-fg); }
.pill.in_progress,
.pill.queued,
.pill.waiting,
.pill.requested,
.pill.pending    { background: var(--warn); color: var(--warn-fg); }
.pill.cancelled,
.pill.skipped,
.pill.neutral    { background: var(--grey); color: var(--fg); }
.jobs { margin-top: 6px; background: var(--panel2); border-radius: 4px; padding: 8px 12px; }
.jobs ul { margin: 0; padding: 0; list-style: none; }
.jobs li { padding: 3px 0; font-size: 13px; display: flex; align-items: center; gap: 8px; }
.jobs li .pill { font-size: 10px; padding: 1px 6px; }
.side { background: var(--panel); border: 1px solid var(--border); border-radius: 6px; padding: 14px 16px; }
.side .row { display: flex; align-items: center; justify-content: space-between; padding: 6px 0; gap: 8px; border-bottom: 1px solid var(--border); }
.side .row:last-child { border-bottom: none; }
.side small { color: var(--muted); }
.counts { color: var(--muted); font-size: 12px; }
.counts .ok { color: #3fb950; }
.counts .bad { color: #f85149; }
footer { color: var(--muted); padding: 24px; text-align: center; font-size: 12px; border-top: 1px solid var(--border); margin-top: 32px; }
.tag-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; }
.tag-list a { display: block; background: var(--panel); border: 1px solid var(--border); border-radius: 6px; padding: 10px 14px; }
.tag-list a:hover { border-color: var(--accent); text-decoration: none; }
.err { color: #f85149; font-size: 12px; }
`;

function escapeHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function pillFor(run) {
  const s = run.status === 'completed' ? (run.conclusion || 'neutral') : (run.status || 'unknown');
  const cls = ['success', 'failure', 'timed_out', 'in_progress', 'queued', 'waiting',
               'requested', 'pending', 'cancelled', 'skipped', 'neutral'].includes(s) ? s : '';
  return `<span class="pill ${cls}">${escapeHtml(s.replace('_', ' '))}</span>`;
}

function fmtRelative(iso) {
  if (!iso) return '';
  const diffSec = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.round(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.round(diffSec / 3600)}h ago`;
  return `${Math.round(diffSec / 86400)}d ago`;
}

function fmtDuration(startIso, endIso) {
  if (!startIso) return '';
  const end = (endIso && new Date(endIso).getTime()) || Date.now();
  const sec = Math.max(0, Math.round((end - new Date(startIso).getTime()) / 1000));
  const m = Math.floor(sec / 60), s = sec % 60;
  return m ? `${m}m ${s}s` : `${s}s`;
}

function head(title) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(title)}</title>
<link rel="icon" href="/favicon.ico">
<style>${CSS}</style>
</head>`;
}

function renderJobsList(jobs) {
  if (!jobs || !jobs.length) return '';
  const items = jobs.map(j => {
    const status = j.status === 'completed' ? (j.conclusion || 'neutral') : (j.status || 'unknown');
    return `<li>${pillFor({ status: j.status, conclusion: j.conclusion })} <a href="${escapeHtml(j.htmlUrl)}">${escapeHtml(j.name)}</a></li>`;
  }).join('');
  return `<div class="jobs"><ul>${items}</ul></div>`;
}

function renderRepoSection({ repo, label, runs, error }) {
  let body;
  if (error) {
    body = `<div class="err">error fetching: ${escapeHtml(error)}</div>`;
  } else if (!runs.length) {
    body = `<div class="empty">no runs found for this tag</div>`;
  } else {
    const rows = runs.map(r => `
      <tr>
        <td>${pillFor(r)}</td>
        <td><a href="${escapeHtml(r.htmlUrl)}">${escapeHtml(r.workflowName)}</a> <small style="color:var(--muted)">#${r.runNumber}</small></td>
        <td class="mono">${fmtRelative(r.updatedAt || r.createdAt)}</td>
        <td class="mono">${fmtDuration(r.createdAt, r.status === 'completed' ? r.updatedAt : null)}</td>
      </tr>
      ${r.jobs ? `<tr><td colspan="4">${renderJobsList(r.jobs)}</td></tr>` : ''}
    `).join('');
    body = `<table>
      <thead><tr><th>Status</th><th>Workflow</th><th>Updated</th><th>Duration</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  }
  return `<section class="repo">
    <h2>${escapeHtml(label)} <span class="repo-name">— <a href="https://github.com/Query-farm-haybarn/${escapeHtml(repo)}">${escapeHtml(repo)}</a></span></h2>
    ${body}
  </section>`;
}

function renderSidePanel(side) {
  if (!side) return `<aside class="side"><h2>Extensions snapshot</h2><div class="empty">loading…</div></aside>`;
  const forkRows = side.forks.map(f => {
    const body = f.error
      ? `<span class="err">${escapeHtml(f.error)}</span>`
      : (f.run ? `${pillFor(f.run)} <small>${fmtRelative(f.run.updatedAt || f.run.createdAt)}</small>` : `<small>no runs</small>`);
    const link = f.run ? f.run.htmlUrl : `https://github.com/Query-farm-haybarn/${f.repo}/actions`;
    return `<div class="row"><a href="${escapeHtml(link)}">${escapeHtml(f.label)}</a>${body}</div>`;
  }).join('');

  let communityRow;
  if (side.community.error) {
    communityRow = `<div class="row"><a>Community</a><span class="err">${escapeHtml(side.community.error)}</span></div>`;
  } else if (!side.community.run) {
    communityRow = `<div class="row"><a>Community</a><small>no runs</small></div>`;
  } else {
    const c = side.community.jobsSummary?.counts || {};
    const total = side.community.jobsSummary?.total || 0;
    communityRow = `<div class="row">
      <a href="${escapeHtml(side.community.run.htmlUrl)}">Community (${total} ext)</a>
      <span class="counts">${pillFor(side.community.run)}
        <span class="ok">✓ ${c.success || 0}</span>
        <span class="bad">✗ ${(c.failure || 0)}</span>
        <span>⟳ ${(c.in_progress || 0)}</span>
      </span>
    </div>`;
  }

  return `<aside class="side">
    <h2>Extensions snapshot <small style="color:var(--muted);font-weight:400">(not rc-pinned)</small></h2>
    ${forkRows}
    ${communityRow}
  </aside>`;
}

export function renderRcPage(view) {
  const sections = view.repos.map(renderRepoSection).join('');
  return `${head(`${view.tag} — haybarn-status`)}
<body>
<header>
  <h1><a href="/">haybarn-status</a> · <span class="mono">${escapeHtml(view.tag)}</span></h1>
  <div class="meta">as of ${escapeHtml(view.fetchedAt)} · <a href="">refresh</a> · <a href="/api/r/${encodeURIComponent(view.tag)}">json</a></div>
</header>
<main>
  ${sections}
  ${renderSidePanel(view.sidePanel)}
</main>
<footer>${escapeHtml(DISCLAIMER)} · <a href="https://github.com/Query-farm-haybarn">github.com/Query-farm-haybarn</a></footer>
</body></html>`;
}

export function renderIndex(tagsView) {
  const tags = (tagsView.tags || []).map(t =>
    `<a href="/r/${encodeURIComponent(t)}" class="mono">${escapeHtml(t)}</a>`
  ).join('');
  return `${head('haybarn-status')}
<body>
<header>
  <h1>haybarn-status</h1>
  <div class="meta">CI status across the Haybarn project, powered by DuckDB · as of ${escapeHtml(tagsView.fetchedAt)}</div>
</header>
<main>
  <h2>Releases</h2>
  <div class="tag-list">${tags || '<div class="empty">no haybarn-v* tags discovered yet</div>'}</div>
</main>
<footer>${escapeHtml(DISCLAIMER)} · <a href="https://github.com/Query-farm-haybarn">github.com/Query-farm-haybarn</a></footer>
</body></html>`;
}

export function renderError(message, status = 500) {
  return {
    body: `${head('error · haybarn-status')}
<body><header><h1><a href="/">haybarn-status</a></h1></header>
<main><h2>error</h2><pre>${escapeHtml(message)}</pre></main>
<footer>${escapeHtml(DISCLAIMER)}</footer></body></html>`,
    status,
  };
}
