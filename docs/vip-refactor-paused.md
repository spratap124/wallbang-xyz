# VIP payment workflow refactor — paused checkpoint

This branch is a development checkpoint. It is **not production-ready**. Production continues using its existing payment workflow. Do not merge or deploy this branch without completing the review and validation below.

## Why the refactor started

Online payment fulfillment reused `grantRole()`, a manual VIP grant workflow with entitlement-history side effects. That coupling caused an online purchase to produce a phantom offline purchase for Karara. The objective was to separate payment fulfillment, manual grants and global VIP role synchronization while preserving existing customer access, revenue reporting and the CS2 plugin contract.

## Work in this checkpoint

- Online Razorpay/PayU fulfillment writes payment-linked entitlements and calls a dedicated history-free role synchronizer. The online path does not call `grantRole()` or manual/complimentary history writers.
- Manual purchases, complimentary grants and giveaways use explicit entitlement selections in `lib/payments/manual-vip-service.ts`. The VIP compatibility wrapper delegates to that service; non-VIP `grantRole()` retains its existing path.
- A per-user transaction write fence serializes online and manual entitlement mutations. `vip_history` remains the entitlement history; no entitlement state collection or backfill was added. New records can carry calculation/lifetime metadata.
- Read-only audit evidence overlays verified legacy complimentary revocations in memory. Ambiguous paid records are not inferred to be revoked. Historical and versioned expiry calculations have separate handling.
- The VIP admin view lists individual grants. Revocation selects one history ID and writes an attributed audit record rather than deleting history. Ambiguous key-only requests and generic VIP role removal are rejected. Remaining lifetime ambiguity is rejected for review.
- PayU amounts are parsed strictly and must match the persisted order; online retries, invoice number collision handling, and role/revenue compatibility received local test coverage. The read-only diagnostic is `scripts/diagnose-vip-workflows.ts`.

The grant revocation audit is part of effective access interpretation. **Do not delete these audit entries.** Older code does not honor them, so rolling back after new grant revocations can restore access. Review exact grant IDs and plan rollback handling before any future release.

## Historical compatibility findings

A read-only production inspection earlier in this work found 82 currently valid VIP roles, 20 entitlement groups with stored-versus-stable-main expiry differences across 15 users, and three groups with future differences. All eight captured/disputed payments observed had linked history and fulfillment timestamps. No current server-access difference was detected in that point-in-time comparison across three registered servers. These figures are historical observations, not a current production assessment.

For **Susss** (`76561198441514681`), an administrator granted lifetime VIP on 8 November 2026, revoked the role seconds later, then granted 30 days. The lifetime entitlement remained `ACTIVE` in history with a 36,500-day end in October 2126; the active finite role expired on 8 December 2026. Stable main's complimentary grouping selected the earlier end. The new effective-history reader uses specific grant/revocation audit links to exclude the revoked lifetime row in memory. Sanitized local fixtures exercise synchronization, server access and renewals. No historical production record was modified.

## Validation recorded before pause

- Focused entitlement, manual pricing, PayU and role/compatibility suites: **60 passed**.
- Persistence and role suite against a disposable localhost MongoDB replica set: **20 passed**. Coverage included duplicate delivery, concurrent purchases, a production-shaped legacy revocation, targeted same-bundle revocation, cross-player and ambiguous selections, lifetime handling, renewal, and concurrent purchase/revocation.
- Typecheck passed. Lint completed with 0 errors and 12 existing warnings.
- Plain `git diff --check` reports carriage returns on changed lines in three existing CRLF PayU files. `git -c core.whitespace=cr-at-eol diff --check` passes; the files were not normalized at this checkpoint.

These results apply to the local checkpoint, not to production. The tests are not a substitute for a fresh review or the missing cases below.

## Open issues and release blockers

1. **Razorpay partial refunds:** the webhook currently passes a payment ID to full-refund processing without verifying the refund amount. Partial or unverifiable refunds can revoke full access. The approved policy is manual review for partial/unverifiable refunds and automatic revocation only for a verified full refund. Trusted provider verification, durable idempotent review tracking and tests remain unimplemented. Do not release until resolved.
2. **Admin grant-level revocation:** the new implementation needs independent review and broader API/UI integration tests. Historical role-only/lifetime grants without sufficient linkage or with unexplained extra role coverage are deliberately rejected for manual review. Confirm staff can resolve those cases without affecting unrelated paid access. Test authorization at the HTTP boundary, repeated requests, concurrent purchase/revocation in both orders, multiple same-bundle grants, legacy lifetime and rollback.
3. **Historical compatibility:** verify exact handling of ambiguous audit links, historical complimentary/giveaway and paid mixtures, overlapping bundle/server access, and the remaining expiry discrepancies. Do not infer paid revocation from a global role audit. Legacy role-only VIPs can lose server-scoped access because the old read-time fallback is no longer created; review target data and agree on handling before release.
4. **Payment recovery and side effects:** add failure-injection coverage before/after history persistence and role synchronization, webhook versus verification races, purchase tracking and receipt/invoice delivery idempotency, and full/partial refunds with other active entitlements. Confirm payment contracts, analytics and CS2 plugin behavior end to end.
5. **Target database preflight:** independently verify transaction support, required actual indexes, duplicate roles, linked payment/history integrity and historical anomalies in the intended target using approved read-only access. No automatic index creation, repair, historical cleanup or backfill is authorized by this checkpoint.

## Resume later

1. Fetch the checkpoint branch and annotated tag, then create an isolated working copy from `vip-flow-refactor-paused-2026-11-11`. Confirm its commit and read this document and `docs/vip-entitlement-workflows.md`.
2. Review the full diff against the appropriate current `origin/main`. Reconcile any intervening changes without force-pushing or overwriting unrelated work. Decide explicitly whether to continue the refactor.
3. Resolve the partial-refund policy and review storage contract before implementation. Review the grant-level changes and legacy ambiguity handling before enabling them.
4. Run focused tests and the persistence suite against a disposable **local** replica-set database named `wallbang_vip_test_*`. The suite is guarded by `WALLBANG_VIP_PERSISTENCE_TESTS=1`; never point its destructive setup at development or production data. Run `npm run typecheck`, `npm run lint`, and both plain and CRLF-aware `git diff --check`.
5. Complete the missing integration and failure-injection cases above. Perform target-environment preflight only with explicit approval and read-only credentials. Investigate findings individually; do not repair or migrate them automatically.
6. Obtain PR review and a green CI run before considering merge. Production deployment, if later approved, follows the existing post-merge CI/CD pipeline. Prepare monitoring and a rollback plan that accounts for revocation audit overlays.

No deployment, merge, production write, historical cleanup or production migration is part of this checkpoint.
