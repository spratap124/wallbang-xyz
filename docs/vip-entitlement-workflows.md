# VIP entitlement workflow release gate

## Service boundaries

- `fulfillOnlineVipPurchase()` owns captured Razorpay/PayU fulfillment, payment-linked `vip_history` creation, and payment completion. It synchronizes the global VIP assignment through `synchronizeVipRole()` and does not use `grantRole()` or manual entitlement writers.
- `grantManualVip()` owns staff-authorized PURCHASE, complimentary, and giveaway entitlements. It validates explicit server or bundle keys and uses the same transaction fence and role synchronizer as online fulfillment.
- `synchronizeVipRole()` reads `vip_history` and reconciles the global VIP assignment. It writes role assignments and role audit records only; `vip_history` remains the entitlement source of truth.

## Grant revocation and rollback

VIP administration selects an individual `vip_history._id`. Revocation records an administrator-attributed `REVOKE_VIP_ACCESS` audit with that exact history ID in the same transaction as role reconciliation. History and payment rows remain intact; the effective-history reader applies the audit as a revocation in memory. Keep these audit records: deleting them can restore access. A server/bundle key is accepted only when it identifies exactly one historical grant. General role removal and revoke-all shortcuts reject VIP requests.

New manual lifetime grants are marked on the entitlement, and the role records when its lifetime status came from this workflow. Ambiguous historical lifetime ownership or unexplained extra role coverage blocks revocation for review. No historical records are backfilled.

Code predating grant-level audit overlays does not honor those revocation records. Rolling back after new revocations can restore access; review and reconcile the exact grant IDs before rollback rather than rewriting history automatically. Partial or unverifiable refund handling remains a separate release blocker.

## Concurrency release blocker

The concurrent-purchase expiry regression is a release blocker until the persistence tests pass against MongoDB transaction support. The minimum serialization mechanism is an atomic increment of the purchasing user's existing `users.vipEntitlementVersion` field inside a transaction before reading `vip_history`. Competing grants then contend on the same user document; MongoDB retries the losing transaction, which rereads committed entitlement history before stacking expiry. Online and manual grants must keep their history and role writes in that transaction.

This is not a new entitlement state collection and does not require a new index or a backfill. `vipEntitlementVersion` is an optional write-fence field, not authoritative entitlement state. Do not replace it with an uncoordinated read/modify/write or move entitlement or role writes outside the transaction.

The merge gate includes passing persistence coverage for simultaneous duplicate webhooks, interrupted fulfillment retry, two distinct concurrent purchases for one player, manual grants, and role synchronization. A green unit suite alone does not satisfy this gate.

## Database preflight before staging or production rollout

The configured development database was verified read-only as an Atlas replica set with logical sessions and successful snapshot transactions. Its inspected indexes included:

- unique `payments.razorpayOrderId`;
- unique partial `payments.razorpayPaymentId` for string values;
- unique `vip_history.paymentId`;
- unique partial `user_roles(userId, roleCode)` for active assignments.

This development check is not evidence about staging or production. Before rollout, run the read-only `scripts/diagnose-vip-workflows.ts` against the target environment and verify transaction topology, these actual indexes, duplicate active role assignments, active VIP assignments without entitlement history, captured payments without matching `vip_history`, and legacy entitlement anomalies. Active role-only VIP grants will no longer be auto-converted into a default server entitlement during a CS2 permission read. If any exist, review an explicit entitlement backfill plan before rollout; do not silently assign servers or clean history automatically. If transactions are unavailable, a required index is missing, or duplicate data prevents a required unique index, stop and prepare an explicit migration/data-remediation plan for review.

The diagnostic can scan payment, entitlement, role, and audit collections. Run it in a maintenance window appropriate to the target dataset and retain its output as the rollout preflight record. It does not modify database state.

## Staging validation

1. Confirm the staging replica-set/sharded topology supports transactions and capture the actual required indexes.
2. Run the read-only VIP workflow diagnostic; resolve findings before exercising grants.
3. Exercise Razorpay checkout through captured webhook fulfillment, then redeliver the webhook and verify one payment-linked entitlement and one active VIP assignment.
4. Interrupt a test fulfillment after capture and retry it; verify recovery without an `offline-purchase:` history row.
5. Submit two concurrent test purchases for one player and verify sequential expiry stacking in `vip_history` and the global role expiry.
6. Exercise admin PURCHASE for a bundle and independent servers, plus a complimentary/giveaway grant and authorized revocation. Verify amount snapshots, explicit entitlement coverage, and revenue classification.
7. Verify CS2 plugin server-scoped VIP responses and payment/invoice/revenue analytics against the staged records.

Do not deploy until the concurrency and recovery tests pass and the target-environment database preflight is complete.
