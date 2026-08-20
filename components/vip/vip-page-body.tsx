"use client";

import { useCallback, useState } from "react";

import {
  VipMembershipDashboard,
  type VipRenewTarget,
} from "@/components/vip/vip-membership-dashboard";
import { VipShop } from "@/components/vip/vip-shop";
import type { VipMembershipView, VipShopCatalog } from "@/types/vip";

type VipPageBodyProps = {
  catalog: VipShopCatalog;
  loggedIn: boolean;
  purchasesEnabled: boolean;
  checkoutEnabled: boolean;
  allRetakesEnabled: boolean;
  hideBuy?: boolean;
  membership: VipMembershipView | null;
  paid?: boolean;
};

export function VipPageBody({
  catalog,
  loggedIn,
  purchasesEnabled,
  checkoutEnabled,
  allRetakesEnabled,
  hideBuy = false,
  membership,
  paid = false,
}: VipPageBodyProps) {
  const [renewTarget, setRenewTarget] = useState<VipRenewTarget | null>(null);
  const showPurchaseHeading =
    loggedIn && (membership?.hasActiveVip || membership?.lifetime);

  const handleRenew = useCallback((target: VipRenewTarget) => {
    setRenewTarget(target);
    requestAnimationFrame(() => {
      document.getElementById("vip-shop")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }, []);

  return (
    <>
      {loggedIn ? (
        <VipMembershipDashboard
          membership={membership}
          paid={paid}
          onRenew={handleRenew}
        />
      ) : null}

      {showPurchaseHeading ? (
        <h2 className="mb-6 text-lg font-semibold tracking-tight">
          Buy / Renew VIP
        </h2>
      ) : null}

      <VipShop
        catalog={catalog}
        loggedIn={loggedIn}
        purchasesEnabled={purchasesEnabled}
        checkoutEnabled={checkoutEnabled}
        allRetakesEnabled={allRetakesEnabled}
        hideBuy={hideBuy}
        renewTarget={renewTarget}
      />
    </>
  );
}
