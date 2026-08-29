"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ApiResult } from "@/lib/api/waitlist";
import type { PaymentProvider } from "@/types/payments";
import type { VipAccessType } from "@/types/vip";

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

type CreateRazorpayOrderData = {
  orderId: string;
  amount: number;
  currency: "INR";
  plan: string;
  keyId: string;
  name: string;
  description: string;
  prefill: { name: string; email: string; contact: string };
};

type PayuCheckoutParams = Record<string, string | undefined>;

type CreatePayuOrderData = {
  provider: "payu";
  action: string;
  params: PayuCheckoutParams;
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
        else reject(new Error("Payment checkout failed to load."));
      });
      existing.addEventListener("error", () =>
        reject(new Error("Payment checkout failed to load.")),
      );
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.dataset.razorpayCheckout = "true";
    script.onload = () => {
      if (window.Razorpay) resolve(window.Razorpay);
      else reject(new Error("Payment checkout failed to load."));
    };
    script.onerror = () => reject(new Error("Payment checkout failed to load."));
    document.body.appendChild(script);
  });
}

function submitPayuForm(action: string, params: PayuCheckoutParams): void {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = action;
  form.style.display = "none";

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = key;
    input.value = value;
    form.appendChild(input);
  }

  document.body.appendChild(form);
  form.submit();
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidIndianPhone(value: string): boolean {
  return /^[6-9]\d{9}$/.test(value);
}

type BuyVipButtonProps = {
  accessType: VipAccessType;
  planId: string;
  serverId: string | null;
  label: string;
  loggedIn: boolean;
  paymentProvider: PaymentProvider;
  disabled?: boolean;
  collectContact?: boolean;
};

export function BuyVipButton({
  accessType,
  planId,
  serverId,
  label,
  loggedIn,
  paymentProvider,
  disabled = false,
  collectContact = true,
}: BuyVipButtonProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [collectingContact, setCollectingContact] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  function beginCheckout(): void {
    setError(null);
    if (!loggedIn) {
      window.location.href = `/api/auth/steam?returnTo=${encodeURIComponent("/vip")}`;
      return;
    }
    if (collectContact) {
      setCollectingContact(true);
      return;
    }
    void openCheckout();
  }

  async function openCheckout(): Promise<void> {
    setError(null);

    const trimmedEmail = email.trim();
    const trimmedPhone = phone.trim().replace(/\s+/g, "");

    if (collectContact) {
      if (!isValidEmail(trimmedEmail)) {
        setError("Enter a valid email address.");
        return;
      }
      if (!isValidIndianPhone(trimmedPhone)) {
        setError("Enter a valid 10-digit Indian mobile number.");
        return;
      }
    }

    setBusy(true);
    try {
      if (paymentProvider === "payu") {
        await openPayuCheckout(trimmedEmail, trimmedPhone);
        return;
      }
      await openRazorpayCheckout(trimmedEmail, trimmedPhone);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start checkout.");
      setBusy(false);
    }
  }

  async function openPayuCheckout(
    trimmedEmail: string,
    trimmedPhone: string,
  ): Promise<void> {
    const response = await fetch("/api/v1/payments/payu/create-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accessType,
        planId,
        ...(serverId ? { serverId } : {}),
        email: trimmedEmail,
        phone: trimmedPhone,
      }),
    });
    const payload = (await response.json()) as ApiResult<CreatePayuOrderData>;
    if (!payload.ok) {
      throw new Error(payload.error);
    }

    submitPayuForm(payload.data.action, payload.data.params);
  }

  async function openRazorpayCheckout(
    trimmedEmail: string,
    trimmedPhone: string,
  ): Promise<void> {
    const Razorpay = await loadRazorpayScript();
    const response = await fetch("/api/v1/payments/create-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accessType,
        planId,
        ...(serverId ? { serverId } : {}),
        email: trimmedEmail,
        phone: trimmedPhone,
      }),
    });
    const payload = (await response.json()) as ApiResult<CreateRazorpayOrderData>;
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
          setBusy(false);
          setCollectingContact(false);
          setError(null);
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
  }

  if (collectingContact && loggedIn && collectContact && !disabled) {
    return (
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="vip-checkout-email">Email</Label>
          <Input
            id="vip-checkout-email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={busy}
            className="h-10"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="vip-checkout-phone">Mobile number</Label>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-10 items-center rounded-lg border border-input px-2.5 text-sm text-muted-foreground">
              +91
            </span>
            <Input
              id="vip-checkout-phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              placeholder="9876543210"
              maxLength={10}
              value={phone}
              onChange={(event) =>
                setPhone(event.target.value.replace(/\D/g, "").slice(0, 10))
              }
              disabled={busy}
              className="h-10"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-11 flex-1"
            size="lg"
            disabled={busy}
            onClick={() => {
              setCollectingContact(false);
              setError(null);
            }}
          >
            Back
          </Button>
          <Button
            type="button"
            className="h-11 flex-[1.4]"
            size="lg"
            disabled={busy}
            onClick={() => void openCheckout()}
          >
            {busy ? "Opening checkout…" : "Continue to Payment"}
          </Button>
        </div>
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Button
        className="h-11 w-full"
        size="lg"
        disabled={disabled || busy}
        onClick={beginCheckout}
      >
        {busy ? "Opening checkout…" : label}
      </Button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
