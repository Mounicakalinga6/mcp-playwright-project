// @ts-check
import { pathToFileURL } from 'url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import {
  getAllEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployeeSalary,
  deleteEmployee,
} from '../utils/employeeRepository.js';
import { runPlaywrightTest, RUNNABLE_TEST_TARGETS } from './playwrightTestExecutor.js';

/**
 * Builds the MCP server and registers its tools. Exported as a factory
 * (instead of connecting a transport here directly) so manualToolCheck.js
 * can create the same server and talk to it in-memory, without needing a
 * real AI client like Claude Desktop connected yet.
 */
export function createServer() {
  const server = new McpServer({ name: 'mcp-project-employees', version: '1.0.0' });

  server.registerTool(
    'get_all_employees',
    {
      title: 'Get All Employees',
      description: 'Returns every employee row from the Postgres employees table.',
      inputSchema: {},
    },
    async () => {
      const employees = await getAllEmployees();
      return {
        content: [{ type: 'text', text: JSON.stringify(employees, null, 2) }],
      };
    }
  );

  server.registerTool(
    'get_employee_by_id',
    {
      title: 'Get Employee By ID',
      description: 'Returns one employee row from the Postgres employees table, given its numeric id.',
      inputSchema: { id: z.number() },
    },
    async ({ id }) => {
      const employee = await getEmployeeById(id);
      return {
        content: [{ type: 'text', text: JSON.stringify(employee, null, 2) }],
      };
    }
  );

  server.registerTool(
    'create_employee',
    {
      title: 'Create Employee',
      description: 'Inserts a new employee row into the Postgres employees table and returns the created row, including its new id.',
      inputSchema: {
        name: z.string(),
        email: z.string(),
        department: z.string(),
        salary: z.number(),
      },
    },
    async ({ name, email, department, salary }) => {
      const employee = await createEmployee({ name, email, department, salary });
      return {
        content: [{ type: 'text', text: JSON.stringify(employee, null, 2) }],
      };
    }
  );

  server.registerTool(
    'update_employee_salary',
    {
      title: 'Update Employee Salary',
      description: 'Updates one employee\'s salary, given their numeric id, and returns the updated row.',
      inputSchema: { id: z.number(), salary: z.number() },
    },
    async ({ id, salary }) => {
      const employee = await updateEmployeeSalary(id, salary);
      return {
        content: [{ type: 'text', text: JSON.stringify(employee, null, 2) }],
      };
    }
  );

  server.registerTool(
    'delete_employee',
    {
      title: 'Delete Employee',
      description: 'Permanently deletes one employee row, given its numeric id, and returns the deleted row.',
      inputSchema: { id: z.number() },
    },
    async ({ id }) => {
      const employee = await deleteEmployee(id);
      return {
        content: [{ type: 'text', text: JSON.stringify(employee, null, 2) }],
      };
    }
  );

  server.registerTool(
    'run_playwright_test',
    {
      title: 'Run Playwright Test',
      description:
        'Runs one Playwright spec file from this project, or the whole suite if target is "all", ' +
        'and returns a pass/fail summary, including any failure messages. Takes real time ' +
        '(a real browser runs against a live site) — running "all" takes noticeably longer.',
      inputSchema: { target: z.enum(RUNNABLE_TEST_TARGETS) },
    },
    async ({ target }) => {
      const summary = await runPlaywrightTest(target);
      return {
        content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }],
      };
    }
  );

  return server;
}

// Only start listening on stdio when this file is run directly (e.g. by an
// MCP client like Claude Desktop) — not when createServer() is imported for
// the in-memory check in manualToolCheck.js.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
