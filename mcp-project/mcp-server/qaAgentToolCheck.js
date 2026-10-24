// @ts-check
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createQaServer } from './qaAgentServer.js';
import { REVIEWED_TEST_TARGETS, TEST_CATALOG } from './qaTestCatalog.js';
import { RUNNABLE_TEST_FILES, collectTestOutcomes } from './playwrightTestExecutor.js';
import { evaluateSelfCheck } from './selfCheckVerdict.js';

// Safety check for the read-only QA agent server. Every dependency is a stub:
// no Playwright run, no database query, no network call can happen here,
// even if a schema rule were wrong.

/** @type {{ runTest: any[][], readAll: number, readById: any[] }} */
const calls = { runTest: [], readAll: 0, readById: [] };

const server = createQaServer({
  runTest: async (/** @type {any[]} */ ...args) => {
    calls.runTest.push(args);
    return { stub: true };
  },
  readAllEmployees: async () => {
    calls.readAll += 1;
    return [];
  },
  readEmployeeById: async (/** @type {any} */ id) => {
    calls.readById.push(id);
    return { stub: true };
  },
});

const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
const client = new Client({ name: 'qa-agent-tool-check', version: '1.0.0' });
await server.connect(serverTransport);
await client.connect(clientTransport);

/** @type {{ check: string, result: 'PASS' | 'FAIL', detail: string }[]} */
const results = [];
/** @param {string} name @param {boolean} ok @param {string} [detail] */
function check(name, ok, detail = '') {
  results.push({ check: name, result: ok ? 'PASS' : 'FAIL', detail });
}

/** True if the call was rejected — the SDK may return isError or throw. */
async function isRejected(/** @type {string} */ name, /** @type {any} */ args) {
  try {
    const res = await client.callTool({ name, arguments: args });
    return Boolean(/** @type {any} */ (res).isError);
  } catch {
    return true;
  }
}

// 1. Exactly the 4 permitted tools, no write tools.
const { tools } = await client.listTools();
const names = tools.map((t) => t.name).sort();
const expected = ['get_all_employees', 'get_employee_by_id', 'list_test_targets', 'run_playwright_test'];
check('exactly 4 permitted tools', JSON.stringify(names) === JSON.stringify(expected), names.join(', '));
check(
  'no create/update/delete tools',
  !names.some((n) => /create|update|delete/.test(n)),
  names.filter((n) => /create|update|delete/.test(n)).join(', ') || 'none'
);

// 2. run_playwright_test's schema allows only the reviewed specs.
const runTool = tools.find((t) => t.name === 'run_playwright_test');
const allowedEnum = /** @type {any} */ (runTool?.inputSchema)?.properties?.target?.enum ?? [];
check(
  'target enum == reviewed list',
  JSON.stringify([...allowedEnum].sort()) === JSON.stringify([...REVIEWED_TEST_TARGETS].sort()),
  allowedEnum.join(', ')
);

// 3. list_test_targets returns static catalog data.
const listed = JSON.parse(/** @type {any} */ (await client.callTool({ name: 'list_test_targets', arguments: {} })).content[0].text);
check(
  'list_test_targets: allowed matches reviewed list',
  JSON.stringify(Object.keys(listed.allowed).sort()) === JSON.stringify([...REVIEWED_TEST_TARGETS].sort()),
  Object.keys(listed.allowed).join(', ')
);
check('list_test_targets: login.spec.js listed as excluded', 'login.spec.js' in listed.excluded);

// 4. Mutating / unreviewed targets are rejected by the schema.
for (const target of ['db-create.spec.js', 'db-update.spec.js', 'login.spec.js', 'pim-addEmployee.spec.js', 'all']) {
  check(`rejects target "${target}"`, await isRejected('run_playwright_test', { target }));
}
check('runTest never called by rejected targets', calls.runTest.length === 0, `${calls.runTest.length} call(s)`);

// 5. A reviewed target reaches the (stub) runner with the safety options.
await client.callTool({ name: 'run_playwright_test', arguments: { target: 'db-read.spec.js' } });
const [args] = calls.runTest;
check(
  'reviewed target passes detailed/traceOnFailure/noAuthRefresh',
  calls.runTest.length === 1 &&
    args?.[0] === 'db-read.spec.js' &&
    args?.[1]?.detailed === true &&
    args?.[1]?.traceOnFailure === true &&
    args?.[1]?.noAuthRefresh === true,
  JSON.stringify(args)
);
check(
  'db-read.spec.js uses the DB-only config',
  args?.[1]?.configFile === 'playwright.db.config.js',
  String(args?.[1]?.configFile)
);

await client.callTool({ name: 'run_playwright_test', arguments: { target: 'api-employees.spec.js' } });
const apiArgs = calls.runTest[1];
check(
  'api-employees.spec.js uses the default config (session guard stays on)',
  apiArgs?.[0] === 'api-employees.spec.js' && apiArgs?.[1]?.configFile === null && apiArgs?.[1]?.noAuthRefresh === true,
  JSON.stringify(apiArgs)
);

