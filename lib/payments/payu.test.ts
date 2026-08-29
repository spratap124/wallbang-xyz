import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { generateInvoiceNumber } from "./invoice-number";
import {
  buildPayuRequestHashSequence,
  buildPayuResponseHashSequence,
  hashPayuRequest,
  hashPayuResponse,
  verifyPayuResponseHashValue,
} from "./payu-hash";

describe("payu hash", () => {
  it("builds request hash sequences", () => {
    const sequence = buildPayuRequestHashSequence({
      key: "testKey",
      salt: "testSalt",
      txnid: "wb_test123",
      amount: "99.00",
      productinfo: "WallBang VIP",
      firstname: "Player",
      email: "player@example.com",
      udf1: "user-1",
      udf2: "steam-1",
      udf3: "1_month",
      udf4: "retake-1-mumbai",
      udf5: "INDIVIDUAL_SERVER",
    });

    assert.match(
      sequence,
      /^testKey\|wb_test123\|99\.00\|WallBang VIP\|Player\|player@example\.com\|/,
    );
  });

  it("hashes request and response payloads", () => {
    const requestHash = hashPayuRequest({
      key: "testKey",
      salt: "testSalt",
      txnid: "wb_test123",
      amount: "99.00",
      productinfo: "WallBang VIP",
      firstname: "Player",
      email: "player@example.com",
    });

    assert.equal(requestHash.length, 128);

    const responseSequence = buildPayuResponseHashSequence({
      key: "testKey",
      salt: "testSalt",
      txnid: "wb_test123",
      amount: "99.00",
      productinfo: "WallBang VIP",
      firstname: "Player",
      email: "player@example.com",
      status: "success",
    });

    assert.match(responseSequence, /^testSalt\|success\|/);

    const responseHash = hashPayuResponse({
      key: "testKey",
      salt: "testSalt",
      txnid: "wb_test123",
      amount: "99.00",
      productinfo: "WallBang VIP",
      firstname: "Player",
      email: "player@example.com",
      status: "success",
    });

    assert.equal(
      verifyPayuResponseHashValue({
        key: "testKey",
        salt: "testSalt",
        txnid: "wb_test123",
        amount: "99.00",
        productinfo: "WallBang VIP",
        firstname: "Player",
        email: "player@example.com",
        status: "success",
        hash: responseHash,
      }),
      true,
    );
  });
});

describe("invoice number", () => {
  it("generates deterministic invoice numbers", () => {
    const paidAt = new Date("2026-08-29T10:00:00.000Z");
    const paymentId = "ed4c71f7-73ca-4cac-bbf7-dcfb6d4d135f";
    assert.equal(
      generateInvoiceNumber(paidAt, paymentId),
      "WB-20260829-ED4C71F7",
    );
  });
});
