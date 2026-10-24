# Playwright + PostgreSQL + MCP: AI-assisted QA framework

A JavaScript Playwright framework that tests the
[OrangeHRM demo](https://opensource-demo.orangehrmlive.com) at three levels
(UI, REST API and database), runs in Jenkins, and uses AI agents through the
Model Context Protocol (MCP) to triage and heal failures **without hiding real bugs**.

| Area | What's here |
|---|---|
| **UI tests** | Page Object Model (`pages/` + `locators/`), saved login session via global setup, login / PIM / Admin flows |
| **API tests** | Contract checks with Zod schemas, paging, sorting, filtering, error codes, auth (401), no password leakage |
| **DB tests** | PostgreSQL via `pg`, parameterised queries through a repository layer, UI → DB end-to-end check |
| **CI** | `Jenkinsfile`: runs after every push, resets a dedicated CI database, publishes the HTML report, emails the result |
| **MCP servers** | `employee-db` (CRUD tools), `qa-agent-readonly` (allow-listed test runs), official `playwright-test` |
| **AI agents** | Read-only QA agent, CI triage agent, Playwright planner / generator / healer, and a `jenkins-qa-loop` skill with guardrails and a human approval step |

## The AI QA loop

```
run Jenkins ─► failures? ─► ci-triage-agent (read-only) classifies each one
                              ├─ flaky / environment ─► re-run once
                              ├─ app bug ────────────► reported, never patched over
                              └─ test bug ───────────► healer fixes it on a branch
                                                          ▼
                     guardrails: no test.skip/fixme, no removed expect(), test dirs only
                                                          ▼
                          local re-run ×2 ─► PR ─► human approves ─► merge ─► Jenkins re-run
```

Design choices:

* **Triage before repair.** An agent that "fixes" every red test will eventually
  weaken an assertion and hide a real defect, so classification comes first and
  only confirmed test bugs are healed.
* **Least privilege.** The triage agent can only read files. The QA agent can run
  only three reviewed, non-mutating specs. Write access goes through a branch, a PR and a human.
* **Deterministic CI data.** Jenkins rebuilds a separate `playwrightdb_ci`
  database from `db/setup.sql` before every run.

## Getting started

Setup, scripts and the full agent table are in **[mcp-project/README.md](mcp-project/README.md)**.

```bash
cd mcp-project
npm install && npx playwright install chromium
cp .env.example .env            # fill in local Postgres credentials
psql -U postgres -c "CREATE DATABASE playwrightdb;"
psql -U postgres -d playwrightdb -f db/setup.sql
npm test
```
