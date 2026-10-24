// @ts-check
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from './mcpServer.js';
import { closePool } from '../utils/dbClient.js';

// This simulates what Claude Desktop would do: connect as an MCP client and
// call a tool by name. It runs the server and client in the SAME process,
// linked by an in-memory transport, so we can prove the tool works without
// needing a real AI client wired up yet.
const server = createServer();
const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

const client = new Client({ name: 'test-client', version: '1.0.0' });

await server.connect(serverTransport);
await client.connect(clientTransport);

const result = await client.callTool({
  name: 'get_employee_by_id',
  arguments: { id: 1 },
});

// callTool()'s return type is generic without a result schema passed in —
// we know the shape we defined in mcpServer.js, so this cast is safe here.
const content = /** @type {any} */ (result).content;

console.log('MCP tool result:');
console.log(content[0].text);

await closePool();
process.exit(0);
