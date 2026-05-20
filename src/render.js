import { DISCLAIMER, parseVersionFromTag } from './repos.js';

// Haybarn icon hosted on the org .github repo (the query.farm/haybarn/ asset
// isn't live yet — the Astro site that hosts it hasn't deployed).
const LOGO_URL = 'https://raw.githubusercontent.com/Query-farm-haybarn/.github/haybarn/profile/assets/haybarn-icon.png';

const CSS = `
:root {
  color-scheme: light;
  --bg: #f7f6f4;          /* soil-50  — page background */
  --panel: #ffffff;        /* card surface */
  --panel2: #faf9f7;       /* subtle nested panel */
  --border: #d3cab9;       /* soil-200 */
  --fg: #3d342a;           /* soil-900 — text */
  --muted: #705e41;        /* soil-600 */
  --accent: #15803d;       /* harvest-700 — links */
  --accent-hover: #166534; /* harvest-800 */
  --earth50: #f9f7f4;
  --earth700: #725843;
  --soil100: #e8e4df;
  --soil900: #3d342a;
  --ok: #16a34a;           /* harvest-600 */
  --ok-fg: #ffffff;
  --fail: #dc2626;
  --warn: #d97706;         /* duck-600 amber */
  --warn-fg: #ffffff;
  --grey: #cab89d;         /* earth-300 — neutral */
  --font-sans: 'Inter', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
  --font-display: 'Outfit', 'Inter', sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, "SF Mono", Menlo, monospace;
}
* { box-sizing: border-box; }
html, body { margin: 0; background: var(--bg); color: var(--fg); }
body { font-family: var(--font-sans); font-size: 14px; line-height: 1.55; -webkit-font-smoothing: antialiased; }
code, pre, .mono { font-family: var(--font-mono); font-size: 13px; line-height: 1.5; }
a { color: var(--accent); text-decoration: none; }
a:hover { color: var(--accent-hover); text-decoration: underline; }
h1, h2, h3 { font-family: var(--font-display); font-weight: 600; letter-spacing: -0.01em; color: var(--fg); }
header { position: sticky; top: 0; z-index: 50; background: rgba(255,255,255,0.95); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); padding: 12px 24px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; box-shadow: 0 1px 2px rgba(0,0,0,0.04); }
header .brand { display: flex; align-items: center; gap: 12px; }
header .brand img { width: 34px; height: 34px; border-radius: 8px; object-fit: contain; display: block; }
header h1 { margin: 0; font-size: 19px; font-weight: 700; line-height: 1.2; }
header h1 a { color: var(--fg); }
header h1 a:hover { color: var(--earth700); text-decoration: none; }
header h1 .tag { display: inline-block; margin-left: 10px; padding: 2px 9px; border-radius: 999px; background: var(--earth50); border: 1px solid var(--border); color: var(--earth700); font-family: var(--font-mono); font-size: 12px; font-weight: 500; letter-spacing: 0; }
header .meta { color: var(--muted); font-size: 12px; }
.snd-toggle { font: inherit; font-size: 12px; color: var(--accent); background: none; border: none; padding: 0; cursor: pointer; }
.snd-toggle:hover { color: var(--accent-hover); text-decoration: underline; }
.snd-toggle[aria-pressed="true"] { color: var(--ok); font-weight: 600; }
main { max-width: 1024px; margin: 0 auto; padding: 28px 24px 8px; }
h2 { font-size: 17px; margin: 24px 0 12px; }
section.repo { background: var(--panel); border: 1px solid var(--border); border-radius: 12px; padding: 16px 18px; margin-bottom: 18px; box-shadow: 0 1px 2px rgba(0,0,0,0.04); }
section.repo h2 { margin: 0 0 12px; display: flex; align-items: baseline; gap: 8px; }
section.repo h2 .repo-name { color: var(--muted); font-weight: 400; font-size: 13px; font-family: var(--font-sans); }
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
.counts .ok { color: #16a34a; }
.counts .bad { color: #dc2626; }
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
.community-table th.plat { white-space: nowrap; padding: 6px 4px; height: 110px; vertical-align: bottom; width: 20px; min-width: 20px; text-align: center; }
.community-table th.plat .plat-text { writing-mode: vertical-rl; font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 11px; font-weight: 500; color: var(--muted); display: inline-block; }
.plat-ico { display: inline-flex; align-items: center; color: var(--earth700); }
.plat-svg { width: 14px; height: 14px; display: block; }
.community-table th.plat .plat-ico { display: block; width: 16px; margin: 0 auto 4px; }
.community-table th.plat .plat-svg { width: 15px; height: 15px; margin: 0 auto; }
.community-table td.ext .plat-ico { margin-right: 6px; }
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
footer { background: var(--soil900); color: var(--soil100); padding: 28px 24px; text-align: center; font-size: 12px; margin-top: 36px; }
footer a { color: #cab89d; }
footer a:hover { color: #ffffff; }
.tag-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; margin-bottom: 8px; }
.tag-list a { display: block; background: var(--panel); border: 1px solid var(--border); border-radius: 6px; padding: 10px 14px; }
.tag-list a:hover { border-color: var(--accent); text-decoration: none; }
.version-group { margin: 20px 0 8px; font-size: 15px; color: var(--muted); border-bottom: 1px solid var(--border); padding-bottom: 4px; }
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
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap">
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

// Map a GitHub runner / OS token to a canonical platform label, matching the
// community matrix's column vocabulary. Order matters: arm/Intel hints are
// checked before the generic OS fallback.
function runnerToPlatform(token) {
  const t = String(token || '').toLowerCase();
  if (/ubuntu|linux/.test(t)) return /arm|aarch64/.test(t) ? 'linux_arm64' : 'linux_amd64';
  if (/windows|win/.test(t))  return /arm|aarch64/.test(t) ? 'windows_arm64' : 'windows_amd64';
  if (/mac|osx|darwin/.test(t)) {
    return /-13|_13|amd64|x86|x64|intel/.test(t) ? 'osx_amd64' : 'osx_arm64';
  }
  return null;
}

// Parse a matrix job name of the form "<label> <runner> / <variant>" (e.g.
// "Wheels ubuntu-24.04 / cp313") into { platform, variant }. Returns null when
// the name doesn't carry both a recognizable platform and a variant.
function parsePlatformMatrixJob(name) {
  if (!name) return null;
  const idx = name.indexOf(' / ');
  if (idx === -1) return null;
  let left = name.slice(0, idx).trim().replace(/^(wheels?|build|test)\s+/i, '');
  const variant = name.slice(idx + 3).trim();
  const platform = runnerToPlatform(left);
  if (!platform || !variant) return null;
  return { platform, variant };
}

// Render a run's jobs. When ≥2 jobs parse into a platform × variant matrix
// (e.g. Python wheels: platform rows, Python-version columns) render a grid
// reusing the community-table styling; remaining non-matrix jobs (sdist,
// "Derive version", …) render above it as the usual flat list. Falls back to
// the flat list entirely when there's no matrix to speak of.
function renderRunJobs(jobs) {
  if (!jobs || !jobs.length) return '';
  const matrix = [];
  const other = [];
  for (const j of jobs) {
    const p = parsePlatformMatrixJob(j.name);
    if (p) matrix.push({ ...p, job: j });
    else other.push(j);
  }
  if (matrix.length < 2) return renderJobsList(jobs);

  const platSet = new Set(matrix.map(m => m.platform));
  const known = PLATFORM_COLUMN_ORDER.filter(p => platSet.has(p));
  const extras = [...platSet].filter(p => !PLATFORM_COLUMN_ORDER.includes(p)).sort();
  const platforms = [...known, ...extras];
  const variants = [...new Set(matrix.map(m => m.variant))]
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const cellMap = new Map();
  for (const m of matrix) cellMap.set(`${m.platform} ${m.variant}`, m.job);

  const head = `<thead><tr><th class="ext-head"></th>${
    variants.map(v => `<th class="plat">${escapeHtml(v)}</th>`).join('')
  }</tr></thead>`;
  const rows = platforms.map(p => {
    const cells = variants.map(v => {
      const j = cellMap.get(`${p} ${v}`);
      if (!j) return `<td class="cell empty">·</td>`;
      const s = statusKey(j);
      const cls = dotClassForStatusKey(s);
      return `<td class="cell dot ${cls}" title="${escapeHtml(p)} ${escapeHtml(v)}: ${escapeHtml(s.replace('_', ' '))}"></td>`;
    }).join('');
    return `<tr><td class="ext">${platformIcon(p)}${escapeHtml(p)}</td>${cells}</tr>`;
  }).join('');

  const grid = `<div class="community-table-wrap"><table class="community-table">${head}<tbody>${rows}</tbody></table></div>`;
  return (other.length ? renderJobsList(other) : '') + grid;
}

// Pretty per-OS icons for platform labels. Emoji keep it dependency-free and
// render crisply in both the rotated community-matrix column heads and the
// horizontal Python-grid row heads. The full platform string stays as the
// (rotated) text / tooltip so nothing is lost.
function platformFamily(p) {
  const s = String(p || '');
  if (s.startsWith('linux')) return 'linux';
  if (s.startsWith('osx') || s.startsWith('macos')) return 'osx';
  if (s.startsWith('windows') || s.startsWith('win')) return 'windows';
  if (s.startsWith('wasm')) return 'wasm';
  return null;
}
function platformIcon(p) {
  const fam = platformFamily(p);
  return fam
    ? `<span class="plat-ico" title="${escapeHtml(p)}"><svg class="plat-svg" aria-hidden="true"><use href="#plat-${fam}"></use></svg></span>`
    : '';
}

// One-time SVG <symbol> sprite (authentic simple-icons brand logos, currentColor)
// referenced by platformIcon via <use>. Injected once per rc page.
const PLAT_SPRITE = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
<symbol id="plat-linux" viewBox="0 0 24 24"><path fill="currentColor" d="M12.504 0q-.232 0-.48.021c-4.226.333-3.105 4.807-3.17 6.298c-.076 1.092-.3 1.953-1.05 3.02c-.885 1.051-2.127 2.75-2.716 4.521c-.278.832-.41 1.684-.287 2.489a.4.4 0 0 0-.11.135c-.26.268-.45.6-.663.839c-.199.199-.485.267-.797.4c-.313.136-.658.269-.864.68c-.09.189-.136.394-.132.602c0 .199.027.4.055.536c.058.399.116.728.04.97c-.249.68-.28 1.145-.106 1.484c.174.334.535.47.94.601c.81.2 1.91.135 2.774.6c.926.466 1.866.67 2.616.47c.526-.116.97-.464 1.208-.946c.587-.003 1.23-.269 2.26-.334c.699-.058 1.574.267 2.577.2c.025.134.063.198.114.333l.003.003c.391.778 1.113 1.132 1.884 1.071s1.592-.536 2.257-1.306c.631-.765 1.683-1.084 2.378-1.503c.348-.199.629-.469.649-.853c.023-.4-.2-.811-.714-1.376v-.097l-.003-.003c-.17-.2-.25-.535-.338-.926c-.085-.401-.182-.786-.492-1.046h-.003c-.059-.054-.123-.067-.188-.135a.36.36 0 0 0-.19-.064c.431-1.278.264-2.55-.173-3.694c-.533-1.41-1.465-2.638-2.175-3.483c-.796-1.005-1.576-1.957-1.56-3.368c.026-2.152.236-6.133-3.544-6.139m.529 3.405h.013c.213 0 .396.062.584.198c.19.135.33.332.438.533c.105.259.158.459.166.724c0-.02.006-.04.006-.06v.105l-.004-.021l-.004-.024a1.8 1.8 0 0 1-.15.706a.95.95 0 0 1-.213.335a1 1 0 0 0-.088-.042c-.104-.045-.198-.064-.284-.133a1.3 1.3 0 0 0-.22-.066c.05-.06.146-.133.183-.198q.08-.193.088-.402v-.02a1.2 1.2 0 0 0-.061-.4c-.045-.134-.101-.2-.183-.333c-.084-.066-.167-.132-.267-.132h-.016c-.093 0-.176.03-.262.132a.8.8 0 0 0-.205.334a1.2 1.2 0 0 0-.09.4v.019q.002.134.02.267c-.193-.067-.438-.135-.607-.202a2 2 0 0 1-.018-.2v-.02a1.8 1.8 0 0 1 .15-.768a1.08 1.08 0 0 1 .43-.533a1 1 0 0 1 .594-.2zm-2.962.059h.036c.142 0 .27.048.399.135c.146.129.264.288.344.465c.09.199.14.4.153.667v.004c.007.134.006.2-.002.266v.08c-.03.007-.056.018-.083.024c-.152.055-.274.135-.393.2q.018-.136.003-.267v-.015c-.012-.133-.04-.2-.082-.333a.6.6 0 0 0-.166-.267a.25.25 0 0 0-.183-.064h-.021c-.071.006-.13.04-.186.132a.55.55 0 0 0-.12.27a1 1 0 0 0-.023.33v.015c.012.135.037.2.08.334c.046.134.098.2.166.268q.014.014.034.024c-.07.057-.117.07-.176.136a.3.3 0 0 1-.131.068a2.6 2.6 0 0 1-.275-.402a1.8 1.8 0 0 1-.155-.667a1.8 1.8 0 0 1 .08-.668a1.4 1.4 0 0 1 .283-.535c.128-.133.26-.2.418-.2m1.37 1.706c.332 0 .733.065 1.216.399c.293.2.523.269 1.052.468h.003c.255.136.405.266.478.399v-.131a.57.57 0 0 1 .016.47c-.123.31-.516.643-1.063.842v.002c-.268.135-.501.333-.775.465c-.276.135-.588.292-1.012.267a1.1 1.1 0 0 1-.448-.067a4 4 0 0 1-.322-.198c-.195-.135-.363-.332-.612-.465v-.005h-.005c-.4-.246-.616-.512-.686-.71q-.104-.403.193-.6c.224-.135.38-.271.483-.336c.104-.074.143-.102.176-.131h.002v-.003c.169-.202.436-.47.839-.601c.139-.036.294-.065.466-.065zm2.8 2.142c.358 1.417 1.196 3.475 1.735 4.473c.286.534.855 1.659 1.102 3.024c.156-.005.33.018.513.064c.646-1.671-.546-3.467-1.089-3.966c-.22-.2-.232-.335-.123-.335c.59.534 1.365 1.572 1.646 2.757c.13.535.16 1.104.021 1.67c.067.028.135.06.205.067c1.032.534 1.413.938 1.23 1.537v-.043c-.06-.003-.12 0-.18 0h-.016c.151-.467-.182-.825-1.065-1.224c-.915-.4-1.646-.336-1.77.465c-.008.043-.013.066-.018.135c-.068.023-.139.053-.209.064c-.43.268-.662.669-.793 1.187c-.13.533-.17 1.156-.205 1.869v.003c-.02.334-.17.838-.319 1.35c-1.5 1.072-3.58 1.538-5.348.334a2.7 2.7 0 0 0-.402-.533a1.5 1.5 0 0 0-.275-.333c.182 0 .338-.03.465-.067a.62.62 0 0 0 .314-.334c.108-.267 0-.697-.345-1.163s-.931-.995-1.788-1.521c-.63-.4-.986-.87-1.15-1.396c-.165-.534-.143-1.085-.015-1.645c.245-1.07.873-2.11 1.274-2.763c.107-.065.037.135-.408.974c-.396.751-1.14 2.497-.122 3.854a8.1 8.1 0 0 1 .647-2.876c.564-1.278 1.743-3.504 1.836-5.268c.048.036.217.135.289.202c.218.133.38.333.59.465c.21.201.477.335.876.335q.058.005.11.006c.412 0 .73-.134.997-.268c.29-.134.52-.334.74-.4h.005c.467-.135.835-.402 1.044-.7zm2.185 8.958c.037.6.343 1.245.882 1.377c.588.134 1.434-.333 1.791-.765l.211-.01c.315-.007.577.01.847.268l.003.003c.208.199.305.53.391.876c.085.4.154.78.409 1.066c.486.527.645.906.636 1.14l.003-.007v.018l-.003-.012c-.015.262-.185.396-.498.595c-.63.401-1.746.712-2.457 1.57c-.618.737-1.37 1.14-2.036 1.191c-.664.053-1.237-.2-1.574-.898l-.005-.003c-.21-.4-.12-1.025.056-1.69c.176-.668.428-1.344.463-1.897c.037-.714.076-1.335.195-1.814c.12-.465.308-.797.641-.984l.045-.022zm-10.814.049h.01q.08 0 .157.014c.376.055.706.333 1.023.752l.91 1.664l.003.003c.243.533.754 1.064 1.189 1.637c.434.598.77 1.131.729 1.57v.006c-.057.744-.48 1.148-1.125 1.294c-.645.135-1.52.002-2.395-.464c-.968-.536-2.118-.469-2.857-.602q-.553-.1-.723-.4c-.11-.2-.113-.602.123-1.23v-.004l.002-.003c.117-.334.03-.752-.027-1.118c-.055-.401-.083-.71.043-.94c.16-.334.396-.4.69-.533c.294-.135.64-.202.915-.47h.002v-.002c.256-.268.445-.601.668-.838c.19-.201.38-.336.663-.336m7.159-9.074c-.435.201-.945.535-1.488.535c-.542 0-.97-.267-1.28-.466c-.154-.134-.28-.268-.373-.335c-.164-.134-.144-.333-.074-.333c.109.016.129.134.199.2c.096.066.215.2.36.333c.292.2.68.467 1.167.467c.485 0 1.053-.267 1.398-.466c.195-.135.445-.334.648-.467c.156-.136.149-.267.279-.267c.128.016.034.134-.147.332a8 8 0 0 1-.69.468zm-1.082-1.583V5.64c-.006-.02.013-.042.029-.05c.074-.043.18-.027.26.004c.063 0 .16.067.15.135c-.006.049-.085.066-.135.066c-.055 0-.092-.043-.141-.068c-.052-.018-.146-.008-.163-.065m-.551 0c-.02.058-.113.049-.166.066c-.047.025-.086.068-.14.068c-.05 0-.13-.02-.136-.068c-.01-.066.088-.133.15-.133c.08-.031.184-.047.259-.005c.019.009.036.03.03.05v.02h.003z"/></symbol>
<symbol id="plat-osx" viewBox="0 0 24 24"><path fill="currentColor" d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04c-2.04.027-3.91 1.183-4.961 3.014c-2.117 3.675-.546 9.103 1.519 12.09c1.013 1.454 2.208 3.09 3.792 3.039c1.52-.065 2.09-.987 3.935-.987c1.831 0 2.35.987 3.96.948c1.637-.026 2.676-1.48 3.676-2.948c1.156-1.688 1.636-3.325 1.662-3.415c-.039-.013-3.182-1.221-3.22-4.857c-.026-3.04 2.48-4.494 2.597-4.559c-1.429-2.09-3.623-2.324-4.39-2.376c-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83c-1.207.052-2.662.805-3.532 1.818c-.78.896-1.454 2.338-1.273 3.714c1.338.104 2.715-.688 3.559-1.701"/></symbol>
<symbol id="plat-windows" viewBox="0 0 24 24"><path fill="currentColor" d="M0 0h11.377v11.372H0Zm12.623 0H24v11.372H12.623ZM0 12.623h11.377V24H0Zm12.623 0H24V24H12.623"/></symbol>
<symbol id="plat-wasm" viewBox="0 0 24 24"><path fill="currentColor" d="M14.745 0v.129a2.752 2.752 0 1 1-5.504 0V0H0v24h24V0zm-3.291 21.431l-1.169-5.783h-.02l-1.264 5.783H7.39l-1.824-8.497h1.59l1.088 5.783h.02l1.311-5.783h1.487l1.177 5.854h.02l1.242-5.854h1.561l-2.027 8.497zm8.755 0l-.542-1.891h-2.861l-.417 1.891h-1.59l2.056-8.497h2.509l2.5 8.497zm-2.397-6.403l-.694 3.118h2.159l-.796-3.118z"/></symbol>
</defs></svg>`;

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
      ${r.jobs ? `<tr><td colspan="4">${renderRunJobs(r.jobs)}</td></tr>` : ''}
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
  const REPO_LINK = '<a href="https://github.com/Query-farm-haybarn/haybarn-community-extensions">haybarn-community-extensions</a>';
  if (c.error) {
    return `<section class="repo"><h2>Community extensions <span class="repo-name">— ${REPO_LINK}</span></h2>
      <div class="err">${escapeHtml(c.error)}</div></section>`;
  }
  const exts = c.extensions || [];
  if (!exts.length) {
    return `<section class="repo"><h2>Community extensions <span class="repo-name">— ${REPO_LINK}</span></h2>
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
      ${columns.map(p => `<th class="plat" title="${escapeHtml(p)}">${platformIcon(p)}<span class="plat-text">${escapeHtml(p)}</span></th>`).join('')}
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
    // Catalog enumeration now surfaces extensions with no CI run yet (run: null) —
    // render those without an Actions-run hyperlink and with a muted placeholder
    // pill rather than crashing on ext.run.htmlUrl.
    const nameCell = ext.run
      ? `<a href="${escapeHtml(ext.run.htmlUrl)}">${escapeHtml(ext.name)}</a>`
      : escapeHtml(ext.name);
    const pillCell = ext.run ? pillFor(ext.run) : `<span class="pill" style="background:#21262d;color:#8b949e">—</span>`;
    return `<tr><td class="ext">${nameCell}</td><td class="row-pill">${pillCell}</td>${cells}${regCells}</tr>`;
  }).join('')}</tbody>`;

  return `<section class="repo">
    <div class="title-bar">
      <h2>Community extensions <span class="repo-name">— ${REPO_LINK} · ${exts.length} extensions, ${totalC} platform legs${sourceLink ? ' · ' : ''}${sourceLink}</span></h2>
      <span class="counts">
        <span class="ok">✓ ${okC}</span>
        <span class="bad">✗ ${failC}</span>
        ${ipC ? `<span>⟳ ${ipC}</span>` : ''}
        ${c.unattributedInflight ? `<span title="build.yml runs queued/in progress without an extension_name input — can't map to a specific extension. Dispatch with extension_name (run-name '🐤 &lt;ext&gt;') to label them.">⟳ ${c.unattributedInflight}${c.scannedRuns >= 100 ? '+' : ''} building (unlabeled)</span>` : ''}
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

// Client-side build-completion chimes. Polls the page's own JSON API, diffs
// run/extension conclusions against the previous snapshot, and plays a synth
// bell (Web Audio — no audio files) when builds transition to success/failure.
// Sounds are opt-in via a toggle (browsers require a user gesture to unlock
// audio) and debounced to one chime per poll per outcome.
function soundScript(tag) {
  const apiUrl = `/api/r/${encodeURIComponent(tag)}`;
  return `<script>(function(){
  var API = ${JSON.stringify(apiUrl)}, POLL_MS = 20000;
  var btn = document.getElementById('snd');
  if (!btn || !(window.AudioContext || window.webkitAudioContext)) { if (btn) btn.style.display='none'; return; }
  var ctx = null, on = false, prev = null, lastSig = null;

  function unlock(){ if(!ctx) ctx = new (window.AudioContext||window.webkitAudioContext)(); if(ctx.state==='suspended') ctx.resume(); return ctx; }

  // One bell-like note: sine fundamental + soft harmonic partials, fast attack,
  // exponential decay.
  function note(freq, t0, dur, peak){
    var parts = [[1,1],[2,0.45],[3,0.2]];
    for (var i=0;i<parts.length;i++){
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type='sine'; o.frequency.value = freq*parts[i][0];
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(peak*parts[i][1], t0+0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0+dur);
      o.connect(g); g.connect(ctx.destination);
      o.start(t0); o.stop(t0+dur+0.05);
    }
  }
  function chime(kind){
    var c = unlock(), t = c.currentTime + 0.03;
    if (kind==='success'){            // bright ascending major triad
      note(523.25,t,0.6,0.15); note(659.25,t+0.10,0.6,0.15); note(783.99,t+0.20,0.85,0.17);
    } else {                          // gentle descending two-note 'uh-oh'
      note(415.30,t,0.7,0.15); note(311.13,t+0.17,0.95,0.15);
    }
  }
  function flashTitle(msg){ var base = document.title; document.title = msg; setTimeout(function(){ document.title = base; }, 4000); }

  // Map every run/extension to 'pending' | 'ok' | 'bad' | 'other'.
  function snap(d){
    var m = {};
    function add(k, st, c){ if (st!=='completed'){ m[k]='pending'; return; } m[k] = c==='success' ? 'ok' : (c==='failure'||c==='timed_out' ? 'bad' : 'other'); }
    (d.repos||[]).forEach(function(r){ (r.runs||[]).forEach(function(run){ add('run:'+run.id, run.status, run.conclusion); }); });
    var sp = d.sidePanel||{};
    (sp.forks||[]).forEach(function(f){ if(f.run) add('fork:'+f.run.id, f.run.status, f.run.conclusion); });
    var cm = sp.community||{};
    (cm.extensions||[]).forEach(function(e){ if(e.run) add('ext:'+e.name, e.run.status, e.run.conclusion); });
    return m;
  }
  // Fine-grained signature of everything we render (run + job statuses),
  // excluding the fetch timestamp — used to decide when to auto-refresh.
  function sig(d){
    var p = [];
    function r(pre, run){ if(run) p.push(pre+':'+run.id+'='+run.status+'/'+(run.conclusion||'')); }
    (d.repos||[]).forEach(function(rp){ (rp.runs||[]).forEach(function(rn){ r('r',rn); (rn.jobs||[]).forEach(function(j){ p.push('rj:'+rn.id+':'+j.name+'='+j.status+'/'+(j.conclusion||'')); }); }); });
    var sp = d.sidePanel||{};
    (sp.forks||[]).forEach(function(f){ r('f', f.run); });
    var cm = sp.community||{};
    (cm.extensions||[]).forEach(function(e){ if(e.run) p.push('e:'+e.name+'='+e.run.status+'/'+(e.run.conclusion||'')); (e.jobs||[]).forEach(function(j){ p.push('ej:'+e.name+':'+j.name+'='+j.status+'/'+(j.conclusion||'')); }); });
    p.sort();
    return p.join('|');
  }
  function poll(){
    fetch(API, {cache:'no-store'}).then(function(r){return r.json();}).then(function(d){
      var cur = snap(d), s = sig(d), played = false;
      if (prev && on){
        var ok=0, bad=0, k;
        for (k in cur){ if (prev[k]==='pending'){ if (cur[k]==='ok') ok++; else if (cur[k]==='bad') bad++; } }
        if (ok>0){ chime('success'); flashTitle('✅ '+ok+' build'+(ok>1?'s':'')+' succeeded'); played=true; }
        if (bad>0){ setTimeout(function(){ chime('failure'); }, ok>0?750:0); flashTitle('❌ '+bad+' build'+(bad>1?'s':'')+' failed'); played=true; }
      }
      var changed = (lastSig !== null && s !== lastSig);
      prev = cur; lastSig = s;
      // Persist the baseline so a reload doesn't drop or replay chimes.
      try { sessionStorage.setItem('hs-state', JSON.stringify({prev:prev, sig:lastSig})); } catch(e){}
      if (changed){ setTimeout(function(){ location.reload(); }, played ? 1400 : 300); return; }
      setTimeout(poll, POLL_MS);
    }).catch(function(){ setTimeout(poll, POLL_MS); });
  }
  function label(){ btn.textContent = on ? '🔔 sounds on' : '🔕 sounds off'; btn.setAttribute('aria-pressed', on?'true':'false'); }
  btn.addEventListener('click', function(){
    on = !on;
    try { localStorage.setItem('hs-snd', on?'1':'0'); } catch(e){}
    label();
    if (on){ unlock(); chime('success'); }   // confirm + unlock audio
  });
  try { on = localStorage.getItem('hs-snd')==='1'; } catch(e){}
  // Restore the chime/refresh baseline persisted before the last auto-reload
  // (per-tab; absent on a fresh visit, so first load is a silent baseline).
  try { var saved = JSON.parse(sessionStorage.getItem('hs-state')||'null'); if (saved){ prev = saved.prev; lastSig = saved.sig; } } catch(e){}
  label();
  poll();
})();<\/script>`;
}

export function renderRcPage(view) {
  const sections = view.repos.map(renderRepoSection).join('');
  return `${head(`${view.tag} — haybarn-status`)}
<body>
${PLAT_SPRITE}
<header>
  <div class="brand">
    <a href="/" aria-label="haybarn-status"><img src="${LOGO_URL}" alt="" /></a>
    <h1><a href="/">haybarn-status</a><span class="tag mono">${escapeHtml(view.tag)}</span></h1>
  </div>
  <div class="meta">as of ${escapeHtml(view.fetchedAt)} · <a href="">refresh</a> · <a href="/api/r/${encodeURIComponent(view.tag)}">json</a> · <button id="snd" class="snd-toggle" type="button">🔕 sounds off</button></div>
</header>
<main>
  ${sections}
  ${renderSidePanel(view.sidePanel)}
</main>
<footer>${escapeHtml(DISCLAIMER)} · <a href="https://github.com/Query-farm-haybarn">github.com/Query-farm-haybarn</a></footer>
${soundScript(view.tag)}
</body></html>`;
}

export function renderIndex(tagsView) {
  // Group discovered tags by their X.Y.Z version (newest version first), so the
  // index reads as "1.5.3 → its rcs, 1.5.2 → its rcs". Tags without a parseable
  // version fall under an "other" bucket.
  const groups = new Map();
  for (const t of (tagsView.tags || [])) {
    const v = parseVersionFromTag(t) || 'other';
    if (!groups.has(v)) groups.set(v, []);
    groups.get(v).push(t);
  }
  const versions = [...groups.keys()].sort((a, b) => {
    if (a === 'other') return 1;
    if (b === 'other') return -1;
    return b.localeCompare(a, undefined, { numeric: true });
  });
  const sections = versions.map(v => {
    const links = groups.get(v).map(t =>
      `<a href="/r/${encodeURIComponent(t)}" class="mono">${escapeHtml(t)}</a>`
    ).join('');
    const heading = v === 'other' ? 'other' : `v${escapeHtml(v)}`;
    return `<h3 class="version-group">${heading}</h3><div class="tag-list">${links}</div>`;
  }).join('');
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
  ${sections || '<div class="empty">no haybarn-v* tags discovered yet</div>'}
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