// 5b. Self-check target: DB config, its own path, selfcheck project only.
const selfRes = await client.callTool({ name: 'run_playwright_test', arguments: { target: 'qa-selfcheck-failure.spec.js' } });
const selfArgs = calls.runTest[2];
check(
  'self-check uses DB config + its own path + selfcheck project only',
  selfArgs?.[0] === 'qa-selfcheck-failure.spec.js' &&
    selfArgs?.[1]?.configFile === 'playwright.db.config.js' &&
    selfArgs?.[1]?.testPath === 'tests-selfcheck/qa-selfcheck-failure.spec.js' &&
    selfArgs?.[1]?.project === 'selfcheck' &&
    selfArgs?.[1]?.noAuthRefresh === true,
  JSON.stringify(selfArgs)
);
const selfBody = JSON.parse(/** @type {any} */ (selfRes).content[0].text);
check(
  'stub result for self-check is NOT verified (no real evidence)',
  selfBody.expectedOutcome === 'fail' && selfBody.selfCheck?.verified === false,
  JSON.stringify(selfBody.selfCheck?.problems?.slice(0, 2))
);
check(
  "employee-db's own allowlist still excludes the self-check",
  !(/** @type {readonly string[]} */ (RUNNABLE_TEST_FILES)).includes('qa-selfcheck-failure.spec.js')
);

// 5c. Verdict logic, with fabricated results (pure function, no I/O).
const entry = TEST_CATALOG['qa-selfcheck-failure.spec.js'];
const goodFailure = {
  test: 'QA self-check (intentional failure) > reports a deliberate assertion failure with evidence',
  status: 'failed',
  error: 'Error: INTENTIONAL FAILURE: verifies agent failure reporting',
  location: 'tests-selfcheck/qa-selfcheck-failure.spec.js:15',
  screenshot: 'test-results/x/test-failed-1.png',
  trace: 'test-results/x/trace.zip',
};
const base = { passed: false, failures: [goodFailure], globalErrors: [] };
check('verdict: correct failure + evidence -> verified', evaluateSelfCheck(base, entry).verified === true);
check('verdict: test passed -> NOT verified', evaluateSelfCheck({ ...base, passed: true, failures: [] }, entry).verified === false);
check(
  'verdict: wrong failure -> NOT verified',
  evaluateSelfCheck({ ...base, failures: [{ ...goodFailure, error: 'TimeoutError: something else' }] }, entry).verified === false
);
check(
  'verdict: missing screenshot -> NOT verified',
  evaluateSelfCheck({ ...base, failures: [{ ...goodFailure, screenshot: undefined }] }, entry).verified === false
);
check(
  'verdict: missing trace -> NOT verified',
  evaluateSelfCheck({ ...base, failures: [{ ...goodFailure, trace: undefined }] }, entry).verified === false
);
check(
  'verdict: setup error -> NOT verified',
  evaluateSelfCheck({ passed: false, setupError: 'testPath not found' }, entry).verified === false
);

// 5d. collectTestOutcomes() against a FABRICATED Playwright JSON report.
// These outcomes are made up to exercise the function's logic only; they are
// not evidence of any real test run.
const fakeSuites = [
  {
    title: 'tests\\fake.spec.js', // file-level suite: its title must NOT appear in names
    file: 'fake.spec.js',
    specs: [
      {
        title: 'top-level test',
        tests: [{ status: 'expected', projectName: 'p', results: [{ status: 'passed', retry: 0 }] }],
      },
    ],
    suites: [
      {
        title: 'Group',
        specs: [
          { title: 'passes', tests: [{ status: 'expected', projectName: 'p', results: [{ status: 'passed', retry: 0 }] }] },
          { title: 'fails', tests: [{ status: 'unexpected', projectName: 'p', results: [{ status: 'failed', retry: 0 }] }] },
          { title: 'is skipped', tests: [{ status: 'skipped', projectName: 'p', results: [{ status: 'skipped', retry: 0 }] }] },
          {
            title: 'is flaky',
            tests: [
              {
                status: 'flaky',
                projectName: 'p',
                results: [
                  { status: 'failed', retry: 0 },
                  { status: 'passed', retry: 1 },
                ],
              },
            ],
          },
          { title: 'never ran', tests: [{ status: 'skipped', projectName: 'p', results: [] }] },
        ],
      },
    ],
  },
];
const outcomes = collectTestOutcomes(fakeSuites);
/** @param {string} name */
const find = (name) => outcomes.find((o) => o.test === name);
check('[fabricated] one entry per test (6)', outcomes.length === 6, `${outcomes.length}`);
check(
  '[fabricated] names exclude file path',
  outcomes.every((o) => !o.test.includes('fake.spec.js')),
  outcomes.map((o) => o.test).join(' | ')
);
check('[fabricated] top-level test name', find('top-level test')?.status === 'passed');
check(
  '[fabricated] passed',
  find('Group > passes')?.outcome === 'expected' && find('Group > passes')?.status === 'passed'
);
check(
  '[fabricated] failed',
  find('Group > fails')?.outcome === 'unexpected' && find('Group > fails')?.status === 'failed'
);
check(
  '[fabricated] skipped',
  find('Group > is skipped')?.outcome === 'skipped' && find('Group > is skipped')?.status === 'skipped'
);
check(
  '[fabricated] flaky with 2 attempts -> outcome flaky, final status passed',
  find('Group > is flaky')?.outcome === 'flaky' && find('Group > is flaky')?.status === 'passed',
  JSON.stringify(find('Group > is flaky'))
);
check('[fabricated] no attempts -> "not run"', find('Group > never ran')?.status === 'not run');
check('[fabricated] project name carried', outcomes.every((o) => o.project === 'p'));

// 6. DB read tool rejects a wrongly-typed id.
check('get_employee_by_id rejects string id', await isRejected('get_employee_by_id', { id: '1' }));
check('DB stubs untouched by rejected call', calls.readAll === 0 && calls.readById.length === 0);

console.table(results);
const failed = results.filter((r) => r.result === 'FAIL').length;
console.log(failed ? `${failed} check(s) FAILED` : 'All checks passed (stubs only — no tests run, no DB queried).');
process.exit(failed ? 1 : 0);
