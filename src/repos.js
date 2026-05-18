export const ORG = 'Query-farm-haybarn';

export const TAG_FIRED_REPOS = [
  { repo: 'haybarn',         label: 'Engine'  },
  { repo: 'haybarn-python',  label: 'Python'  },
  { repo: 'haybarn-jdbc',    label: 'JDBC'    },
  { repo: 'haybarn-node-neo', label: 'Node'   },
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
export const HAYBARN_VERSION = '1.5.2';
const HAYBARN_VERSION_SUFFIX = 'h' + HAYBARN_VERSION.replace(/\./g, '-');

export function pypiName(extension) {
  return `haybarn-ext-${extension}-${HAYBARN_VERSION_SUFFIX}`;
}
export function npmName(extension) {
  return `@haybarn/ext-${extension}-${HAYBARN_VERSION_SUFFIX}`;
}

// R2 binary path (where the engine actually fetches the .duckdb_extension
// at INSTALL time). Used by the worker to confirm a binary is reachable
// per platform. Wasm binaries use the `.wasm` suffix; everything else is
// `.duckdb_extension.gz`. Keep in lockstep with the engine's URL builder.
export const R2_BASE = 'https://haybarn-extensions.query.farm/community/v' + HAYBARN_VERSION;
export function r2BinaryUrl(extension, platform) {
  const ext = platform.startsWith('wasm_') ? '.duckdb_extension.wasm'
                                           : '.duckdb_extension.gz';
  return `${R2_BASE}/${platform}/${extension}${ext}`;
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
