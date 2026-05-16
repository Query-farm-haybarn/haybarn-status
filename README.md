# haybarn-status

Cross-repo CI status dashboard for the [Haybarn](https://github.com/Query-farm-haybarn/haybarn)
project, served at **<https://haybarn-status.query.farm>**.

- `/` — lists released / in-flight rc tags
- `/r/<tag>` — per-rc status across engine, drivers, and core extensions
- `/api/r/<tag>` — same data as JSON, for scripts and AI agents
- `/healthz` — liveness

Pages also show a side panel with the latest snapshot of build-fork extension
repos (`haybarn-iceberg`, `-ducklake`, `-delta`, `-httpfs`) and the
`haybarn-community-extensions` umbrella — these channels don't fire on the rc
tag, so they're shown as "current state" rather than rc-pinned.

## Stack

Single Cloudflare Worker, plain JS, no deps. Pattern-matches the sibling
`haybarn-vcpkg-worker`.

- `src/index.js` — fetch handler, routing, KV-cached stale-while-revalidate
- `src/gh.js` — GitHub App auth (RS256 JWT via WebCrypto), installation-token mint
- `src/repos.js` — static repo + workflow config
- `src/collect.js` — orchestrates GH Actions API calls
- `src/render.js` — server-rendered HTML + inline CSS

## Setup

### 1. GitHub App

Create at <https://github.com/settings/apps/new>:

- **Name**: `haybarn-status-reader`
- **Homepage**: `https://haybarn-status.query.farm`
- **Webhook**: uncheck Active
- **Repository permissions**: `Actions: Read-only`, `Metadata: Read-only`, `Contents: Read-only`
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

`--remote` is required so the KV namespace and secrets bind against the real
account. Visit <http://127.0.0.1:8787/r/haybarn-v1.5.2-rc7>.

For offline iteration on `render.js`, you can stub `buildRcView` to return a
hard-coded view shape.

## Trademark

Haybarn is an independent derived distribution of DuckDB published by Query
Farm LLC. Not affiliated with or endorsed by the DuckDB Foundation. DuckDB is
a trademark of the DuckDB Foundation.
