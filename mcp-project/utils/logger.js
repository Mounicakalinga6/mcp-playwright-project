// @ts-check

/** @param {string} message */
export function logInfo(message) {
  console.log(`[INFO] ${message}`);
}

/** @param {string} message */
export function logWarn(message) {
  console.warn(`[WARN] ${message}`);
}

/** @param {string} message */
export function logError(message) {
  console.error(`[ERROR] ${message}`);
}
