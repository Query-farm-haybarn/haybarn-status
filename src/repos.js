export const ORG = 'Query-farm-haybarn';

export const TAG_FIRED_REPOS = [
  { repo: 'haybarn',         label: 'Engine'  },
  { repo: 'haybarn-python',  label: 'Python'  },
  { repo: 'haybarn-jdbc',    label: 'JDBC'    },
  { repo: 'haybarn-node-neo', label: 'Node'   },
  { repo: 'haybarn-wasm',    label: 'Wasm'    },
];

export const FORK_EXT_REPOS = [
  { repo: 'haybarn-iceberg',  label: 'Iceberg'  },
  { repo: 'haybarn-ducklake', label: 'DuckLake' },
  { repo: 'haybarn-delta',    label: 'Delta'    },
  { repo: 'haybarn-httpfs',   label: 'HTTPFS'   },
];

export const COMMUNITY_REPO = {
  repo: 'haybarn-community-extensions',
  workflowFile: 'build.yml',
  buildAllWorkflowFile: 'build_all.yml',
  branch: 'main',
};

export const TAG_PREFIX = 'haybarn-v';
export const TAG_REF_PATH = `tags/${TAG_PREFIX}`;

export const DISCLAIMER = 'DuckDB is a trademark of the DuckDB Foundation.';

// Registry layout: where the worker checks for npm + PyPI publication.
// These are the names produced by extension-ci-tools' wheel/leaf builders.
// `derive*Name(ext, haybarnVersion)` returns the publish target name.
// Stay in lockstep with:
//   - haybarn-extension-ci-tools/scripts/publish/pypi_build_wheel.py
//   - haybarn-extension-ci-tools/scripts/publish/npm_build_meta.py
// The status server supports multiple Haybarn (DuckDB) versions at once. The
// version is derived per-page from the rc tag being viewed (e.g.
// `haybarn-v1.5.3-rc1` → `1.5.3`); the version-dependent builders below all
// take a `version` argument. DEFAULT_VERSION is only the fallback for contexts
// with no tag in hand.
export const DEFAULT_VERSION = '1.5.3';

// Back-compat alias; prefer passing an explicit version.
export const HAYBARN_VERSION = DEFAULT_VERSION;

// Extract the X.Y.Z version embedded in a `haybarn-v<X.Y.Z>[-rcN]` tag.
// Returns null when the tag doesn't carry a parseable version.
export function parseVersionFromTag(tag) {
  const m = String(tag || '').match(/^haybarn-v(\d+\.\d+\.\d+)/);
  return m ? m[1] : null;
}

function versionSuffix(version) {
  return 'h' + String(version).replace(/\./g, '-');
}

export function pypiName(extension, version = DEFAULT_VERSION) {
  return `haybarn-ext-${extension}-${versionSuffix(version)}`;
}
export function npmName(extension, version = DEFAULT_VERSION) {
  return `@haybarn/ext-${extension}-${versionSuffix(version)}`;
}

// R2 binary path (where the engine actually fetches the .duckdb_extension
// at INSTALL time). Used by the worker to confirm a binary is reachable
// per platform. Wasm binaries use the `.wasm` suffix; everything else is
// `.duckdb_extension.gz`. Keep in lockstep with the engine's URL builder.
export const R2_HOST = 'https://haybarn-extensions.query.farm';
export function communityR2Base(version = DEFAULT_VERSION) {
  return `${R2_HOST}/community/v${version}`;
}
export function r2BinaryUrl(extension, platform, version = DEFAULT_VERSION) {
  const ext = platform.startsWith('wasm_') ? '.duckdb_extension.wasm'
                                           : '.duckdb_extension.gz';
  return `${communityR2Base(version)}/${platform}/${extension}${ext}`;
}

