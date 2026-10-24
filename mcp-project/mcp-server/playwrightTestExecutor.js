// @ts-check
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const execAsync = promisify(exec);

// This file lives in mcp-server/, so the project root is one level up —
// resolved this way (not via cwd) so it works no matter what directory the
// MCP host launches the server from.
const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Fixed, known list of test files — the tool can only ever run one of
// these, never an arbitrary command string.
export const RUNNABLE_TEST_FILES = /** @type {const} */ ([
  'login.spec.js',
  'pim-addEmployee.spec.js',
  'admin-addUser.spec.js',
  'db-read.spec.js',
  'db-create.spec.js',
  'db-update.spec.js',
  'ui-db-flow.spec.js',
  'api-employees.spec.js',
]);

// What the tool actually accepts: one specific file, or "all" to run the
// whole suite. Still a fixed list either way — never a free-text command.
export const RUNNABLE_TEST_TARGETS = /** @type {const} */ ([...RUNNABLE_TEST_FILES, 'all']);

/**
 * Walks Playwright's JSON reporter output to collect any failed test titles
 * and their error messages.
 * @param {any[]} suites
 * @param {{title: string, status: string, error: string | undefined}[]} failures
 */
function collectFailures(suites, failures = []) {
  for (const suite of suites) {
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        for (const result of test.results ?? []) {
          if (result.status !== 'passed' && result.status !== 'skipped') {
            failures.push({
              title: spec.title,
              status: result.status,
              error: result.error?.message,
            });
          }
        }
      }
    }
    if (suite.suites) {
      collectFailures(suite.suites, failures);
    }
  }
  return failures;
}

const ANSI_PATTERN = /\u001b\[[0-9;]*m/g;
const MAX_ERROR_LENGTH = 800;

/** @param {string | undefined} text */
function cleanErrorText(text) {
  if (!text) {
    return undefined;
  }
  const clean = text.replace(ANSI_PATTERN, '').trim();
  return clean.length > MAX_ERROR_LENGTH ? `${clean.slice(0, MAX_ERROR_LENGTH)}…` : clean;
}

/** Project-relative path with forward slashes, for readable, comparable output. @param {string} p */
function toProjectRelative(p) {
  return path.relative(PROJECT_ROOT, p).split(path.sep).join('/');
}

/** Absolute path of a named attachment, if Playwright reported one. @param {any[]} attachments @param {string} name */
function attachmentPath(attachments, name) {
  const found = (attachments ?? []).find((a) => a.name === name && a.path);
  return found ? found.path : undefined;
}

/**
 * Like collectFailures, but with the full test title, cleaned error text,
 * source location, and screenshot/trace paths when Playwright provides them.
 * Fields Playwright didn't provide are omitted rather than guessed.
 * Evidence paths are absolute here; verifyEvidence() checks and relativises them.
 * @param {any[]} suites
 * @param {string[]} parentTitles
 * @param {any[]} failures
 * @param {boolean} isFileLevel — true for the report's top-level suites
 */
function collectDetailedFailures(suites, parentTitles = [], failures = [], isFileLevel = true) {
  for (const suite of suites) {
    // Top-level suites are the spec files themselves; their title is the
    // file path (e.g. "tests-selfcheck\\x.spec.js"), which `location` already
    // carries — skip it by position, since comparing names misses paths.
    const titles = isFileLevel ? parentTitles : [...parentTitles, suite.title];
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        for (const result of test.results ?? []) {
          if (result.status === 'passed' || result.status === 'skipped') {
            continue;
          }
          const loc = result.error?.location;
          failures.push({
            test: [...titles, spec.title].join(' > '),
            status: result.status,
            error: cleanErrorText(result.error?.message),
            location: loc
              ? `${toProjectRelative(loc.file)}:${loc.line}`
              : spec.file
                ? `${spec.file}:${spec.line}`
                : undefined,
            screenshot: attachmentPath(result.attachments, 'screenshot'),
            trace: attachmentPath(result.attachments, 'trace'),
            retry: result.retry,
          });
        }
      }
    }
    if (suite.suites) {
      collectDetailedFailures(suite.suites, titles, failures, false);
    }
  }
  return failures;
}

/**
 * Every test in the run with its final outcome, so a fully passing run
 * still says which tests it covered. Same title format as failures.
 * `test.status` is Playwright's verdict after retries; the last entry in
 * `test.results` is the final attempt.
 * @param {any[]} suites
 * @param {string[]} parentTitles
 * @param {any[]} outcomes
 * @param {boolean} isFileLevel — true for the report's top-level suites
 */
export function collectTestOutcomes(suites, parentTitles = [], outcomes = [], isFileLevel = true) {
  for (const suite of suites) {
    const titles = isFileLevel ? parentTitles : [...parentTitles, suite.title];
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        const results = test.results ?? [];
        const finalResult = results[results.length - 1];
        outcomes.push({
          test: [...titles, spec.title].join(' > '),
          outcome: test.status, // expected | unexpected | flaky | skipped
          status: finalResult?.status ?? 'not run', // passed | failed | timedOut | skipped | interrupted
          project: test.projectName,
        });
      }
    }
    if (suite.suites) {
      collectTestOutcomes(suite.suites, titles, outcomes, false);
    }
  }
  return outcomes;
}

