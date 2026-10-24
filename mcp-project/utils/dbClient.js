// @ts-check
import pg from 'pg';
import { config } from './env.js';

const { Pool } = pg;

/** @type {pg.Pool | undefined} */
let pool;

/** Lazily creates a single shared connection pool for the test run. */
function getPool() {
  if (!pool) {
    pool = new Pool(config.db);
  }
  return pool;
}

/**
 * Runs a parameterized query against Postgres.
 * @param {string} text
 * @param {any[]} [params]
 */
export async function query(text, params = []) {
  const client = getPool();
  return client.query(text, params);
}

/** Closes the pool. Call from global teardown so the process can exit cleanly. */
export async function closePool() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}
