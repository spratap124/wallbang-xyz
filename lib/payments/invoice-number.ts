export function generateInvoiceNumber(
  paidAt: Date,
  paymentId: string,
): string {
  const ymd = paidAt.toISOString().slice(0, 10).replaceAll("-", "");
  const suffix = paymentId.replaceAll("-", "").slice(0, 8).toUpperCase();
  return `WB-${ymd}-${suffix}`;
}
