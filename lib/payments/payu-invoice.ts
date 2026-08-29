import "server-only";

import { paymentsCollection } from "@/lib/payments/collections";
import { formatInrFromPaise } from "@/lib/payments/format";
import { generateInvoiceNumber } from "@/lib/payments/invoice-number";
import { syncPayuInvoiceNumber } from "@/lib/payments/payu-postservice";
import { getVipDurationMeta } from "@/lib/payments/vip-pricing";
import type { PaymentDoc } from "@/types/payments";

export type PaymentInvoiceView = {
  invoiceNumber: string;
  invoiceDate: Date;
  paymentId: string;
  customerEmail: string | null;
  steamId: string;
  productDescription: string;
  planLabel: string;
  amountPaise: number;
  amountFormatted: string;
  currency: "INR";
  payuTxnId: string;
  payuPaymentId: string | null;
  paidAt: Date;
};

export function buildPaymentInvoiceView(payment: PaymentDoc): PaymentInvoiceView | null {
  if (!payment.invoiceNumber || !payment.paidAt) return null;

  const planMeta = getVipDurationMeta(payment.plan);
  const planLabel = planMeta?.name ?? payment.plan;
  const accessLabel =
    payment.accessType === "ALL_RETAKES"
      ? "All Retake Servers"
      : payment.serverId ?? payment.bundleId;

  return {
    invoiceNumber: payment.invoiceNumber,
    invoiceDate: payment.invoiceGeneratedAt ?? payment.paidAt,
    paymentId: payment._id,
    customerEmail: payment.email ?? null,
    steamId: payment.steamId,
    productDescription: `Prepaid VIP membership — ${planLabel} (${accessLabel})`,
    planLabel,
    amountPaise: payment.amount,
    amountFormatted: formatInrFromPaise(payment.amount),
    currency: "INR",
    payuTxnId: payment.razorpayOrderId,
    payuPaymentId: payment.razorpayPaymentId,
    paidAt: payment.paidAt,
  };
}

export async function ensurePayuPaymentInvoice(
  paymentId: string,
): Promise<string | null> {
  const payments = await paymentsCollection();
  const payment = await payments.findOne({ _id: paymentId });
  if (!payment || payment.provider !== "payu" || payment.status !== "captured") {
    return null;
  }

  if (payment.invoiceNumber) {
    return payment.invoiceNumber;
  }

  const paidAt = payment.paidAt ?? new Date();
  const invoiceNumber = generateInvoiceNumber(paidAt, payment._id);
  const now = new Date();

  const updated = await payments.findOneAndUpdate(
    {
      _id: payment._id,
      $or: [{ invoiceNumber: { $exists: false } }, { invoiceNumber: null }],
    },
    {
      $set: {
        invoiceNumber,
        invoiceGeneratedAt: now,
        updatedAt: now,
      },
    },
    { returnDocument: "after" },
  );

  const saved = updated ?? (await payments.findOne({ _id: payment._id }));
  const finalInvoiceNumber = saved?.invoiceNumber ?? invoiceNumber;
  if (!finalInvoiceNumber) return null;

  if (!saved?.payuInvoiceSyncedAt) {
    const synced = await syncPayuInvoiceNumber({
      txnid: payment.razorpayOrderId,
      invoiceNumber: finalInvoiceNumber,
    });

    if (synced) {
      await payments.updateOne(
        { _id: payment._id },
        { $set: { payuInvoiceSyncedAt: now, updatedAt: now } },
      );
    }
  }

  return finalInvoiceNumber;
}
