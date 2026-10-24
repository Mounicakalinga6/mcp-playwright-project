// @ts-check
import { query } from './dbClient.js';

export async function getAllEmployees() {
  const result = await query('SELECT * FROM employees');
  return result.rows;
}

/** @param {number} id */
export async function getEmployeeById(id) {
  const result = await query('SELECT * FROM employees WHERE id = $1', [id]);
  return result.rows[0];
}

/** @param {{name: string, email: string, department: string, salary: number}} employee */
export async function createEmployee(employee) {
  const result = await query(
    'INSERT INTO employees (name, email, department, salary) VALUES ($1, $2, $3, $4) RETURNING *',
    [employee.name, employee.email, employee.department, employee.salary]
  );
  return result.rows[0];
}

/**
 * @param {number} id
 * @param {number} salary
 */
export async function updateEmployeeSalary(id, salary) {
  const result = await query(
    'UPDATE employees SET salary = $1 WHERE id = $2 RETURNING *',
    [salary, id]
  );
  return result.rows[0];
}

/** @param {string} name */
export async function getEmployeeByName(name) {
  const result = await query('SELECT * FROM employees WHERE name = $1', [name]);
  return result.rows[0];
}

/** @param {number} id */
export async function deleteEmployee(id) {
  const result = await query('DELETE FROM employees WHERE id = $1 RETURNING *', [id]);
  return result.rows[0];
}
