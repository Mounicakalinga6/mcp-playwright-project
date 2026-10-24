// @ts-check
import { z } from 'zod';

// Response "contracts" for the OrangeHRM demo API, written from REAL responses
// observed with read-only GET requests (not guessed). Shared by the API specs
// so every test checks the same shape.
//
// The demo is shared and other people edit its data constantly, so these check
// structure and types only, never specific names or totals.

export const employeeSchema = z.object({
  empNumber: z.number().int(),
  // Seen as strings; nullable because shared-demo data entered by other
  // people is not guaranteed to fill every optional text field.
  employeeId: z.string().nullable(),
  firstName: z.string(),
  middleName: z.string().nullable(),
  lastName: z.string(),
  terminationId: z.number().int().nullable(),
});

export const userRoleSchema = z.object({
  id: z.number().int(),
  name: z.enum(['Admin', 'ESS']),
  displayName: z.string(),
});

export const adminUserSchema = z.object({
  id: z.number().int(),
  userName: z.string(),
  deleted: z.boolean(),
  status: z.boolean(),
  employee: employeeSchema,
  userRole: userRoleSchema,
});

/**
 * List endpoints share one envelope: { data: [...], meta: { total }, rels: [] }
 * @template {z.ZodTypeAny} T
 * @param {T} itemSchema
 */
export function listSchema(itemSchema) {
  return z.object({
    data: z.array(itemSchema),
    meta: z.object({ total: z.number().int().nonnegative() }),
    rels: z.array(z.unknown()),
  });
}

/**
 * Single-record endpoints: { data: {...}, meta, rels }
 * @template {z.ZodTypeAny} T
 * @param {T} itemSchema
 */
export function singleSchema(itemSchema) {
  return z.object({ data: itemSchema });
}

/** Observed for invalid query params and an unknown employee id (status 422). */
export const invalidParamErrorSchema = z.object({
  error: z.object({
    status: z.literal('422'),
    message: z.literal('Invalid Parameter'),
    data: z.object({ invalidParamKeys: z.array(z.string()) }),
  }),
});

/** Observed for an unknown admin user id (status 404). */
export const notFoundErrorSchema = z.object({
  error: z.object({
    status: z.literal('404'),
    message: z.literal('Record Not Found'),
  }),
});

/**
 * Every key name anywhere in a JSON value, used to check for leaked fields
 * (checking key names, not text, avoids false alarms from a username that
 * happens to contain the word "password").
 * @param {unknown} value
 * @param {Set<string>} keys
 */
export function allKeys(value, keys = new Set()) {
  if (Array.isArray(value)) {
    value.forEach((v) => allKeys(v, keys));
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      keys.add(k.toLowerCase());
      allKeys(v, keys);
    }
  }
  return keys;
}
