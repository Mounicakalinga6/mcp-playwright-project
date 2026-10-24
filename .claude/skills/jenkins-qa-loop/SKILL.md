---
name: jenkins-qa-loop
description: Run the Playwright suite in Jenkins; if anything fails, triage it with the ci-triage-agent, auto-fix genuine test bugs behind guardrails, push, and re-run once. At most 2 Jenkins runs, no approval step. Use when the user says "run in Jenkins", "run the tests in CI", or asks for the QA loop.
---

# Jenkins QA loop (fully automatic, max 2 runs)

Run 1 → (only if failures) triage → auto-fix test bugs → push → Run 2 → stop.
Jenkins emails the user after every run, so the user gets at most 2 emails. Don't ask the user for approval at any step. The guardrails in step 4 replace the human check.

**Hard limits** (they keep token use on the user's work account low):

* At most **2 Jenkins runs** per request. Never start a third.
* Heal at most **3 specs** per request. If more than 3 specs are classified as test bugs, something systemic is wrong (usually the demo site), so fix nothing and report.
* At most **one healer attempt per spec**. No retry loops.

## 1. Run 1

```sh
ci/run-jenkins.sh
```

* `SUCCESS`: tell the user "N/N passed" in one line. **Stop.** No triage, no further tokens.
* `FAILURE` with no test results (setup broke, e.g. `npm ci` or DB reset): report the failing stage from the Jenkins log and stop. No re-run, no code change.
* `UNSTABLE` (some tests failed): go to step 2.

## 2. Triage (read-only)

Spawn the `ci-triage-agent` subagent: "Triage the failed tests from the latest Jenkins run." Keep its summary for the final report.

Per failure:

| Type | Action |
|---|---|
| Flaky / environment | No code change. Run 2 doubles as the re-run. |
| App bug | No code change. Report it. Never weaken the test to hide it. |
| Unclear, or Low confidence | No code change. Report it. |
| Test bug, High or Medium confidence | Fix it in step 3 (within the 3-spec limit). |

If nothing qualifies for a fix and every failure is an app bug or unclear, **skip Run 2** (it would fail the same way) and go to step 6.

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

If any check fails for a spec, discard that spec's change (`git checkout main -- <files>`) and list it as "not auto-fixed" with the reason. If nothing is left to commit, delete the branch and continue to step 5 without a push.

## 5. Push, then Run 2

Use a PR for the record, then merge it right away:

```sh
git add -A && git commit -m "fix(tests): <what> (auto-fix after Jenkins triage)"
git push -u origin HEAD
gh pr create --base main --title "fix(tests): <what>" --body "<triage summary, why the fix doesn't hide a bug, local run result>"
gh pr merge --squash --delete-branch && git checkout main && git pull --ff-only
ci/run-jenkins.sh
```

Run 2 also happens, without a push, when the only failures were flaky / environment.

## 6. Final report (one message, then stop)

* Run 1: N passed / M failed. Run 2, if it ran: N passed / M failed.
* Per failure: type, one-line cause, and what was done ("auto-fixed in PR #x", "re-run passed", "app bug, not changed", "not auto-fixed: <guardrail reason>").
* If Run 2 still has failures: say so plainly. Don't start another run.
