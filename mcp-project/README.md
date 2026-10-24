# MCP + Playwright + PostgreSQL practice project

Personal learning project:

- **Playwright tests** (JavaScript, Page Object Model) against the public
  [OrangeHRM demo site](https://opensource-demo.orangehrmlive.com): UI, API
  and login flows.
- **PostgreSQL tests** against a local `employees` table, via `pg`.
- **Jenkins CI** (`../Jenkinsfile`): runs the suite after every push, resets a
  dedicated CI database first, publishes the HTML report, and emails the result.
- **MCP servers + AI agents** for Claude Code: a read-only QA agent, a CI
  failure-triage agent, Playwright's official planner / generator / healer
  agents, and a `jenkins-qa-loop` skill that ties them together with
  guardrails so a "fix" can never hide a real bug.

## How the AI agents fit together

```
"run in Jenkins"
   │
   ▼
ci/run-jenkins.sh ──► Jenkins: npm ci → reset CI DB → 35 tests → report + email
   │
   ├── all passed ─────────────────────────────────────────► done
   │
   └── failures ─► ci-triage-agent (read-only)
                     classifies each failure:
                     ├─ flaky / environment ─► re-run once, no code change
                     ├─ app bug ─────────────► reported, never "fixed" in the test
                     ├─ unclear ─────────────► asks the human
                     └─ test bug ────────────► playwright-test-healer on a branch
                                                  │
                                guardrail diff check: no test.skip / fixme,
                                no removed expect(), only test dirs touched
                                                  │
                                re-run locally ×2 → PR → human approves
                                                  │
                                merge → Jenkins re-run → report
```

| Agent / server | Where | Can change code? |
|---|---|---|
| `playwright-qa-agent` | `.claude/agents/` → `qa-agent-readonly` MCP server | No, runs only 3 reviewed read-only specs |
| `ci-triage-agent` | `.claude/agents/` | No, tools are Read / Grep / Glob only |
| `playwright-test-planner` | `.claude/agents/` (official, `npx playwright init-agents`) | Writes test plans to `specs/` |
| `playwright-test-generator` | same | Writes new specs from a plan |
| `playwright-test-healer` | same | Edits failing tests, only on a branch via the loop |
| `jenkins-qa-loop` skill | `.claude/skills/` | Orchestrates the above; merges only after human approval |
| `employee-db` MCP server | `mcp-server/mcpServer.js` | Full CRUD on the practice DB (manual use only) |
| `playwright-test` MCP server | `npx playwright run-test-mcp-server` | Browser + test runner tools for the official agents |

## Folder layout

The project spans two levels. Keep both when copying it to another machine:

```
MCP_Project/                      <- open Claude Code / VS Code HERE
├── .mcp.json                     MCP servers for Claude Code
├── .claude/
│   ├── agents/                   QA, triage, planner, generator, healer agents
│   └── skills/jenkins-qa-loop/   run → triage → heal → approve → re-run
├── Jenkinsfile                   CI pipeline
├── ci/run-jenkins.sh             trigger Jenkins + collect results for triage
└── mcp-project/                  <- run npm / npx commands HERE
    ├── config/global-setup.js    logs in once, saves the session
    ├── db/setup.sql              creates + seeds the employees table
    ├── locators/  pages/         Page Object Model
    ├── mcp-server/               MCP servers, test executor, self-checks
    ├── specs/                    test plans written by the planner agent
    ├── tests/                    Playwright specs
    ├── tests-selfcheck/          intentional-failure spec for the QA agent
    ├── test-data/  utils/
    ├── playwright.config.js      main config (OrangeHRM, Chromium only)
    ├── playwright.db.config.js   DB-only + self-check config (no login)
    ├── .env.example              copy to .env and fill in
    └── .mcp.json                 employee-db only, if opened at mcp-project/
```

## Setup on a new machine

### 1. Install the tools

| Tool | macOS | Windows |
|---|---|---|
| Node.js (22 or newer) | `brew install node` | installer from nodejs.org |
| PostgreSQL | `brew install postgresql@16` then `brew services start postgresql@16` | installer from postgresql.org (includes pgAdmin) |

On macOS, Homebrew's Postgres has no `postgres` user by default. Create one
so it matches `.env`:

```bash
psql -d postgres -c "CREATE ROLE postgres WITH LOGIN SUPERUSER PASSWORD 'your_password';"
```

### 2. Install dependencies

From `mcp-project/`:

```bash
npm install
npx playwright install chromium
```

Don't copy `node_modules/` between machines (especially Windows ↔ Mac);
always reinstall it.

### 3. Create `.env`

Copy `.env.example` to `.env` and fill in this machine's values:

| Key | Meaning |
|---|---|
| `BASE_URL` | OrangeHRM site (default: the public demo) |
| `ORANGEHRM_USERNAME` / `ORANGEHRM_PASSWORD` | OrangeHRM admin login |
| `DB_HOST` / `DB_PORT` | usually `localhost` / `5432` |
| `DB_NAME` | database name, e.g. `playwrightdb` |
| `DB_USER` / `DB_PASSWORD` | Postgres login |

`.env` is gitignored. Never commit it or copy it into a shared ZIP.

### 4. Create the database

Use the same name as `DB_NAME` in `.env`:

```bash
psql -U postgres -c "CREATE DATABASE playwrightdb;"
psql -U postgres -d playwrightdb -f db/setup.sql
```

(Or in pgAdmin: create the database, open the Query Tool on it, paste
`db/setup.sql`, run.)

`db/setup.sql` drops and recreates the table, so re-run it any time to reset
to the 8 seed rows.

### 5. Check it

```bash
npm run db:check                                   # prints "DB connected"
npx playwright test --config=playwright.db.config.js --project=db-only
npm run mcp:test                                   # MCP server reads employee 1
npm run qa:check                                   # QA agent server self-checks
```

### 6. Use the MCP servers in Claude Code

Open **`MCP_Project/`** (the parent folder) in VS Code / Claude Code, so it
picks up the root `.mcp.json` and the QA agent. If Node was just installed,
reload the window first (Cmd/Ctrl+Shift+P → *Developer: Reload Window*).

## npm scripts

Run from `mcp-project/`. Run Playwright from here too: the saved login is
stored at the relative path `playwright/.auth/admin.json`.

| Script | Does |
|---|---|
| `npm test` | all specs, main config (logs in to OrangeHRM if needed) |
| `npm run test:headed` / `test:ui` | same, with a visible browser / UI mode |
| `npm run test:login` / `test:pim` / `test:admin` | one UI spec |
| `npm run auth:refresh` | force a fresh OrangeHRM login and save the session |
| `npm run db:check` | `SELECT NOW()` connection check |
| `npm run mcp:test` | calls `get_employee_by_id` on the employee-db server |
| `npm run qa:check` | stub-based checks of the qa-agent-readonly server |
| `npm run report` | open the last HTML report |

The saved session is reused for 30 minutes, then global setup logs in again.

## Which specs change data

| Spec | Touches | Writes? |
|---|---|---|
| `seed` | OrangeHRM | no (start page for the planner / generator agents) |
| `db-read` | Postgres | no |
| `db-create`, `db-update` | Postgres | INSERT / UPDATE |
| `ui-db-flow` | OrangeHRM + Postgres | creates in both |
| `login` | OrangeHRM | no |
| `api-employees`, `api-employees-advanced`, `api-admin-users` | OrangeHRM API | no (GET only) |
| `pim-addEmployee`, `admin-addUser` | OrangeHRM | creates employees / users |

## MCP servers

| Server | Tools | Can write? |
|---|---|---|
| `employee-db` (`mcp-server/mcpServer.js`) | get all / by id, create, update salary, delete, run a spec (or `all`) | **yes** |
| `qa-agent-readonly` (`mcp-server/qaAgentServer.js`) | list test targets, run a reviewed spec, get all / by id | no |

The `playwright-qa-agent` only uses `qa-agent-readonly`, and can only run
`db-read`, `api-employees` and the intentional-failure self-check (see
`mcp-server/qaTestCatalog.js`).
