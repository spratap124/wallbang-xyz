"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";

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
    body: "Your prepaid hosted server access is now active.",
    icon: CheckCircle2,
    tone: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  },
  failure: {
    title: "Payment not completed",
    body: "Your payment was cancelled or did not go through. No VIP access was activated.",
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

export function VipPaymentResult() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const paid = searchParams.get("paid");
  const error = searchParams.get("error");
  const txnid = searchParams.get("txnid");
  const paymentIdParam = searchParams.get("paymentId");
  const [outcome, setOutcome] = useState<PaymentOutcome | null>(() =>
    parseOutcome(paid, error),
  );
  const [invoicePaymentId, setInvoicePaymentId] = useState<string | null>(
    paymentIdParam,
  );
  const [pendingTxnid, setPendingTxnid] = useState<string | null>(() => txnid);
  const pollStarted = useRef(false);

  useEffect(() => {
    const initial = parseOutcome(paid, error);
    setOutcome(initial);
    if (txnid) setPendingTxnid(txnid);
    if (paymentIdParam) setInvoicePaymentId(paymentIdParam);
    if (initial === "success") router.refresh();
  }, [paid, error, txnid, paymentIdParam, router]);

  useEffect(() => {
    if (outcome !== "pending" || !pendingTxnid || pollStarted.current) return;
    pollStarted.current = true;

    const startedAt = Date.now();
    const txn = pendingTxnid;
    let stopped = false;

    const poll = async (): Promise<boolean> => {
      const response = await fetch(
        `/api/v1/payments/order-status?orderId=${encodeURIComponent(txn)}`,
      );
      if (stopped) return true;
      if (!response.ok) return false;

      const payload = (await response.json()) as ApiResult<PayuOrderStatus>;
      if (stopped) return true;
      if (!payload.ok) return false;

      if (payload.data.status === "failed") {
        setOutcome("failure");
        router.replace("/vip/payment?paid=0", { scroll: false });
        return true;
      }

      if (payload.data.fulfilled && payload.data.status === "captured") {
        setInvoicePaymentId(payload.data.paymentId);
        setOutcome("success");
        router.replace(
          `/vip/payment?paid=1&paymentId=${encodeURIComponent(payload.data.paymentId)}`,
          { scroll: false },
        );
        router.refresh();
        return true;
      }

      return false;
    };

    const interval = window.setInterval(() => {
      void (async () => {
        if (stopped) return;
        const done = await poll();
        if (done || stopped) {
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

    return () => {
      stopped = true;
      window.clearInterval(interval);
      pollStarted.current = false;
    };
  }, [outcome, pendingTxnid, router]);

  if (!outcome) {
    return (
      <ResultShell
        title="No payment to confirm"
        body="Start checkout from Pricing. This page shows whether a payment succeeded or failed."
        tone="border-border bg-card/70 text-foreground"
        icon={AlertTriangle}
      >
        <Link href="/pricing" className={cn(buttonVariants({ size: "lg" }), "h-11")}>
          Go to Pricing
        </Link>
      </ResultShell>
    );
  }

  if (outcome === "pending") {
    return (
      <ResultShell
        title="Confirming payment"
        body="Activating hosted server access on this Steam account. This usually takes a few seconds."
        tone="border-border bg-card/70 text-muted-foreground"
        icon={Loader2}
        spin
        reference={pendingTxnid}
      />
    );
  }

  if (outcome === "timeout") {
    return (
      <ResultShell
        title="Still activating access"
        body="Your payment was submitted. Activation is confirmed by the payment webhook and can take a little longer. Refresh this page in a moment. If access does not appear, contact support with your payment reference."
        tone="border-amber-500/30 bg-amber-500/10 text-amber-400"
        icon={AlertTriangle}
        reference={pendingTxnid}
      >
        <Link
          href="/contact"
          className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-11")}
        >
          Contact support
        </Link>
      </ResultShell>
    );
  }

  const copy = OUTCOME_COPY[outcome];

  return (
    <ResultShell
      title={copy.title}
      body={copy.body}
      tone={copy.tone}
      icon={copy.icon}
      reference={outcome === "success" ? null : pendingTxnid}
    >
      {outcome === "success" ? (
        <>
          {invoicePaymentId ? (
            <Link
              href={`/vip/invoice/${invoicePaymentId}`}
              className={cn(buttonVariants({ size: "lg" }), "h-11")}
            >
              View invoice
            </Link>
          ) : null}
          <Link
            href="/vip"
            className={cn(
              buttonVariants({
                variant: invoicePaymentId ? "outline" : "default",
                size: "lg",
              }),
              "h-11",
            )}
          >
            Go to VIP
          </Link>
        </>
      ) : null}
      {outcome === "failure" ? (
        <Link href="/pricing" className={cn(buttonVariants({ size: "lg" }), "h-11")}>
          Try again
        </Link>
      ) : null}
      {outcome === "invalid" ? (
        <Link
          href="/contact"
          className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-11")}
        >
          Contact support
        </Link>
      ) : null}
    </ResultShell>
  );
}

function ResultShell({
  title,
  body,
  tone,
  icon: Icon,
  spin = false,
  reference,
  children,
}: {
  title: string;
  body: string;
  tone: string;
  icon: typeof CheckCircle2;
  spin?: boolean;
  reference?: string | null;
  children?: ReactNode;
}) {
  return (
    <div
      role="status"
      className={cn(
        "mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center rounded-2xl border px-6 py-12 text-center",
        tone,
      )}
    >
      <Icon
        className={cn("size-10", spin && "animate-spin")}
        aria-hidden
      />
      <h1 className="mt-5 text-2xl font-semibold tracking-tight text-foreground">
        {title}
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{body}</p>
      {reference ? (
        <p className="mt-4 font-mono text-xs text-muted-foreground">{reference}</p>
      ) : null}
      {children ? (
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {children}
        </div>
      ) : null}
    </div>
  );
}
