"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import type { ApiResult } from "@/lib/api/waitlist";
import { cn } from "@/lib/utils";

type PaymentOutcome = "success" | "pending" | "failure" | "invalid" | "timeout";

type PayuOrderStatus = {
  status: string;
  paymentId: string;
  fulfilled: boolean;
  invoiceNumber: string | null;
};

function parseOutcome(
  paid: string | null,
  error: string | null,
): PaymentOutcome | null {
  if (paid === "1") return "success";
  if (paid === "pending") return "pending";
  if (paid === "0" && error === "invalid") return "invalid";
  if (paid === "0") return "failure";
  return null;
}

const OUTCOME_COPY: Record<
  Exclude<PaymentOutcome, "pending" | "timeout">,
  { title: string; body: string; icon: typeof CheckCircle2; tone: string }
> = {
  success: {
    title: "Payment successful",
    body: "Your prepaid VIP membership is now active. Your payment invoice is ready below.",
    icon: CheckCircle2,
    tone: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  },
  failure: {
    title: "Payment not completed",
    body: "Your payment was cancelled or did not go through. No VIP was activated — you can try again on the Pricing page.",
    icon: XCircle,
    tone: "border-destructive/30 bg-destructive/10 text-destructive",
  },
  invalid: {
    title: "Payment could not be verified",
    body: "We could not confirm this payment. If you were charged, contact support with your payment reference.",
    icon: AlertTriangle,
    tone: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  },
};

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 90_000;

export function VipPaymentResultBanner() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const paid = searchParams.get("paid");
  const error = searchParams.get("error");
  const txnid = searchParams.get("txnid");
  const [outcome, setOutcome] = useState<PaymentOutcome | null>(() =>
    parseOutcome(paid, error),
  );
  const [invoicePaymentId, setInvoicePaymentId] = useState<string | null>(null);
  const [pendingTxnid, setPendingTxnid] = useState<string | null>(
    () => txnid,
  );
  const pollStarted = useRef(false);

  useEffect(() => {
    const initial = parseOutcome(paid, error);
    if (!initial) return;

    if (txnid) setPendingTxnid(txnid);
    setOutcome(initial);
    if (initial === "success") {
      router.refresh();
    }

    const next = new URLSearchParams(searchParams.toString());
    next.delete("paid");
    next.delete("error");
    next.delete("txnid");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [paid, error, txnid, pathname, router, searchParams]);

  useEffect(() => {
    if (outcome !== "pending" || !pendingTxnid || pollStarted.current) return;
    pollStarted.current = true;

    const startedAt = Date.now();
    const txn = pendingTxnid;

    const poll = async (): Promise<boolean> => {
      const response = await fetch(
        `/api/v1/payments/payu/order-status?txnid=${encodeURIComponent(txn)}`,
      );
      if (!response.ok) return false;

      const payload = (await response.json()) as ApiResult<PayuOrderStatus>;
      if (!payload.ok) return false;

      if (payload.data.status === "failed") {
        setOutcome("failure");
        return true;
      }

      if (payload.data.fulfilled && payload.data.status === "captured") {
        setInvoicePaymentId(payload.data.paymentId);
        setOutcome("success");
        router.refresh();
        requestAnimationFrame(() => {
          document.getElementById("vip-membership")?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        });
        return true;
      }

      return false;
    };

    const interval = window.setInterval(() => {
      void (async () => {
        const done = await poll();
        if (done) {
          window.clearInterval(interval);
          return;
        }
        if (Date.now() - startedAt >= POLL_TIMEOUT_MS) {
          window.clearInterval(interval);
          setOutcome("timeout");
        }
      })();
    }, POLL_INTERVAL_MS);

    void poll();

    return () => window.clearInterval(interval);
  }, [outcome, pendingTxnid, router]);

  if (!outcome) return null;

  if (outcome === "pending") {
    return (
      <div
        role="status"
        className="mb-8 flex gap-3 rounded-xl border border-border bg-card/70 p-5 sm:p-6"
      >
        <Loader2 className="mt-0.5 size-5 shrink-0 animate-spin text-muted-foreground" />
        <div>
          <p className="font-semibold text-foreground">Confirming payment</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Activating VIP on this Steam account. This usually takes a few
            seconds.
          </p>
        </div>
      </div>
    );
  }

  if (outcome === "timeout") {
    return (
      <div
        role="alert"
        className="mb-8 flex flex-col gap-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6"
      >
        <div className="flex gap-3">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-400" />
          <div>
            <p className="font-semibold text-foreground">Still activating VIP</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Your payment was accepted by PayU. VIP activation can take a little
              longer — refresh this page in a moment. If access does not appear,
              contact support with your transaction ID.
            </p>
            {pendingTxnid ? (
              <p className="mt-2 font-mono text-xs text-muted-foreground">
                {pendingTxnid}
              </p>
            ) : null}
          </div>
        </div>
        <Link
          href="/contact"
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "shrink-0 self-start",
          )}
        >
          Contact support
        </Link>
      </div>
    );
  }

  const copy = OUTCOME_COPY[outcome];
  const Icon = copy.icon;

  return (
    <div
      role="alert"
      className={cn(
        "mb-8 flex flex-col gap-4 rounded-xl border p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6",
        copy.tone,
      )}
    >
      <div className="flex gap-3">
        <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
        <div>
          <p className="font-semibold text-foreground">{copy.title}</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {copy.body}
          </p>
        </div>
      </div>
      {outcome === "success" && invoicePaymentId ? (
        <Link
          href={`/vip/invoice/${invoicePaymentId}`}
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "shrink-0 self-start",
          )}
        >
          View invoice
        </Link>
      ) : outcome === "failure" ? (
        <Link
          href="/pricing"
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "shrink-0 self-start",
          )}
        >
          Try again
        </Link>
      ) : outcome !== "success" ? (
        <Link
          href="/contact"
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "shrink-0 self-start",
          )}
        >
          Contact support
        </Link>
      ) : null}
    </div>
  );
}
