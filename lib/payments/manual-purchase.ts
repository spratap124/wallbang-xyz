export type ManualEntitlementAmount = { entitlementKey: string; amountPaise: number };

/** Validate one bundle price or an independent price for each server. */
export function validateManualPurchaseAmounts(input: {
  keys: string[];
  serverIds: string[];
  bundleIds: string[];
  amounts?: ManualEntitlementAmount[];
  bundleAmountPaise?: number;
  legacyAmountPaise?: number;
}): Map<string, number> {
  const validAmount = (amount: number | undefined): amount is number => Number.isInteger(amount) && (amount ?? 0) > 0;
  const bundleSet = new Set(input.bundleIds);
  const serverSet = new Set(input.serverIds);
  const bundles = input.keys.filter((key) => bundleSet.has(key));
  if (bundles.length) {
    if (input.keys.length !== 1 || bundles.length !== 1 || !validAmount(input.bundleAmountPaise) || input.amounts?.length) {
      throw new Error("Select one bundle and provide one bundle purchase amount.");
    }
    return new Map([[bundles[0], input.bundleAmountPaise]]);
  }
  if (input.keys.some((key) => !serverSet.has(key))) {
    throw new Error("Purchase entitlements must be valid servers or one bundle.");
  }
  if (input.amounts) {
    const amounts = new Map(input.amounts.map(({ entitlementKey, amountPaise }) => [entitlementKey, amountPaise]));
    if (input.amounts.some(({ amountPaise }) => !validAmount(amountPaise)) || amounts.size !== input.amounts.length || input.keys.length !== amounts.size || input.keys.some((key) => !amounts.has(key)) || input.legacyAmountPaise) {
      throw new Error("Provide exactly one valid amount for every selected individual server.");
    }
    return amounts;
  }
  if (input.keys.length === 1 && validAmount(input.legacyAmountPaise)) {
    return new Map([[input.keys[0], input.legacyAmountPaise]]);
  }
  throw new Error("Provide a separate purchase amount for every selected individual server.");
}
