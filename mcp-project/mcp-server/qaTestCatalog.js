// @ts-check

// Reviewed, non-mutating specs the read-only QA agent is allowed to run.
// Adding a spec here is a deliberate review decision — check it writes
// nothing (no OrangeHRM records, no Postgres INSERT/UPDATE/DELETE) first.
export const REVIEWED_TEST_TARGETS = /** @type {const} */ ([
  'api-employees.spec.js',
  'db-read.spec.js',
  'qa-selfcheck-failure.spec.js',
]);

// Every entry has the same fields:
//   config  — Playwright config to use (null = default playwright.config.js)
//   path    — spec path relative to the project root
//   project — Playwright project to restrict the run to (null = all projects in that config)
//   expectedOutcome / expectedFailureMarker — for self-checks that must fail in a specific way
export const TEST_CATALOG = {
  'api-employees.spec.js': {
    covers:
      'API: GET /api/v2/pim/employees returns 200 with { data: [...], meta: { total } } using the saved session; ' +
      'the same endpoint without cookies returns 401.',
    touches: 'OrangeHRM demo API (external), read-only requests. Needs a fresh saved session.',
    writesData: false,
    tests: 2,
    config: null, // default playwright.config.js (OrangeHRM global setup + session guard)
    path: 'tests/api-employees.spec.js',
    project: null,
    expectedOutcome: 'pass',
    expectedFailureMarker: null,
  },
  'db-read.spec.js': {
    covers: 'DB: SELECT all employees; SELECT employee id 1.',
    touches: 'Local practice Postgres only (SELECT). No OrangeHRM login or saved session involved.',
    writesData: false,
    tests: 2,
    config: 'playwright.db.config.js',
    path: 'tests/db-read.spec.js',
    project: null,
    expectedOutcome: 'pass',
    expectedFailureMarker: null,
  },
  'qa-selfcheck-failure.spec.js': {
    covers:
      'SELF-CHECK, INTENTIONAL FAILURE. Builds a tiny inline page and deliberately fails one assertion, ' +
      'to verify failure reporting (test name, error, file:line, screenshot, trace). ' +
      'A matching failure with verified evidence is the CORRECT result.',
    touches: 'Nothing external: inline HTML only. No website, login, or database.',
    writesData: false,
    tests: 1,
    config: 'playwright.db.config.js',
    path: 'tests-selfcheck/qa-selfcheck-failure.spec.js',
    project: 'selfcheck', // runs only this project, never the DB tests
    expectedOutcome: 'fail',
    expectedFailureMarker: 'INTENTIONAL FAILURE',
  },
};

export const EXCLUDED_TARGETS = {
  'login.spec.js': 'Uses Admin credentials against the external OrangeHRM site; deferred for separate review.',
  'pim-addEmployee.spec.js': 'Creates employees in OrangeHRM.',
  'admin-addUser.spec.js': 'Creates an OrangeHRM employee and system user.',
  'ui-db-flow.spec.js': 'Creates an OrangeHRM employee and INSERTs into Postgres.',
  'db-create.spec.js': 'INSERTs into Postgres.',
  'db-update.spec.js': 'INSERTs and UPDATEs Postgres.',
  all: 'Runs every spec, including the mutating ones.',
};
