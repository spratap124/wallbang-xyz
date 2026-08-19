"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import type { ApiResult } from "@/lib/api/waitlist";

type RazorpayCheckoutResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type RazorpayInstance = {
  open: () => void;
};

type RazorpayConstructor = new (options: Record<string, unknown>) => RazorpayInstance;

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

type CreateOrderData = {
  orderId: string;
  amount: number;
  currency: "INR";
  plan: string;
  keyId: string;
  name: string;
  description: string;
  prefill: { name: string };
};

function loadRazorpayScript(): Promise<RazorpayConstructor> {
  if (window.Razorpay) return Promise.resolve(window.Razorpay);

  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      "script[data-razorpay-checkout]",
    );
    if (existing) {
      existing.addEventListener("load", () => {
        if (window.Razorpay) resolve(window.Razorpay);
        else reject(new Error("Razorpay failed to load."));
      });
      existing.addEventListener("error", () =>
        reject(new Error("Razorpay failed to load.")),
      );
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.dataset.razorpayCheckout = "true";
    script.onload = () => {
      if (window.Razorpay) resolve(window.Razorpay);
      else reject(new Error("Razorpay failed to load."));
    };
    script.onerror = () => reject(new Error("Razorpay failed to load."));
    document.body.appendChild(script);
  });
}

type BuyVipButtonProps = {
  planId: string;
  serverIds: string[];
  label: string;
  loggedIn: boolean;
  disabled?: boolean;
};

export function BuyVipButton({
  planId,
  serverIds,
  label,
  loggedIn,
  disabled = false,
}: BuyVipButtonProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout(): Promise<void> {
    setError(null);
    if (!loggedIn) {
      window.location.href = `/api/auth/steam?returnTo=${encodeURIComponent("/vip")}`;
      return;
    }

    setBusy(true);
    try {
      const Razorpay = await loadRazorpayScript();
      const response = await fetch("/api/v1/payments/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, serverIds }),
      });
      const payload = (await response.json()) as ApiResult<CreateOrderData>;
      if (!payload.ok) {
        throw new Error(payload.error);
      }

      const checkout = new Razorpay({
        key: payload.data.keyId,
        amount: payload.data.amount,
        currency: payload.data.currency,
        name: payload.data.name,
        description: payload.data.description,
        order_id: payload.data.orderId,
        prefill: payload.data.prefill,
        theme: { color: "#e8242a" },
        modal: {
          ondismiss: () => {
            setBusy(false);
          },
        },
        handler: async (result: RazorpayCheckoutResponse) => {
          try {
            const verify = await fetch("/api/v1/payments/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(result),
            });
            const verified = (await verify.json()) as ApiResult<unknown>;
            if (!verified.ok) {
              throw new Error(verified.error);
            }
            router.push("/vip?paid=1");
            router.refresh();
          } catch (err) {
            setError(
              err instanceof Error
                ? err.message
                : "Payment succeeded but VIP is still confirming. Refresh in a moment.",
            );
            setBusy(false);
          }
        },
      });

      checkout.open();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start checkout.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button
        className="h-11 w-full"
        size="lg"
        disabled={disabled || busy}
        onClick={() => void startCheckout()}
      >
        {busy ? "Opening checkout…" : label}
      </Button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
