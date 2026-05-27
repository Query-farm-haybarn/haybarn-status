# haybarn-status

Cross-repo CI status dashboard for the [Haybarn](https://github.com/Query-farm-haybarn/haybarn)
project, served at **<https://haybarn-status.query.farm>**.

- `/` — lists discovered `haybarn-v*` rc tags, grouped by version
- `/r/<tag>` — per-rc status across engine, drivers, wasm, and the extension catalog
- `/api/r/<tag>` — same data as JSON, for scripts, AI agents, and the
  `query.farm` Astro site (which snapshots it at build time)
- `/activity` — live `tail -f`-style feed of the webhook stream (workflow runs,
  jobs, releases), newest first; polls `/api/activity` every 5s and prepends
  new rows. `/api/activity?before=<receivedAt>&limit=` pages backwards.
- `/healthz` — liveness

It is **multi-version**: the Haybarn/DuckDB version is derived from the rc tag
(`haybarn-v1.5.3-rc1` → `1.5.3`), and all version-dependent probes (R2 / npm /
PyPI / upstream) are scoped to it. New versions appear automatically as their
first `haybarn-v*` tag is pushed — there is no version constant to bump.

The rc page also shows a side panel with the latest snapshot of build-fork
extension repos (`haybarn-iceberg`, `-ducklake`, `-delta`, `-httpfs`) and the
`haybarn-community-extensions` catalog — these channels don't fire on the rc
tag, so they're shown as "current state" rather than rc-pinned.

UI niceties: per-platform build grids (e.g. the Python wheel matrix), OS brand
icons, a **reliability column** (last-N pass rate per extension, so chronically
red builds are visible — not just the latest run), **build durations + stuck-leg
flagging** in cell tooltips, a per-extension **build-time column** (slowest leg,
build only — queue excluded) plus an aggregate **"build time by platform" bar
chart**, the query.farm light theme, and **opt-in build chimes + auto-refresh**
(toggle "🔔 sounds"): the page polls its own JSON every 20s, plays a synth bell
when a build flips to success/failure, and reloads when the data actually
changes.

## Data flow

Live CI state (rc runs, fork runs, the community build matrix) comes from the
[`haybarn-github-actions`](../haybarn-github-actions) webhook collector via a
**service binding** (`env.FEED` → its `StatusFeed` entrypoint). That collector
captures org webhooks (`workflow_run` / `workflow_job`) into a Durable Object
and serves reduced, GitHub-API-shaped state — so this worker no longer polls the
GitHub Actions API for CI status.

What still hits other sources directly:

- **GitHub App** (`src/gh.js`) — community-catalog enumeration (Contents API),
  and a *backstop* for the engine tag list. The tag list is now sourced
  primarily from the collector's `tags` table (`FEED.listTags`, reduced from
  `release`/`create` webhooks — which also carry publish times for "published
  Xh ago"); the `git/matching-refs` API call only fills in tags older than the
  webhook history. Not used for Actions/CI state.
- **npm / PyPI / R2 / upstream DuckDB CDN** — probed directly (HEAD/GET) for
  per-extension, version-scoped "is it actually installable" presence.

## Stack

Single Cloudflare Worker, plain JS, no deps.

- `src/index.js` — fetch handler, routing, KV stale-while-revalidate, version
  derivation per rc tag, cron prewarm, client sounds/auto-refresh script
- `src/collect.js` — builds the views from the `FEED` binding + presence probes
- `src/catalog.js` — community catalog enumeration + `description.yml` parsing (Contents API)
- `src/gh.js` — GitHub App auth (RS256 JWT via WebCrypto), installation-token mint
- `src/repos.js` — static repo/workflow config + version-parameterized URL/name builders
- `src/render.js` — server-rendered HTML + inline CSS (light query.farm theme), OS-icon sprite

## Setup

### 1. GitHub App

Create at <https://github.com/settings/apps/new>:

- **Name**: `haybarn-status-reader`
- **Homepage**: `https://haybarn-status.query.farm`
- **Webhook**: uncheck Active
- **Repository permissions**: `Metadata: Read-only`, `Contents: Read-only`
  (Actions read is no longer required — CI state comes from the collector)
- **Where can this app be installed?**: Only on this account

After creating: note the **App ID**, generate and download the **private key**
(`.pem`), install on the `Query-farm-haybarn` org for **All repositories**, and
note the **Installation ID** from the URL after install.

The private key from GitHub is PKCS#1; the Worker uses WebCrypto which expects
PKCS#8. Convert once:

```sh
openssl pkcs8 -topk8 -inform PEM -outform PEM -nocrypt \
  -in haybarn-status-reader.YYYY-MM-DD.private-key.pem \
  -out haybarn-status-reader.pkcs8.pem
```

### 2. Cloudflare resources

```sh
wrangler kv namespace create STATUS_KV
# paste the returned id into wrangler.toml [[kv_namespaces]] id field

wrangler secret put GH_APP_ID                # paste numeric App ID
wrangler secret put GH_APP_INSTALLATION_ID   # paste numeric Installation ID
wrangler secret put GH_APP_PRIVATE_KEY       # paste full PKCS#8 PEM
```

The `FEED` service binding (to `haybarn-github-actions`, entrypoint
`StatusFeed`) is declared in `wrangler.toml`; the collector worker must be
deployed first.

### 3. Deploy + bind domain

```sh
wrangler deploy
```

Then in the Cloudflare dashboard → Workers & Pages → `haybarn-status` →
Settings → Domains & Routes → **Add Custom Domain** → `haybarn-status.query.farm`.
CF auto-creates the proxied CNAME in the `query.farm` zone and provisions TLS.

## Local development

```sh
wrangler dev --remote
```

`--remote` is required so the KV namespace, secrets, and the `FEED` service
binding resolve against the real account. Visit
<http://127.0.0.1:8787/r/haybarn-v1.5.3-rc1>.

## Trademark

Haybarn is an independent derived distribution of DuckDB published by Query
Farm LLC. Not affiliated with or endorsed by the DuckDB Foundation. DuckDB is
a trademark of the DuckDB Foundation.
