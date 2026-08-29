import { createHash, timingSafeEqual } from "node:crypto";

export function sha512Hex(input: string): string {
  return createHash("sha512").update(input).digest("hex");
}

export function hashesMatch(expectedHex: string, actual: string): boolean {
  const expected = Buffer.from(expectedHex);
  const received = Buffer.from(actual);
  if (expected.length !== received.length) return false;
  return timingSafeEqual(expected, received);
}

/** Request hash: key|txnid|amount|productinfo|firstname|email|udf1..udf5||||||SALT */
export function buildPayuRequestHashSequence(input: {
  key: string;
  salt: string;
  txnid: string;
  amount: string;
  productinfo: string;
  firstname: string;
  email: string;
  udf1?: string;
  udf2?: string;
  udf3?: string;
  udf4?: string;
  udf5?: string;
}): string {
  const udf1 = input.udf1 ?? "";
  const udf2 = input.udf2 ?? "";
  const udf3 = input.udf3 ?? "";
  const udf4 = input.udf4 ?? "";
  const udf5 = input.udf5 ?? "";

  return [
    input.key,
    input.txnid,
    input.amount,
    input.productinfo,
    input.firstname,
    input.email,
    udf1,
    udf2,
    udf3,
    udf4,
    udf5,
    "",
    "",
    "",
    "",
    "",
    input.salt,
  ].join("|");
}

/** Reverse hash: SALT|status||||||udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key */
export function buildPayuResponseHashSequence(input: {
  key: string;
  salt: string;
  txnid: string;
  amount: string;
  productinfo: string;
  firstname: string;
  email: string;
  status: string;
  udf1?: string;
  udf2?: string;
  udf3?: string;
  udf4?: string;
  udf5?: string;
  additionalCharges?: string;
}): string {
  const udf1 = input.udf1 ?? "";
  const udf2 = input.udf2 ?? "";
  const udf3 = input.udf3 ?? "";
  const udf4 = input.udf4 ?? "";
  const udf5 = input.udf5 ?? "";

  if (input.additionalCharges) {
    return [
      input.additionalCharges,
      input.salt,
      input.status,
      "",
      "",
      "",
      "",
      "",
      udf5,
      udf4,
      udf3,
      udf2,
      udf1,
      input.email,
      input.firstname,
      input.productinfo,
      input.amount,
      input.txnid,
      input.key,
    ].join("|");
  }

  return [
    input.salt,
    input.status,
    "",
    "",
    "",
    "",
    "",
    udf5,
    udf4,
    udf3,
    udf2,
    udf1,
    input.email,
    input.firstname,
    input.productinfo,
    input.amount,
    input.txnid,
    input.key,
  ].join("|");
}

export function hashPayuRequest(input: Parameters<typeof buildPayuRequestHashSequence>[0]): string {
  return sha512Hex(buildPayuRequestHashSequence(input));
}

export function hashPayuResponse(input: Parameters<typeof buildPayuResponseHashSequence>[0]): string {
  return sha512Hex(buildPayuResponseHashSequence(input));
}

export function verifyPayuResponseHashValue(
  params: Parameters<typeof buildPayuResponseHashSequence>[0] & { hash: string },
): boolean {
  const expected = hashPayuResponse(params);
  return hashesMatch(expected, params.hash);
}
