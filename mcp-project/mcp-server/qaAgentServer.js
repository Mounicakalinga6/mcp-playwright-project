// @ts-check
import { pathToFileURL } from 'url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { getAllEmployees, getEmployeeById } from '../utils/employeeRepository.js';
import { runPlaywrightTest } from './playwrightTestExecutor.js';
import { REVIEWED_TEST_TARGETS, TEST_CATALOG, EXCLUDED_TARGETS } from './qaTestCatalog.js';
import { evaluateSelfCheck } from './selfCheckVerdict.js';

/** @param {unknown} value */
function asText(value) {
  return { content: [{ type: /** @type {const} */ ('text'), text: JSON.stringify(value, null, 2) }] };
}

/**
 * Read-only MCP server for the Playwright QA agent. Exposes no write tools,
 * and can only run reviewed, non-mutating specs — one file at a time.
 *
 * Dependencies are injectable so qaAgentToolCheck.js can swap in stubs and
 * prove the safety rules without running a test or querying the database.
 * @param {{
 *   runTest?: (target: any, options: {
 *     detailed: boolean, traceOnFailure: boolean, noAuthRefresh: boolean,
 *     configFile: string | null, testPath: string, project: string | null,
 *   }) => Promise<unknown>,
 *   readAllEmployees?: () => Promise<unknown>,
 *   readEmployeeById?: (id: number) => Promise<unknown>,
 * }} [deps]
 */
export function createQaServer({
  runTest = runPlaywrightTest,
  readAllEmployees = getAllEmployees,
  readEmployeeById = getEmployeeById,
} = {}) {
  const server = new McpServer({ name: 'qa-agent-readonly', version: '1.0.0' });

  server.registerTool(
    'list_test_targets',
    {
      title: 'List Test Targets',
      description:
        'Lists the reviewed, non-mutating Playwright specs this agent may run, what each one covers, ' +
        'and which specs are excluded and why. Call this before run_playwright_test.',
      inputSchema: {},
    },
    async () => asText({ allowed: TEST_CATALOG, excluded: EXCLUDED_TARGETS })
  );

  server.registerTool(
    'run_playwright_test',
    {
      title: 'Run Reviewed Playwright Spec',
      description:
        'Runs ONE reviewed, non-mutating Playwright spec and returns pass/fail counts plus, for each failure, ' +
        'the cleaned error text, file:line, and screenshot/trace paths (only reported if the file exists). ' +
        'Never logs in: if the saved session is stale it returns a setupError asking the user to refresh it. ' +
        'For self-check targets (expectedOutcome "fail"), read the selfCheck field: verified=true means the ' +
        'intentional failure and its evidence were confirmed; verified=false lists the problems. ' +
        'Takes real time (a few seconds to ~40s).',
      inputSchema: { target: z.enum(REVIEWED_TEST_TARGETS) },
    },
    async ({ target }) => {
      const entry = TEST_CATALOG[target];
      const result = /** @type {any} */ (
        await runTest(target, {
          detailed: true,
          traceOnFailure: true,
          noAuthRefresh: true,
          configFile: entry.config,
          testPath: entry.path,
          project: entry.project,
        })
      );
      if (entry.expectedOutcome === 'fail') {
        return asText({ ...result, expectedOutcome: 'fail', selfCheck: evaluateSelfCheck(result, entry) });
      }
      return asText({ ...result, expectedOutcome: entry.expectedOutcome });
    }
  );

  server.registerTool(
    'get_all_employees',
    {
      title: 'Get All Employees (read-only)',
      description:
        'Returns every row from the local practice Postgres employees table. ' +
        "This is NOT OrangeHRM's data — OrangeHRM's database is not accessible.",
      inputSchema: {},
    },
    async () => asText(await readAllEmployees())
  );

  server.registerTool(
    'get_employee_by_id',
    {
      title: 'Get Employee By ID (read-only)',
      description:
        'Returns one row from the local practice Postgres employees table by numeric id. ' +
        "This is NOT OrangeHRM's data.",
      inputSchema: { id: z.number() },
    },
    async ({ id }) => asText(await readEmployeeById(id))
  );

  return server;
}

// Only listen on stdio when launched directly by an MCP client, not when
// imported by qaAgentToolCheck.js.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = createQaServer();
  await server.connect(new StdioServerTransport());
}
