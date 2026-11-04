---
name: jenkins-qa-loop
description: Run the Playwright suite in Jenkins; if anything fails, triage it with the ci-triage-agent (using the learning engine's run history), heal genuine test bugs, check each fix with guardrails and the fix-verifier-agent, open a PR for the user to merge, then re-run once. At most 2 Jenkins runs per request. Use when the user says "run in Jenkins", "run the tests in CI", or asks for the QA loop.
---

# Jenkins QA loop (max 2 runs, user merges each fix)

Run 1 → (only if failures) triage → heal test bugs → guardrails → verifier → PR → **user merges** → Run 2 → report.
Jenkins emails the user after every run. Jenkins builds only `main`, and Claude can't merge without review, so every fix waits for the user's merge. Don't ask for approval anywhere else.

**Hard limits** (they keep token use on the user's work account low):

* At most **2 Jenkins runs** per request. Never start a third unless the user asks.
* Heal at most **3 specs** per request. If more than 3 specs are classified as test bugs, something systemic is wrong (usually the demo site), so fix nothing and report.
* At most **one healer attempt and one verifier pass per spec**. No retry loops.

## 1. Run 1

```sh
ci/run-jenkins.sh
```

The script also runs the learning engine: it records this run in `ci/history/test-history.jsonl` and writes `mcp-project/results/test-history.md`.

* `SUCCESS`: tell the user "N/N passed" in one line. **Stop.** No triage, no further tokens.
* `FAILURE` with no test results (setup broke, e.g. git checkout, `npm ci` or DB reset): report the failing stage from the Jenkins log and stop. No re-run, no code change.
* `UNSTABLE` (some tests failed): go to step 2.

## 2. Triage (read-only)

Spawn the `ci-triage-agent` subagent: "Triage the failed tests from the latest Jenkins run." It reads the results, the error context and `results/test-history.md`. Keep its summary for the final report.

Per failure:

| Type | Action |
|---|---|
| Flaky / environment | No code change. Run 2 doubles as the re-run. |
| App bug | No code change. Tell the user clearly. Never weaken the test to hide it. |
| Unclear, or Low confidence | No code change. Report it. |
| Test bug, High or Medium confidence | Fix it in step 3 (within the 3-spec limit). |

If nothing qualifies for a fix and every failure is an app bug or unclear, **skip Run 2** (it would fail the same way) and go to step 7.

## 3. Fix on a branch

```sh
git checkout main && git pull --ff-only
git checkout -b fix/<YYYY-MM-DD>-<short-name>
```

Spawn `playwright-test-healer` once per spec with a narrow task. Name the spec, paste the triage reasoning, and include these constraints:

* Fix only this spec. Edit only `mcp-project/tests/`, `pages/`, `locators/`, `utils/` or `test-data/`.
* Don't use `test.fixme` or `test.skip`, and don't delete an assertion.
* Change what an assertion checks only if the triage says the expectation itself is wrong. Explain why in a code comment.
* Make one focused attempt. If it can't be fixed cleanly, stop and say why.

## 4. Guardrails (automatic, strict)

```sh
git diff main --name-only
git diff main | grep -nE '^\+.*test\.(fixme|skip)\('            # any hit → reject
git diff main | grep -nE '^-.*expect\('                          # any hit → reject
git diff main --name-only | grep -vE '^mcp-project/(tests|pages|locators|utils|test-data)/'   # any hit → reject
cd mcp-project && npx playwright test <each fixed spec> --repeat-each=2   # must pass
```

If any check fails for a spec, discard that spec's change (`git checkout main -- <files>`) and list it as "not auto-fixed" with the reason.

## 5. Verifier (read-only, one pass per spec)

For each spec that passed step 4, spawn the `fix-verifier-agent` with: the failing test name, the triage reasoning, the full `git diff main` for that spec's files, and the local run result.

* `VERDICT: APPROVE`: keep the change. Paste its Reason into the PR body.
* `VERDICT: REJECT`: discard that spec's change (`git checkout main -- <files>`) and list it as "not auto-fixed: verifier rejected: <its Reason>". Don't send it back to the healer.

If nothing is left to commit, delete the branch and go to step 6 without a PR.

## 6. PR, user merge, then Run 2

```sh
git add -A && git commit -m "fix(tests): <what> (auto-fix after Jenkins triage)"
git push -u origin HEAD
gh pr create --base main --title "fix(tests): <what>" --body "<triage summary, verifier verdict + reason, why the fix doesn't hide a bug, guardrail + local run result>"
```

Give the user the PR link and ask them to merge it. **Wait** for them to say it's merged. Then:

```sh
git checkout main && git pull --ff-only
ci/run-jenkins.sh
```

Run 2 also happens, without a PR, when the only failures were flaky / environment.

## 7. Final report (one message)

* Run 1: N passed / M failed. Run 2, if it ran: N passed / M failed.
* Per failure: type, one-line cause, history pattern, and what was done ("fixed in PR #x, verifier approved", "re-run passed", "app bug, not changed", "not auto-fixed: <guardrail or verifier reason>").
* If Run 2 still has failures: triage them once more (step 2). Fix genuine test bugs through steps 3–6 as a PR for the user to merge, and tell the user plainly about any app bug. **Don't start a third Jenkins run** on your own; the user decides.
