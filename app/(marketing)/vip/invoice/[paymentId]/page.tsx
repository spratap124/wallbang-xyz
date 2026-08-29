import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Container } from "@/components/shared/primitives";
import { buttonVariants } from "@/components/ui/button";
import { PrintInvoiceButton } from "@/components/vip/print-invoice-button";
import { getSession } from "@/lib/auth/session";
import { isMongoConfigured } from "@/lib/mongo";
import { paymentsCollection } from "@/lib/payments/collections";
import {
  buildPaymentInvoiceView,
  ensurePayuPaymentInvoice,
} from "@/lib/payments/payu-invoice";
import { IST_TIME_ZONE } from "@/lib/time/ist";
import { cn } from "@/lib/utils";
import { createPageMetadata } from "@/seo/metadata";

export const metadata = createPageMetadata({
  title: "Payment Invoice",
  description: "WallBang VIP payment invoice.",
  path: "/vip/invoice",
  noIndex: true,
});

type InvoicePageProps = {
  params: Promise<{ paymentId: string }>;
};

function formatInvoiceDate(date: Date): string {
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: IST_TIME_ZONE,
  });
}

export default async function VipInvoicePage({ params }: InvoicePageProps) {
  const session = await getSession();
  if (!session) {
    redirect("/api/auth/steam?returnTo=/vip");
  }
  if (!isMongoConfigured()) notFound();

  const { paymentId } = await params;
  const payments = await paymentsCollection();
  let payment = await payments.findOne({
    _id: paymentId,
    userId: session.id,
    status: "captured",
  });

  if (!payment) notFound();

  if (payment.provider === "payu" && !payment.invoiceNumber) {
    await ensurePayuPaymentInvoice(payment._id);
    payment = await payments.findOne({ _id: paymentId, userId: session.id });
    if (!payment) notFound();
  }

  const invoice = buildPaymentInvoiceView(payment);
  if (!invoice) notFound();

  return (
    <div className="py-10 sm:py-14 print:py-0">
      <Container className="max-w-3xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Link href="/vip" className={cn(buttonVariants({ variant: "outline" }))}>
            Back to VIP
          </Link>
          <PrintInvoiceButton />
        </div>

        <article className="rounded-xl border border-border bg-card/70 p-6 sm:p-8 print:border-0 print:bg-white print:p-0 print:text-black">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-6">
            <div>
              <p className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase print:text-gray-600">
                Tax Invoice
              </p>
              <h1 className="mt-2 text-2xl font-bold">WallBang</h1>
              <p className="mt-1 text-sm text-muted-foreground print:text-gray-600">
                Online Gaming / Digital Gaming Services
              </p>
              <p className="mt-1 text-sm text-muted-foreground print:text-gray-600">
                wallbang.xyz · admin@wallbang.xyz
              </p>
            </div>
            <div className="text-sm">
              <p>
                <span className="text-muted-foreground print:text-gray-600">
                  Invoice No.
                </span>{" "}
                <span className="font-medium">{invoice.invoiceNumber}</span>
              </p>
              <p className="mt-1">
                <span className="text-muted-foreground print:text-gray-600">
                  Date
                </span>{" "}
                <span className="font-medium">
                  {formatInvoiceDate(invoice.invoiceDate)}
                </span>
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium tracking-[0.15em] text-muted-foreground uppercase print:text-gray-600">
                Billed to
              </p>
              <p className="mt-2 text-sm font-medium">{session.personaName}</p>
              {invoice.customerEmail ? (
                <p className="mt-1 text-sm text-muted-foreground print:text-gray-600">
                  {invoice.customerEmail}
                </p>
              ) : null}
              <p className="mt-1 text-sm text-muted-foreground print:text-gray-600">
                Steam ID: {invoice.steamId}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium tracking-[0.15em] text-muted-foreground uppercase print:text-gray-600">
                Payment reference
              </p>
              <p className="mt-2 text-sm">
                PayU Txn: <span className="font-mono">{invoice.payuTxnId}</span>
              </p>
              {invoice.payuPaymentId ? (
                <p className="mt-1 text-sm">
                  PayU Payment ID:{" "}
                  <span className="font-mono">{invoice.payuPaymentId}</span>
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-8 overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-secondary/60 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Description</th>
                  <th className="px-4 py-3 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-border">
                  <td className="px-4 py-4">
                    <p className="font-medium">{invoice.productDescription}</p>
                    <p className="mt-1 text-xs text-muted-foreground print:text-gray-600">
                      Digital delivery — prepaid VIP membership for WallBang CS2
                      community servers. No physical goods shipped.
                    </p>
                  </td>
                  <td className="px-4 py-4 text-right font-medium">
                    {invoice.amountFormatted}
                  </td>
                </tr>
              </tbody>
              <tfoot className="border-t border-border bg-secondary/40">
                <tr>
                  <td className="px-4 py-3 font-semibold">Total paid</td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {invoice.amountFormatted}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <p className="mt-6 text-xs leading-relaxed text-muted-foreground print:text-gray-600">
            This is a computer-generated invoice for your prepaid digital VIP
            purchase on WallBang. For billing support, contact{" "}
            <a href="mailto:admin@wallbang.xyz" className="text-primary">
              admin@wallbang.xyz
            </a>
            .
          </p>
        </article>
      </Container>
    </div>
  );
}