/** @param {string} absPath */
async function fileExists(absPath) {
  try {
    await fs.access(absPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Only reports a screenshot/trace path if the file actually exists on disk.
 * A path Playwright reported but that's missing goes to `missingEvidence`
 * instead, so nothing is claimed without the file being there.
 * @param {any[]} failures
 */
async function verifyEvidence(failures) {
  for (const failure of failures) {
    for (const kind of ['screenshot', 'trace']) {
      const absPath = failure[kind];
      if (!absPath) {
        delete failure[kind];
        continue;
      }
      if (await fileExists(absPath)) {
        failure[kind] = toProjectRelative(absPath);
      } else {
        delete failure[kind];
        (failure.missingEvidence ??= []).push(`${kind} reported but file not found: ${toProjectRelative(absPath)}`);
      }
    }
  }
  return failures;
}

/**
 * Runs one Playwright spec file, or the whole suite if target is "all", and
 * returns a clean pass/fail summary.
 *
 * Options are all off by default, so existing callers get exactly the
 * original command and output shape.
 * @param {string} target — one of RUNNABLE_TEST_TARGETS, or a QA catalog target
 *   (callers validate it against their own fixed allowlist first)
 * @param {{ detailed?: boolean, traceOnFailure?: boolean, noAuthRefresh?: boolean,
 *           configFile?: string | null, testPath?: string | null, project?: string | null }} [options]
 *   detailed       — richer failure objects (location, verified screenshot/trace paths)
 *   traceOnFailure — adds --trace=retain-on-failure for this run only
 *   noAuthRefresh  — global setup fails instead of logging in when the saved
 *                    session is missing/stale (never touches credentials)
 *   configFile     — alternate Playwright config, relative to the project
 *                    root (e.g. playwright.db.config.js); default config if unset
 *   testPath       — spec path relative to the project root; default `tests/${target}`
 *   project        — run only this Playwright project (adds --project)
 */
export async function runPlaywrightTest(target, options = {}) {
  const {
    detailed = false,
    traceOnFailure = false,
    noAuthRefresh = false,
    configFile = null,
    testPath = null,
    project = null,
  } = options;

  const specPath = testPath ?? `tests/${target}`;
  if (testPath && !(await fileExists(path.join(PROJECT_ROOT, testPath)))) {
    // Refuse to run rather than let Playwright silently match nothing.
    if (!detailed) {
      throw new Error(`testPath not found: ${testPath}`);
    }
    return { target, passed: false, setupError: `testPath not found: ${testPath}` };
  }
  // The app's own console.log lines (from logger.js, global-setup, etc.)
  // share stdout with Playwright's JSON reporter, which corrupts it if the
  // report is written there too. Point the JSON report at its own file
  // instead, so it's never mixed with anything else.
  const outputFile = path.join(PROJECT_ROOT, `test-results/mcp-run-${Date.now()}.json`);
  // Single-file runs use --workers=1: the shared public demo site gets
  // flaky/contentious under parallel load (confirmed earlier — the same
  // suite produced two different failure sets on two parallel runs), and a
  // single file is small enough that serial execution stays fast anyway.
  // "all" (15 tests across the whole suite) stays parallel instead — running
  // it fully serial pushed total runtime past the MCP client's default
  // 60-second request timeout. Faster-but-slightly-flakier is the right
  // tradeoff there; the failures it can produce are already a documented,
  // known site characteristic, not a mystery to debug.
  const baseCommand =
    target === 'all'
      ? 'npx playwright test --reporter=json'
      : `npx playwright test ${specPath} --workers=1 --reporter=json`;
  let command = traceOnFailure ? `${baseCommand} --trace=retain-on-failure` : baseCommand;
  if (configFile) {
    command += ` --config ${configFile}`;
  }
  if (project) {
    command += ` --project ${project}`;
  }

  /** @type {NodeJS.ProcessEnv} */
  const env = { ...process.env, PLAYWRIGHT_JSON_OUTPUT_NAME: outputFile };
  if (noAuthRefresh) {
    env.GLOBAL_SETUP_NO_REFRESH = '1';
  }

  let stderr = '';
  try {
    await execAsync(command, { cwd: PROJECT_ROOT, maxBuffer: 10 * 1024 * 1024, env });
  } catch (error) {
    // Playwright's CLI exits with a non-zero code when tests fail — that's
    // an expected outcome to report, not a tool crash. The report file was
    // still written either way.
    stderr = /** @type {any} */ (error).stderr ?? '';
  }

  let reportText;
  try {
    reportText = await fs.readFile(outputFile, 'utf8');
  } catch (readError) {
    // No report means Playwright stopped before running any test (e.g. the
    // global-setup session guard). Detailed callers get a readable reason;
    // existing callers keep the original behaviour (the read error).
    if (!detailed) {
      throw readError;
    }
    return { target, passed: false, setupError: cleanErrorText(stderr) || 'Playwright produced no report.' };
  }
  await fs.unlink(outputFile).catch(() => {});

  const report = JSON.parse(reportText);

  if (detailed) {
    return {
      target,
      passed: report.stats.unexpected === 0 && !(report.errors?.length),
      counts: {
        passed: report.stats.expected,
        failed: report.stats.unexpected,
        flaky: report.stats.flaky,
        skipped: report.stats.skipped,
      },
      durationMs: report.stats.duration,
      tests: collectTestOutcomes(report.suites ?? []),
      failures: await verifyEvidence(collectDetailedFailures(report.suites ?? [])),
      // Errors outside any single test (e.g. global setup) land here.
      globalErrors: (report.errors ?? []).map((/** @type {any} */ e) => cleanErrorText(e.message)),
      notes: ['Screenshot/trace paths are overwritten by the next run.'],
    };
  }

  const failures = collectFailures(report.suites ?? []);

  return {
    target,
    passed: report.stats.unexpected === 0,
    expected: report.stats.expected,
    unexpected: report.stats.unexpected,
    flaky: report.stats.flaky,
    skipped: report.stats.skipped,
    durationMs: report.stats.duration,
    failures,
  };
}
