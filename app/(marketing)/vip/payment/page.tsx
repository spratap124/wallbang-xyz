import { redirect } from "next/navigation";
import { Suspense } from "react";

import { Container } from "@/components/shared/primitives";
import { VipPaymentResult } from "@/components/vip/vip-payment-result";
import { getSession } from "@/lib/auth/session";
import { createPageMetadata } from "@/seo/metadata";

export const metadata = createPageMetadata({
  title: "Payment",
  description: "WallBang hosted server access payment result.",
  path: "/vip/payment",
  noIndex: true,
});

type PaymentPageProps = {
  searchParams: Promise<{
    paid?: string;
    error?: string;
    txnid?: string;
    paymentId?: string;
  }>;
};

function paymentQuery(params: {
  paid?: string;
  error?: string;
  txnid?: string;
  paymentId?: string;
}): string {
  const qs = new URLSearchParams();
  if (params.paid) qs.set("paid", params.paid);
  if (params.error) qs.set("error", params.error);
  if (params.txnid) qs.set("txnid", params.txnid);
  if (params.paymentId) qs.set("paymentId", params.paymentId);
  const value = qs.toString();
  return value ? `?${value}` : "";
}

export default async function VipPaymentPage({ searchParams }: PaymentPageProps) {
  const params = await searchParams;
  const session = await getSession();

  if (!session && params.paid === "pending" && params.txnid) {
    const returnTo = `/vip/payment${paymentQuery(params)}`;
    redirect(`/api/auth/steam?returnTo=${encodeURIComponent(returnTo)}`);
  }

  return (
    <Container className="py-10 sm:py-16">
      <Suspense fallback={null}>
        <VipPaymentResult />
      </Suspense>
    </Container>
  );
}
