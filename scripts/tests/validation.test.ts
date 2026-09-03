import { validateDocument } from "../../src/services/validation.service";
import { assertEqual, assertTrue, test } from "./_harness";

export function run() {
  test("passport with all fields passes structural checks", () => {
    const result = validateDocument("PASSPORT", [
      { field: "Full Name", value: "ROHAN VERMA", confidence: 95 },
      { field: "Passport Number", value: "M4521678", confidence: 95 },
      { field: "Date of Birth", value: "14/03/1990", confidence: 95 },
      { field: "Date of Expiry", value: "10/06/2031", confidence: 95 },
    ]);
    assertEqual(result.failed, 0, "expected zero failed checks");
    assertTrue(result.isValid, "document should be valid");
  });

  test("missing required field produces a fail check", () => {
    const result = validateDocument("PASSPORT", [
      { field: "Full Name", value: "ROHAN VERMA", confidence: 95 },
    ]);
    assertTrue(result.failed > 0, "expected at least one failed check for missing fields");
    assertTrue(!result.isValid, "document should be invalid");
  });

  test("expired document is flagged EXP_EXPIRED", () => {
    const result = validateDocument("VISA", [
      { field: "Visa Number", value: "V2233445", confidence: 90 },
      { field: "Visa Type", value: "TOURIST", confidence: 90 },
      { field: "Entry Validity", value: "01/01/2020", confidence: 90 },
    ]);
    const check = result.checks.find((c) => c.code === "EXP_EXPIRED");
    assertTrue(!!check, "expected EXP_EXPIRED check to be present");
  });

  test("expiry before date of birth fails date-sequence check", () => {
    const result = validateDocument("NATIONAL_ID", [
      { field: "Document Number", value: "ID12345", confidence: 90 },
      { field: "Full Name", value: "TEST USER", confidence: 90 },
      { field: "Date of Birth", value: "01/01/2000", confidence: 90 },
      { field: "Expiry Date", value: "01/01/1999", confidence: 90 },
    ]);
    const check = result.checks.find((c) => c.code === "LOGIC_DOB_LT_EXPIRY");
    assertEqual(check?.status, "fail", "expected date sequence check to fail");
  });
}
