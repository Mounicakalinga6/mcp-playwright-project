// @ts-check
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

// Resolve .env relative to this file, not the current working directory —
// whoever launches this script (Playwright, a plain `node` command, or an
// MCP host like an AI client) may start it from a different folder.
const envPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env');
dotenv.config({ path: envPath });

export const config = {
  baseUrl: process.env.BASE_URL || 'https://opensource-demo.orangehrmlive.com',
  adminUsername: process.env.ORANGEHRM_USERNAME || 'Admin',
  adminPassword: process.env.ORANGEHRM_PASSWORD || 'admin123',

  db: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'playwrightdb',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
  },
};
