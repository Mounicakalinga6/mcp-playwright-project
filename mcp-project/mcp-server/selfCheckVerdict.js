// @ts-check

/**
 * Decides whether an intentional-failure self-check behaved correctly.
 * It counts as verified ONLY if: the run produced no setup/global errors,
 * the spec did not pass, exactly one test failed with status "failed", its
 * error contains the expected marker, its location is inside the self-check
 * spec, and both a screenshot and a trace exist on disk (the executor only
 * reports evidence paths for files it confirmed exist).
 *
 * Pure function: no I/O.
 * @param {any} result — the executor's detailed result
 * @param {{ path: string, expectedFailureMarker: string | null }} entry — the catalog entry
 */
export function evaluateSelfCheck(result, entry) {
  /** @type {string[]} */
  const problems = [];

  if (result?.setupError) {
    problems.push(`setup error: ${result.setupError}`);
  }
  if (result?.globalErrors?.length) {
    problems.push(`global errors: ${result.globalErrors.join(' | ')}`);
  }
  if (result?.passed === true) {
    problems.push('the self-check PASSED, but it is designed to fail');
  }

  const failures = Array.isArray(result?.failures) ? result.failures : [];
  if (failures.length !== 1) {
    problems.push(`expected exactly 1 failure, got ${failures.length}`);
  }

  const failure = failures[0];
  if (failure) {
    if (failure.status !== 'failed') {
      problems.push(`expected status "failed", got "${failure.status}"`);
    }
    if (!entry.expectedFailureMarker || !failure.error?.includes(entry.expectedFailureMarker)) {
      problems.push('the failure is not the intentional assertion (expected marker missing from error)');
    }
    if (!failure.location?.startsWith(`${entry.path}:`)) {
      problems.push(`failure location "${failure.location}" is not in ${entry.path}`);
    }
    if (!failure.screenshot) {
      problems.push('screenshot missing (not generated, or file not found on disk)');
    }
    if (!failure.trace) {
      problems.push('trace missing (not generated, or file not found on disk)');
    }
    for (const note of failure.missingEvidence ?? []) {
      problems.push(note);
    }
  }

  const verified = problems.length === 0;
  return {
    verified,
    verdict: verified
      ? 'Self-check behaved as expected: the intentional failure was reported with verified evidence.'
      : 'Self-check NOT verified: see problems.',
    problems,
  };
}
