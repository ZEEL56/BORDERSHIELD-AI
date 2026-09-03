import { computeHash } from "../../src/lib/audit";
import { assertEqual, assertTrue, test } from "./_harness";

export function run() {
  test("computeHash is deterministic for identical inputs", () => {
    const h1 = computeHash("prev", "TEST_EVENT", { a: 1 }, "2026-01-01T00:00:00.000Z");
    const h2 = computeHash("prev", "TEST_EVENT", { a: 1 }, "2026-01-01T00:00:00.000Z");
    assertEqual(h1, h2, "identical inputs must produce identical hashes");
  });

  test("computeHash changes when event data changes", () => {
    const h1 = computeHash("prev", "TEST_EVENT", { a: 1 }, "2026-01-01T00:00:00.000Z");
    const h2 = computeHash("prev", "TEST_EVENT", { a: 2 }, "2026-01-01T00:00:00.000Z");
    assertTrue(h1 !== h2, "different event data must produce different hashes");
  });

  test("computeHash changes when previousHash changes (chain linkage)", () => {
    const h1 = computeHash("prevA", "TEST_EVENT", { a: 1 }, "2026-01-01T00:00:00.000Z");
    const h2 = computeHash("prevB", "TEST_EVENT", { a: 1 }, "2026-01-01T00:00:00.000Z");
    assertTrue(h1 !== h2, "different previousHash must produce different hashes — this is what makes tampering detectable");
  });

  test("hash output is a 64-character hex string (SHA-256)", () => {
    const h = computeHash("prev", "TEST_EVENT", { a: 1 }, "2026-01-01T00:00:00.000Z");
    assertTrue(/^[a-f0-9]{64}$/.test(h), "expected a 64-char lowercase hex SHA-256 digest");
  });
}
