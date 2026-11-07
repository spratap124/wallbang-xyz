import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseGaSessionId } from "./gtag";

describe("parseGaSessionId", () => {
  it("reads the session id from the GS2 cookie format (May 2025+)", () => {
    assert.equal(
      parseGaSessionId("GS2.1.s1694691723$o3$g0$t1694691723$j60$l0$h0"),
      "1694691723",
    );
    assert.equal(
      parseGaSessionId("GS2.1.s1759485027$o1$g1$t1759485099"),
      "1759485027",
    );
  });

  it("reads the session id from the legacy GS1 cookie format", () => {
    assert.equal(
      parseGaSessionId("GS1.1.1746825440.14.0.17468254406.0.0.295082955"),
      "1746825440",
    );
  });

  it("tolerates URL-encoded cookie values", () => {
    assert.equal(
      parseGaSessionId("GS2.1.s1694691723%24o3%24g0%24t1694691723"),
      "1694691723",
    );
  });

  it("returns null for empty or unrecognized values", () => {
    assert.equal(parseGaSessionId(""), null);
    assert.equal(parseGaSessionId("garbage"), null);
  });
});
