export function generateInvoiceNumber(
  paidAt: Date,
  paymentId: string,
  suffixLength = 8,
): string {
  const ymd = paidAt.toISOString().slice(0, 10).replaceAll("-", "");
  const suffix = paymentId
    .replaceAll("-", "")
    .slice(0, Math.max(8, suffixLength))
    .toUpperCase();
  return `WB-${ymd}-${suffix}`;
}
