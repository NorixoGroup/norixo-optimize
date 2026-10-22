/**
 * TEST SUPPORT ONLY. Runs `fn` while a test helper has swapped part of a global table, and refuses the two misuses that
 * would leave the swap wrong: a nested call of the same helper, and an asynchronous callback (the table would be restored
 * before the callback finishes, so it would silently run against the real table). The caller restores in its own `finally`.
 */
const ACTIVE = new Set<string>();

export function runExclusive<T>(name: string, fn: () => T, restore: () => void, swap: () => void): T {
  if (ACTIVE.has(name)) throw new Error(`${name}: nested use refused`);
  ACTIVE.add(name);
  try {
    swap();
    const result = fn();
    if (typeof result === "object" && result !== null && typeof (result as { then?: unknown }).then === "function") {
      // the promise is detached so that it cannot become an unhandled rejection of its own
      Promise.resolve(result).catch(() => undefined);
      throw new TypeError(`${name}: asynchronous callbacks are refused (the table is restored when this function returns)`);
    }
    return result;
  } finally {
    try {
      restore();
    } finally {
      ACTIVE.delete(name);
    }
  }
}
