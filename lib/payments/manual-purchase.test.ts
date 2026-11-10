import assert from "node:assert/strict";
import test from "node:test";

import { validateManualPurchaseAmounts } from "./manual-purchase";

const servers = ["server-1", "server-2", "server-3"];
const bundles = ["bundle-all"];

test("validates and totals one individual server purchase", () => {
  const amounts = validateManualPurchaseAmounts({
    keys: [servers[0]], serverIds: servers, bundleIds: bundles,
    amounts: [{ entitlementKey: servers[0], amountPaise: 15_900 }],
  });
  assert.deepEqual([...amounts], [[servers[0], 15_900]]);
  assert.equal([...amounts.values()].reduce((sum, amount) => sum + amount, 0), 15_900);
});

test("preserves independent prices for two and three selected servers", () => {
  for (const entries of [
    [{ entitlementKey: servers[0], amountPaise: 15_000 }, { entitlementKey: servers[1], amountPaise: 12_000 }],
    [{ entitlementKey: servers[0], amountPaise: 15_900 }, { entitlementKey: servers[1], amountPaise: 15_900 }, { entitlementKey: servers[2], amountPaise: 18_000 }],
  ]) {
    const amounts = validateManualPurchaseAmounts({
      keys: entries.map((entry) => entry.entitlementKey), serverIds: servers, bundleIds: bundles, amounts: entries,
    });
    assert.equal(amounts.size, entries.length);
    assert.equal([...amounts.values()].reduce((sum, amount) => sum + amount, 0), entries.reduce((sum, entry) => sum + entry.amountPaise, 0));
  }
});

test("validates one bundle purchase amount exactly once", () => {
  const amounts = validateManualPurchaseAmounts({
    keys: [bundles[0]], serverIds: servers, bundleIds: bundles, bundleAmountPaise: 40_500,
  });
  assert.deepEqual([...amounts], [[bundles[0], 40_500]]);
});

test("rejects missing, duplicated, and nonpositive individual prices", () => {
  assert.throws(() => validateManualPurchaseAmounts({ keys: servers.slice(0, 2), serverIds: servers, bundleIds: bundles, amounts: [{ entitlementKey: servers[0], amountPaise: 10_000 }] }));
  assert.throws(() => validateManualPurchaseAmounts({ keys: [servers[0]], serverIds: servers, bundleIds: bundles, amounts: [{ entitlementKey: servers[0], amountPaise: 10_000 }, { entitlementKey: servers[0], amountPaise: 12_000 }] }));
  assert.throws(() => validateManualPurchaseAmounts({ keys: [servers[0]], serverIds: servers, bundleIds: bundles, amounts: [{ entitlementKey: servers[0], amountPaise: 0 }] }));
});
