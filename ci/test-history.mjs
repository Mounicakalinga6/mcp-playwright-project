// Learning engine for the Jenkins QA loop.
//
// Remembers the outcome of every test in every Jenkins run, so triage can tell
// a brand-new failure (something changed) from a test that fails on and off
// (flaky) or one that keeps failing (a real, persistent problem).
//
// Usage (ci/run-jenkins.sh calls both after every run):
//   node ci/test-history.mjs record <results.json> [build-number]
//   node ci/test-history.mjs summary <output.md>
//
// History: ci/history/test-history.jsonl, one JSON line per run. It is
// gitignored, so each machine keeps its own. Plain Node, no dependencies.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// TEST_HISTORY_FILE lets a check point at a scratch file instead of the real history.
const HISTORY_FILE = process.env.TEST_HISTORY_FILE || path.join(HERE, 'history', 'test-history.jsonl');
const WINDOW = 10; // how many recent runs the summary looks at
const MAX_ERROR_LENGTH = 200;

/** Rough category of a failure, from Playwright's error text. */
export function errorKind(message = '') {
  if (/timeout|timed out|exceeded/i.test(message)) return 'timeout';
  if (/net::|ECONNREFUSED|ECONNRESET|ENOTFOUND|socket hang up/i.test(message)) return 'network';
  if (/expect\(|toHave|toBe|toContain|toEqual|toMatch/.test(message)) return 'assertion';
  return 'other';
}

/** First line of an error, without terminal colour codes, kept short. */
function shortError(message) {
  const firstLine = message.replace(/\u001b\[[0-9;]*m/g, '').trim().split('\n')[0];
  return firstLine.length > MAX_ERROR_LENGTH ? `${firstLine.slice(0, MAX_ERROR_LENGTH)}…` : firstLine;
}

/**
 * Every test in a Playwright JSON report with its final outcome.
 * outcome is Playwright's verdict after retries: expected | unexpected | flaky | skipped.
 */
export function collectTests(suites, parentTitles = [], isFileLevel = true, out = []) {
  for (const suite of suites ?? []) {
    // Top-level suites are the spec files; their title is already in spec.file.
    const titles = isFileLevel ? parentTitles : [...parentTitles, suite.title];
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        const results = test.results ?? [];
        const failedAttempts = results.filter((r) => r.status !== 'passed' && r.status !== 'skipped');
        const lastError = failedAttempts.at(-1)?.error?.message;
        out.push({
          id: `${spec.file} > ${[...titles, spec.title].join(' > ')}`,
          outcome: test.status,
          attempts: results.length,
          kind: lastError ? errorKind(lastError) : undefined,
          error: lastError ? shortError(lastError) : undefined,
        });
      }
    }
    collectTests(suite.suites, titles, false, out);
  }
  return out;
}

function readHistory() {
  if (!fs.existsSync(HISTORY_FILE)) return [];
  return fs
    .readFileSync(HISTORY_FILE, 'utf8')
    .split('\n')
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line)];
      } catch {
        return []; // skip a corrupt line rather than lose the whole history
      }
    });
}

/** Adds one run to the history. Skips a run already recorded (same start time). */
export function record(resultsPath, build) {
  const report = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
  const startTime = report.stats?.startTime;
  if (!startTime) throw new Error(`${resultsPath} has no stats.startTime; is it a Playwright JSON report?`);

  if (readHistory().some((run) => run.startTime === startTime)) {
    console.log(`History: run from ${startTime} already recorded, skipped.`);
    return;
  }

  const tests = collectTests(report.suites);
  const failing = tests.filter((t) => t.outcome === 'unexpected' || t.outcome === 'flaky');
  const entry = {
    build: build ? Number(build) : null,
    startTime,
    tests: Object.fromEntries(tests.map((t) => [t.id, t.outcome])),
    failures: Object.fromEntries(failing.map((t) => [t.id, { kind: t.kind, attempts: t.attempts, error: t.error }])),
  };

  fs.mkdirSync(path.dirname(HISTORY_FILE), { recursive: true });
  fs.appendFileSync(HISTORY_FILE, `${JSON.stringify(entry)}\n`);
  console.log(`History: recorded build ${entry.build ?? '?'}, ${tests.length} tests, ${failing.length} failed or flaky.`);
}

