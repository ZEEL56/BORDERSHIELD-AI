import { summary } from "./_harness";
import * as validationTests from "./validation.test";
import * as riskTests from "./risk.test";
import * as auditTests from "./audit.test";

console.log("\n\x1b[1mBorderShield AI — test suite\x1b[0m\n");

console.log("Document Validation Service");
validationTests.run();

console.log("\nRisk Assessment Engine");
riskTests.run();

console.log("\nAudit Hash Chain");
auditTests.run();

const { passed, failed, failures } = summary();
console.log(`\n${passed} passed, ${failed} failed\n`);

if (failed > 0) {
  console.error("Failures:\n" + failures.map((f) => `  - ${f}`).join("\n"));
  process.exit(1);
}
