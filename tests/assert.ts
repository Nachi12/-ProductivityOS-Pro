import assert from 'assert';

export function describe(name: string, fn: () => void) {
  console.log(`\n--- ${name} ---`);
  fn();
}

export function it(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (err: any) {
    console.error(`  ✕ ${name}: ${err.message}`);
    throw err;
  }
}

export const expect = (actual: any) => ({
  toBe: (expected: any) => assert.strictEqual(actual, expected),
  toBeGreaterThan: (expected: number) => assert.ok(actual > expected, `Expected ${actual} > ${expected}`),
  toBeLessThan: (expected: number) => assert.ok(actual < expected, `Expected ${actual} < ${expected}`),
  toHaveLength: (expected: number) => assert.strictEqual(actual.length, expected),
  not: {
    toBe: (expected: any) => assert.notStrictEqual(actual, expected)
  }
});
