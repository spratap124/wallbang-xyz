import assert from "node:assert/strict";
import test from "node:test";
import { parsePayuAmountToPaise } from "./payu";

test("PayU amounts require a positive exact decimal value", () => {
  for (const value of ["", "abc", "12x", "1.234", "0", "0.00", "-1", "1e3"]) {
    assert.ok(Number.isNaN(parsePayuAmountToPaise(value)), value);
  }
  assert.equal(parsePayuAmountToPaise("50.00"), 5000);
  assert.equal(parsePayuAmountToPaise("1.2"), 120);
  assert.ok(Number.isNaN(parsePayuAmountToPaise(undefined as unknown as string)));
});
