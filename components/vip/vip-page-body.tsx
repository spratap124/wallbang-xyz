"use client";

import { useCallback, useState } from "react";

import {
  VipMembershipDashboard,
  type VipRenewTarget,
} from "@/components/vip/vip-membership-dashboard";
import { VipShop } from "@/components/vip/vip-shop";
import type { VipMembershipView, VipShopCatalog } from "@/types/vip";

import type { PaymentProvider } from "@/types/payments";

type VipPageBodyProps = {
  catalog: VipShopCatalog;
  loggedIn: boolean;
  purchasesEnabled: boolean;
  paymentProvider: PaymentProvider;
  checkoutEnabled: boolean;
  allRetakesEnabled: boolean;
  hideBuy?: boolean;
  membership: VipMembershipView | null;
};

export function VipPageBody({
  catalog,
  loggedIn,
  purchasesEnabled,
  paymentProvider,
  checkoutEnabled,
  allRetakesEnabled,
  hideBuy = false,
  membership,
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
        paymentProvider={paymentProvider}
        checkoutEnabled={checkoutEnabled}
        allRetakesEnabled={allRetakesEnabled}
        hideBuy={hideBuy}
        renewTarget={renewTarget}
      />
    </>
  );
}
