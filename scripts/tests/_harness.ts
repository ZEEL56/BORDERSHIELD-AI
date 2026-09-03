let passed = 0;
let failed = 0;
const failures: string[] = [];

export function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  } catch (err: any) {
    failed++;
    failures.push(`${name}: ${err.message}`);
    console.log(`  \x1b[31m✕\x1b[0m ${name} — ${err.message}`);
  }
}

export function assertEqual(actual: unknown, expected: unknown, message: string) {
  if (actual !== expected) {
    throw new Error(`${message} (expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)})`);
  }
}

export function assertTrue(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

export function summary(): { passed: number; failed: number; failures: string[] } {
  return { passed, failed, failures };
}
