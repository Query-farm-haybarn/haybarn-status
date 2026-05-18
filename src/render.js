import { DISCLAIMER } from './repos.js';

const LOGO_URL = 'https://raw.githubusercontent.com/Query-farm-haybarn/.github/haybarn/profile/assets/haybarn-icon.png';

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
header { padding: 14px 24px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
header .brand { display: flex; align-items: center; gap: 12px; }
header .brand img { width: 32px; height: 32px; border-radius: 6px; display: block; }
header h1 { margin: 0; font-size: 18px; font-weight: 600; line-height: 1.2; }
header h1 a { color: var(--fg); }
header h1 .tag { color: var(--muted); font-weight: 400; margin-left: 8px; }
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
.jobs { margin-top: 8px; background: var(--panel2); border-radius: 4px; padding: 10px 12px; }
.jobs-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 4px 16px; }
.job-cell { display: flex; align-items: center; gap: 8px; font-size: 12px; min-width: 0; padding: 2px 0; }
.job-cell .dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; background: var(--grey); }
.job-cell .dot.success { background: var(--ok); }
.job-cell .dot.failure, .job-cell .dot.timed_out { background: var(--fail); }
.job-cell .dot.in_progress, .job-cell .dot.queued, .job-cell .dot.pending, .job-cell .dot.waiting, .job-cell .dot.requested { background: var(--warn); animation: pulse 1.6s ease-in-out infinite; }
.job-cell .name { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--fg); }
.job-cell a.name { color: var(--accent); }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }
.side { background: var(--panel); border: 1px solid var(--border); border-radius: 6px; padding: 14px 16px; margin-bottom: 18px; }
.side h2 { margin: 0 0 10px; }
.side h2 small { color: var(--muted); font-weight: 400; font-size: 12px; }
.side .row { display: flex; align-items: center; justify-content: space-between; padding: 6px 0; gap: 8px; border-bottom: 1px solid var(--border); }
.side .row:last-child { border-bottom: none; }
.side small { color: var(--muted); }
.counts { color: var(--muted); font-size: 12px; display: inline-flex; gap: 8px; align-items: center; }
.counts .ok { color: #3fb950; }
.counts .bad { color: #f85149; }
.community-row { display: flex; align-items: center; gap: 12px; padding: 6px 0; border-bottom: 1px solid var(--border); }
.community-row:last-child { border-bottom: none; }
.community-ext { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 13px; min-width: 160px; max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.community-row .jobs-grid { flex: 1; gap: 4px 12px; }
.community-row .job-cell { font-size: 11px; }
.community-row .job-cell .dot { width: 9px; height: 9px; }

/* Community matrix table — whole-cell heat-map. Each platform cell is
   colored by its build status; the extension name and rolled-up pill
   are in fixed left columns. */
.community-table-wrap { overflow-x: auto; margin-top: 8px; }
.community-table { border-collapse: separate; border-spacing: 1px; font-size: 12px; width: 100%; background: var(--border); }
.community-table th, .community-table td { background: var(--panel); }
.community-table thead th { position: sticky; top: 0; z-index: 1; background: var(--panel2); }
.community-table th.plat { writing-mode: vertical-rl; white-space: nowrap; font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 11px; font-weight: 500; color: var(--muted); padding: 6px 4px; height: 96px; vertical-align: top; width: 18px; min-width: 18px; text-align: left; }
.community-table th.ext-head { text-align: left; padding: 6px 8px; font-weight: 500; color: var(--muted); }
.community-table td.ext { text-align: left; padding: 2px 8px; font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 12px; max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.community-table td.row-pill { padding: 2px 8px; }
.community-table td.row-pill .pill { font-size: 10px; padding: 1px 6px; }
.community-table td.cell { width: 18px; min-width: 18px; padding: 0; height: 18px; }
.community-table td.cell.success { background: var(--ok); }
.community-table td.cell.failure, .community-table td.cell.timed_out { background: var(--fail); }
.community-table td.cell.in_progress, .community-table td.cell.queued, .community-table td.cell.waiting, .community-table td.cell.pending, .community-table td.cell.requested { background: var(--warn); animation: pulse 1.6s ease-in-out infinite; }
.community-table td.cell.cancelled, .community-table td.cell.skipped, .community-table td.cell.neutral { background: var(--grey); }
.community-table td.cell.empty { background: var(--panel); color: var(--muted); text-align: center; font-size: 10px; line-height: 18px; }
.community-table tbody tr:hover td.ext, .community-table tbody tr:hover td.row-pill, .community-table tbody tr:hover td.registry { background: var(--panel2); }
/* Registry-presence + issue columns sit at the right end of each row.
   A small badge for each of npm / PyPI / filed-issue; click-throughs to
   the live registry page or upstream tracker. */
.community-table td.registry { width: 18px; min-width: 18px; padding: 0; height: 18px; text-align: center; font-size: 11px; line-height: 18px; }
.community-table td.registry a { color: inherit; text-decoration: none; display: block; height: 100%; width: 100%; }
.community-table td.registry.has { background: var(--ok); color: #fff; font-weight: 600; }
.community-table td.registry.miss { background: var(--panel); color: var(--muted); }
.community-table td.registry.warn { background: var(--warn); color: #fff; font-weight: 600; }
.community-table th.registry-head { writing-mode: vertical-rl; white-space: nowrap; font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 11px; font-weight: 500; color: var(--muted); padding: 6px 4px; height: 96px; vertical-align: top; width: 18px; min-width: 18px; text-align: left; }
.title-bar { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 10px; flex-wrap: wrap; }
.title-bar h2 { margin: 0; }
.run-link { color: var(--muted); font-size: 12px; }
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

function statusKey(r) {
  return r.status === 'completed' ? (r.conclusion || 'neutral') : (r.status || 'unknown');
}

function pillFor(run) {
  const s = statusKey(run);
  const cls = ['success', 'failure', 'timed_out', 'in_progress', 'queued', 'waiting',
               'requested', 'pending', 'cancelled', 'skipped', 'neutral'].includes(s) ? s : '';
  return `<span class="pill ${cls}">${escapeHtml(s.replace('_', ' '))}</span>`;
}

// Reusable-workflow job names look like:
//   "Build extensions / Build / Linux (linux_amd64, ubuntu-24.04, x64-linux-release, ...)"
//   "Build extensions / Build / DuckDB-Wasm (wasm_eh, wasm32-emscripten, x64-linux, ...)"
// The first paren token is the platform triplet that uniquely identifies the leg.
// For simpler matrix names ("Linux amd64", "macOS (universal)"), fall back to the
// last "/"-segment or the original string.
function shortJobLabel(name) {
  const m = name.match(/\(\s*([A-Za-z0-9_.-]+)/);
  if (m) return m[1];
  const parts = name.split(/\s*\/\s*/);
  return parts[parts.length - 1];
}

// Community-extensions job names take a few shapes depending on how the
// workflow's matrix-of-matrices is configured. We extract an (extension,
// platform) tuple by trying these patterns, in order:
//   "build (extname) / build / Linux (linux_amd64, ...)"  → ext=extname, plat=linux_amd64
//   "build_extname / Linux (linux_amd64, ...)"             → ext=extname, plat=linux_amd64
//   "build / Linux (linux_amd64, ...)"                     → ext=null,    plat=linux_amd64
// Today the catalog has a single smoke extension so the third shape is what
// we mostly see; the first two activate once sync_from_upstream lands.
function parseCommunityJob(name) {
  let extension = null;
  let rest = name;
  const parenExt = name.match(/^([\w-]+)\s*\(([^)]+)\)/);
  if (parenExt && !/[,_]/.test(parenExt[2])) {
    // "build (extname) / ..."  — only treat the inner as an ext name when it
    // doesn't look like a vcpkg-style triplet (no underscores, no commas).
    extension = parenExt[2].trim();
    rest = name.slice(parenExt[0].length);
  } else {
    const underscoreExt = name.match(/^build_([\w-]+)\s*\//);
    if (underscoreExt) {
      extension = underscoreExt[1];
      rest = name.slice(underscoreExt[0].length);
    }
  }
  const platMatch = rest.match(/\(\s*([A-Za-z0-9_.-]+)/);
  const platform = platMatch ? platMatch[1] : shortJobLabel(rest);
  return { extension, platform };
}

function groupCommunityJobs(jobs) {
  const groups = new Map();
  for (const j of jobs) {
    const parsed = parseCommunityJob(j.name);
    const key = parsed.extension || '(combined)';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ ...j, _platform: parsed.platform });
  }
  return groups;
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
  const cells = jobs.map(j => {
    const s = statusKey(j);
    const cls = ['success', 'failure', 'timed_out', 'in_progress', 'queued',
                 'waiting', 'requested', 'pending', 'cancelled', 'skipped', 'neutral'].includes(s) ? s : '';
    const label = shortJobLabel(j.name);
    const nameTag = j.htmlUrl
      ? `<a class="name" href="${escapeHtml(j.htmlUrl)}">${escapeHtml(label)}</a>`
      : `<span class="name">${escapeHtml(label)}</span>`;
    return `<div class="job-cell" title="${escapeHtml(j.name)} — ${escapeHtml(s.replace('_', ' '))}"><span class="dot ${cls}"></span>${nameTag}</div>`;
  }).join('');
  return `<div class="jobs"><div class="jobs-grid">${cells}</div></div>`;
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

function renderForkPanel(forks) {
  const rows = forks.map(f => {
    const body = f.error
      ? `<span class="err">${escapeHtml(f.error)}</span>`
      : (f.run ? `${pillFor(f.run)} <small>${fmtRelative(f.run.updatedAt || f.run.createdAt)}</small>` : `<small>no runs</small>`);
    const link = f.run ? f.run.htmlUrl : `https://github.com/Query-farm-haybarn/${f.repo}/actions`;
    return `<div class="row"><a href="${escapeHtml(link)}">${escapeHtml(f.label)}</a>${body}</div>`;
  }).join('');
  return `<aside class="side">
    <h2>Build-fork extensions <small>(not rc-pinned)</small></h2>
    ${rows}
  </aside>`;
}

function renderCommunityJobCell(j) {
  const s = statusKey(j);
  const cls = ['success', 'failure', 'timed_out', 'in_progress', 'queued',
               'waiting', 'requested', 'pending', 'cancelled', 'skipped', 'neutral'].includes(s) ? s : '';
  const label = j._platform || shortJobLabel(j.name);
  const nameTag = j.htmlUrl
    ? `<a class="name" href="${escapeHtml(j.htmlUrl)}">${escapeHtml(label)}</a>`
    : `<span class="name">${escapeHtml(label)}</span>`;
  return `<div class="job-cell" title="${escapeHtml(j.name)} — ${escapeHtml(s.replace('_', ' '))}"><span class="dot ${cls}"></span>${nameTag}</div>`;
}

// Canonical ordering for the community matrix's platform columns. The
// renderer discovers actual platforms from the data and keeps any that
// don't fit this list at the end (sorted alphabetically) — so unfamiliar
// platforms surface without code changes.
const PLATFORM_COLUMN_ORDER = [
  'linux_amd64',
  'linux_arm64',
  'linux_amd64_musl',
  'linux_arm64_musl',
  'osx_amd64',
  'osx_arm64',
  'windows_amd64',
  'windows_amd64_mingw',
  'wasm_eh',
  'wasm_mvp',
  'wasm_threads',
];

function dotClassForStatusKey(s) {
  return ['success', 'failure', 'timed_out', 'in_progress', 'queued',
          'waiting', 'requested', 'pending', 'cancelled', 'skipped',
          'neutral'].includes(s) ? s : '';
}

function renderCommunitySection(c) {
  if (!c) return '';
  if (c.error) {
    return `<section class="repo"><h2>Community extensions <span class="repo-name">(not rc-pinned)</span></h2>
      <div class="err">${escapeHtml(c.error)}</div></section>`;
  }
  const exts = c.extensions || [];
  if (!exts.length) {
    return `<section class="repo"><h2>Community extensions <span class="repo-name">(not rc-pinned)</span></h2>
      <div class="empty">no extension data found</div></section>`;
  }

  // Index each extension's jobs by platform and aggregate stats in one pass.
  let okC = 0, failC = 0, ipC = 0, totalC = 0;
  const seenPlatforms = new Set();
  const indexed = exts.map(ext => {
    const byPlat = new Map();
    for (const j of (ext.jobs || [])) {
      const plat = parseCommunityJob(j.name).platform;
      if (!plat) continue;
      seenPlatforms.add(plat);
      byPlat.set(plat, j);
      totalC++;
      const s = statusKey(j);
      if (s === 'success') okC++;
      else if (s === 'failure' || s === 'timed_out') failC++;
      else if (s === 'in_progress' || s === 'queued' || s === 'pending' || s === 'waiting') ipC++;
    }
    return { ...ext, byPlat };
  });

  // Order the column list: canonical ones first (in order), then anything
  // unfamiliar alphabetically.
  const known = PLATFORM_COLUMN_ORDER.filter(p => seenPlatforms.has(p));
  const extras = [...seenPlatforms].filter(p => !PLATFORM_COLUMN_ORDER.includes(p)).sort();
  const columns = [...known, ...extras];

  const sourceLink = c.sourceRunUrl
    ? `<a class="run-link" href="${escapeHtml(c.sourceRunUrl)}">build_all run</a>`
    : '';

  // Per-extension registry presence (npm, PyPI) and upstream-tracker
  // markers. May be undefined when the cron hasn't pre-warmed yet — in
  // which case we render the columns greyed out.
  const reg = (c && c.registries) || null;
  const presence = reg ? (reg.presence || {}) : {};
  const knownIssues = reg ? (reg.knownIssues || {}) : {};

  const head = `<thead><tr>
      <th class="ext-head">Extension</th>
      <th class="ext-head">Status</th>
      ${columns.map(p => `<th class="plat">${escapeHtml(p)}</th>`).join('')}
      <th class="registry-head">npm</th>
      <th class="registry-head">PyPI</th>
      <th class="registry-head">issue</th>
    </tr></thead>`;

  function registryCell(info, kind) {
    // info: { exists, latest, url } | null/undefined
    if (!info) return `<td class="registry miss" title="${kind}: unknown / not yet probed">·</td>`;
    if (!info.exists) return `<td class="registry miss" title="${kind}: not published">·</td>`;
    const v = info.latest || '(no version)';
    const label = kind === 'npm' ? 'n' : 'p';
    return `<td class="registry has" title="${kind} ${escapeHtml(v)}"><a href="${escapeHtml(info.url || '#')}" rel="noopener" target="_blank">${label}</a></td>`;
  }

  function issueCell(extName) {
    const i = knownIssues[extName];
    if (!i) return `<td class="registry miss" title="no filed upstream issue">·</td>`;
    if (!i.url) return `<td class="registry warn" title="${escapeHtml(i.why || 'tracker noted, no URL')}">!</td>`;
    return `<td class="registry warn" title="${escapeHtml(i.why || 'upstream issue filed')}"><a href="${escapeHtml(i.url)}" rel="noopener" target="_blank">!</a></td>`;
  }

  // Per-cell HTML kept tight: a single <td> with the status class and a
  // short title= attribute for hover. 242 extensions × ~11 columns means
  // ~2700 cells — each saved byte cuts ~3KB off the served page. The
  // extension name in column 1 still links to its full job list.
  const body = `<tbody>${indexed.map(ext => {
    const cells = columns.map(p => {
      const j = ext.byPlat.get(p);
      if (!j) return `<td class="cell empty">·</td>`;
      const s = statusKey(j);
      const cls = dotClassForStatusKey(s);
      // Title omits the extension name (already in the row) — just plat+status.
      return `<td class="cell dot ${cls}" title="${escapeHtml(p)}: ${escapeHtml(s.replace('_', ' '))}"></td>`;
    }).join('');
    const extPresence = presence[ext.name] || {};
    const regCells = registryCell(extPresence.npm, 'npm')
                   + registryCell(extPresence.pypi, 'PyPI')
                   + issueCell(ext.name);
    return `<tr><td class="ext"><a href="${escapeHtml(ext.run.htmlUrl)}">${escapeHtml(ext.name)}</a></td><td class="row-pill">${pillFor(ext.run)}</td>${cells}${regCells}</tr>`;
  }).join('')}</tbody>`;

  return `<section class="repo">
    <div class="title-bar">
      <h2>Community extensions <span class="repo-name">— ${exts.length} extensions, ${totalC} platform legs${sourceLink ? ' · ' : ''}${sourceLink}</span></h2>
      <span class="counts">
        <span class="ok">✓ ${okC}</span>
        <span class="bad">✗ ${failC}</span>
        ${ipC ? `<span>⟳ ${ipC}</span>` : ''}
      </span>
    </div>
    <div class="community-table-wrap">
      <table class="community-table">
        ${head}
        ${body}
      </table>
    </div>
  </section>`;
}

function renderSidePanel(side) {
  if (!side) return `<aside class="side"><h2>Extensions snapshot</h2><div class="empty">loading…</div></aside>`;
  return `${renderForkPanel(side.forks)}${renderCommunitySection(side.community)}`;
}

export function renderRcPage(view) {
  const sections = view.repos.map(renderRepoSection).join('');
  return `${head(`${view.tag} — haybarn-status`)}
<body>
<header>
  <div class="brand">
    <a href="/" aria-label="haybarn-status"><img src="${LOGO_URL}" alt="" /></a>
    <h1><a href="/">haybarn-status</a><span class="tag mono">${escapeHtml(view.tag)}</span></h1>
  </div>
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
  <div class="brand">
    <img src="${LOGO_URL}" alt="" />
    <h1>haybarn-status</h1>
  </div>
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
<body><header><div class="brand"><img src="${LOGO_URL}" alt="" /><h1><a href="/">haybarn-status</a></h1></div></header>
<main><h2>error</h2><pre>${escapeHtml(message)}</pre></main>
<footer>${escapeHtml(DISCLAIMER)}</footer></body></html>`,
    status,
  };
}
