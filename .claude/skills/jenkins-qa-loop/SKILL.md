---
name: jenkins-qa-loop
description: Run the Playwright suite in Jenkins, triage any failures with the ci-triage-agent, heal genuine test bugs on a branch with guardrails, get the user's approval, merge, and re-run Jenkins. Use when the user says "run in Jenkins", "run the tests in CI", or asks for the QA loop.
---

# Jenkins QA loop

Run → triage → heal (test bugs only) → guardrail check → user approval → merge → re-run.
Jenkins emails the user a report after every run, so there's no need to send one.

## 1. Run Jenkins

```sh
ci/run-jenkins.sh
```

It waits for the build, prints the summary (`Finished: SUCCESS | UNSTABLE | FAILURE`) and copies that run's `results/` and `test-results/` into `mcp-project/`.

* `SUCCESS`: report the pass count to the user. Done.
* `FAILURE` with no test results (setup broke, e.g. `npm ci` or DB reset): report the failing stage from the Jenkins log and stop. Don't touch code.
* `UNSTABLE` (some tests failed): go to step 2.

## 2. Triage (read-only)

Spawn the `ci-triage-agent` subagent: "Triage the failed tests from the latest Jenkins run." Show the user its summary: each failure with Type, Confidence and Why.

Decide per failure:

| Type | Action |
|---|---|
| Flaky / environment | No code change. Re-run step 1 **once**. If it fails again, report it and stop for that test. |
| App bug | No code change. Report it with the evidence. Never "fix" the test to hide it. |
| Unclear, or Low confidence | No code change. Report it and ask the user. |
| Test bug, High or Medium confidence | Go to step 3. |

## 3. Heal on a branch

```sh
git checkout main && git pull --ff-only
git checkout -b fix/<YYYY-MM-DD>-<short-name>
```

Spawn `playwright-test-healer` with a narrow task. Name the failing spec file(s) and paste the triage reasoning. Include these constraints in its prompt:

* Fix only these specs. Edit only `mcp-project/tests/`, `pages/`, `locators/`, `utils/` or `test-data/`.
* Don't use `test.fixme` or `test.skip`, and don't delete an assertion.
* Change what an assertion checks only if the triage says the assertion's expectation itself is wrong. Explain why in a code comment.

## 4. Guardrail check (you, not the healer)

```sh
git diff main --stat
git diff main | grep -nE '^\+.*test\.(fixme|skip)\(' && echo "BLOCK: skip/fixme added"
git diff main | grep -nE '^-.*expect\(' && echo "REVIEW: an expect() was removed or changed"
git diff main --name-only | grep -vE '^mcp-project/(tests|pages|locators|utils|test-data)/' && echo "BLOCK: file outside allowed dirs"
```

* **BLOCK**: discard the change (`git checkout main && git branch -D <branch>`) and report why.
* **REVIEW**: keep the change only if every removed `expect` is replaced by one that checks the same behaviour. Say so explicitly to the user.

Then prove the fix locally, twice in a row:

```sh
cd mcp-project && npx playwright test <spec> --repeat-each=2
```

## 5. PR and approval

Commit (message says what was wrong and why the fix is correct), push the branch, and open a PR:

```sh
git push -u origin HEAD
gh pr create --base main --title "fix(tests): <what>" --body "<triage summary + why this fix doesn't hide a bug + local run result>"
```

Show the user the PR link, the diff summary and the guardrail result. **Ask for approval. Don't merge without it.**

## 6. Merge and re-run

On approval:

```sh
gh pr merge --squash --delete-branch && git checkout main && git pull --ff-only
ci/run-jenkins.sh
```

Report the final result. If it's still failing, go back to step 2 once. After the second attempt, stop and report: never loop more than twice.
