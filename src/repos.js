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