// Core channel — extensions that ship as part of the Haybarn release proper,
// served from `/core/v<haybarn>/` instead of `/community/v<haybarn>/`. The
// canonical list lives in haybarn/.github/config/haybarn_extensions.cmake;
// we mirror it here as a tiny static table so the status worker doesn't have
// to parse cmake at fetch time. Keep this in sync when the catalog changes.
//
// Layer:
//   'in_tree'   — bundled in the engine binary; their availability mirrors
//                 the engine row, and Haybarn isn't publishing them as
//                 separate npm/PyPI packages.
//   'fork'      — extensions built from Query-farm-haybarn/haybarn-<name>
//                 build-forks (carry Haybarn patches on top of upstream).
//   'rebuilt'   — extensions rebuilt from upstream sources unchanged.
export const CORE_EXTENSIONS = [
  // In-tree (ship with the engine)
  { name: 'autocomplete',     layer: 'in_tree' },
  { name: 'core_functions',   layer: 'in_tree' },
  { name: 'icu',              layer: 'in_tree' },
  { name: 'json',             layer: 'in_tree' },
  { name: 'parquet',          layer: 'in_tree' },
  { name: 'tpcds',            layer: 'in_tree' },
  { name: 'tpch',             layer: 'in_tree' },
  // Build-forks (Query-farm-haybarn/haybarn-<name>)
  { name: 'httpfs',           layer: 'fork' },
  { name: 'iceberg',          layer: 'fork' },
  { name: 'ducklake',         layer: 'fork' },
  { name: 'delta',            layer: 'fork' },
  // Rebuilt from upstream, unchanged
  { name: 'avro',             layer: 'rebuilt' },
  { name: 'aws',              layer: 'rebuilt' },
  { name: 'azure',            layer: 'rebuilt' },
  { name: 'encodings',        layer: 'rebuilt' },
  { name: 'excel',            layer: 'rebuilt' },
  { name: 'fts',              layer: 'rebuilt' },
  { name: 'inet',             layer: 'rebuilt' },
  { name: 'mysql_scanner',    layer: 'rebuilt' },
  { name: 'odbc_scanner',     layer: 'rebuilt' },
  { name: 'postgres_scanner', layer: 'rebuilt' },
  { name: 'spatial',          layer: 'rebuilt' },
  { name: 'sqlite_scanner',   layer: 'rebuilt' },
  { name: 'sqlsmith',         layer: 'rebuilt' },
  { name: 'unity_catalog',    layer: 'rebuilt' },
  { name: 'vss',              layer: 'rebuilt' },
];

// R2 path for core artifacts. Engine fetches from here when an `INSTALL` hits
// one of the catalog names above.
export function coreR2Base(version = DEFAULT_VERSION) {
  return `${R2_HOST}/core/v${version}`;
}
export function r2CoreBinaryUrl(extension, platform, version = DEFAULT_VERSION) {
  const ext = platform.startsWith('wasm_') ? '.duckdb_extension.wasm'
                                           : '.duckdb_extension.gz';
  return `${coreR2Base(version)}/${platform}/${extension}${ext}`;
}

// Filed-upstream-issue tracker. Curated map keyed by extension name.
// Updates as we (a) file new ones, (b) see them closed/merged.
// Each entry: { url, why, status: 'open' | 'closed' (optional, omit if unknown) }.
//
// History:
//   2026-05-17 — opened the duckdb-rs version-bump issues against four repos
//   (1.5.0/1.5.1 → 1.5.2 patch bumps). These extensions still build but
//   embed a mismatched DUCKDB_VERSION header.
//
//   2026-05-18 — opened bump-to-1.5.2 issues against six repos still pinned
//   to a pre-1.5 duckdb-rs crate (1.2.x / 1.3.x / 1.4.x). All six are
//   disabled in our catalog via `excluded_platforms: <all>` until upstream
//   bumps; html_query has issues disabled on its repo, so no tracker URL.
export const KNOWN_UPSTREAM_ISSUES = {
  // Patch-bump candidates (still building):
  finetype:    { url: 'https://github.com/meridian-online/duckdb-finetype/issues/3', why: 'duckdb-rs pinned to 1.5.0' },
  sazgar:      { url: 'https://github.com/Angelerator/Sazgar/issues/2',              why: 'duckdb-rs pinned to 1.5.0' },
  behavioral:  { url: 'https://github.com/tomtom215/duckdb-behavioral/issues/74',    why: 'duckdb-rs pinned to 1.5.1' },
  rusty_quack: { url: 'https://github.com/duckdb/extension-template-rs/issues/45',   why: 'duckdb-rs pinned to 1.5.1' },
  // Disabled-in-catalog, pre-1.5 pin:
  html_readability: { url: 'https://github.com/midwork-finds-jobs/duckdb-html-readability/issues/1', why: 'duckdb-rs pinned to 1.4.3 (disabled)' },
  quackformers:     { url: 'https://github.com/martin-conur/quackformers/issues/22', why: 'duckdb-rs pinned to 1.2.2 (disabled)' },
  quackstats:       { url: 'https://github.com/jasadams/quackstats/issues/1',        why: 'duckdb-rs pinned to 1.4.4 (disabled)' },
  rusty_sheet:      { url: 'https://github.com/redraiment/rusty-sheet/issues/21',    why: 'duckdb-rs pinned to 1.4.3 (disabled)' },
  warc:             { url: 'https://github.com/midwork-finds-jobs/duckdb_warc/issues/2', why: 'duckdb-rs pinned to 1.4.2 (disabled)' },
  html_query:       { url: null, why: 'duckdb-rs pinned to 1.4.2 (disabled); upstream repo has issues disabled' },
};