const SYMBOL = { expected: 'P', unexpected: 'F', flaky: 'K', skipped: 'S' };

/** Pattern for one test across recent runs, oldest first. */
export function classify(outcomes) {
  const last = outcomes.at(-1);
  let trailingFails = 0;
  for (let i = outcomes.length - 1; i >= 0 && outcomes[i] === 'unexpected'; i--) trailingFails++;
  const earlierAllClean = outcomes.slice(0, -1).every((o) => o === 'expected' || o === 'skipped');

  if (last === 'unexpected' && outcomes.length === 1) {
    return 'FIRST RUN: no history yet';
  }
  if (last === 'unexpected' && earlierAllClean) {
    return `NEW: failed now, passed the previous ${outcomes.length - 1} run(s)`;
  }
  if (trailingFails >= 2 && trailingFails === outcomes.filter((o) => o === 'unexpected').length) {
    return `CONSISTENT: failed the last ${trailingFails} runs in a row`;
  }
  return 'INTERMITTENT: fails or needs retries on and off';
}

/** Writes a Markdown summary of every test that failed or was flaky recently. */
export function summary(outPath) {
  const runs = readHistory()
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
    .slice(-WINDOW);

  const lines = [
    '# Test history (learning engine)',
    '',
    `Last ${runs.length} recorded Jenkins run(s), oldest first. Builds: ${runs.map((r) => `#${r.build ?? '?'}`).join(', ') || 'none'}.`,
    'P = passed, F = failed after all retries, K = flaky (failed, then passed on retry), S = skipped, - = not in that run.',
    '',
    'How to read it: NEW points to a recent change (code, app or data). CONSISTENT means a real, lasting problem, not flakiness.',
    'INTERMITTENT, especially with timeout failures, is evidence of flakiness. History is evidence, not a verdict: still read the error.',
    '',
  ];

  const ids = new Set(runs.flatMap((r) => [...Object.keys(r.failures ?? {})]));
  const rows = [...ids].sort().map((id) => {
    const present = runs.filter((r) => r.tests?.[id]);
    const outcomes = present.map((r) => r.tests[id]);
    const kinds = {};
    for (const r of present) {
      const kind = r.failures?.[id]?.kind;
      if (kind) kinds[kind] = (kinds[kind] ?? 0) + 1;
    }
    const lastError = [...present].reverse().find((r) => r.failures?.[id])?.failures[id].error ?? '';
    const timeline = runs.map((r) => SYMBOL[r.tests?.[id]] ?? '-').join(' ');
    const kindText = Object.entries(kinds).map(([k, n]) => `${k} ×${n}`).join(', ');
    return `| ${id} | ${classify(outcomes)} | ${timeline} | ${kindText} | ${lastError.replace(/\|/g, '\\|')} |`;
  });

  if (rows.length === 0) {
    lines.push(runs.length ? 'No test failed or was flaky in these runs.' : 'No history recorded yet.');
  } else {
    lines.push('| Test | Pattern | Runs | Failure kinds | Last error |', '|---|---|---|---|---|', ...rows);
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${lines.join('\n')}\n`);
  console.log(`History: summary of ${runs.length} run(s), ${rows.length} test(s) with failures, written to ${outPath}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [command, arg1, arg2] = process.argv.slice(2);
  if (command === 'record' && arg1) {
    record(arg1, arg2);
  } else if (command === 'summary' && arg1) {
    summary(arg1);
  } else {
    console.error('Usage: node ci/test-history.mjs record <results.json> [build] | summary <output.md>');
    process.exit(2);
  }
}
