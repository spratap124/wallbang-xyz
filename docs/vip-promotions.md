# Scheduled VIP promotions

VIP promotions live in MongoDB collection `vip_promotions`. The collection and indexes are initialized lazily by `lib/payments/promotions.ts`; there is no data migration or scheduled worker. Offers are active only when `enabled` is true and `startsAt <= current UTC time < endsAt`.

Administrators manage offers at **Admin → Promotional Offers**. The form accepts India Standard Time (IST) wall times and sends explicit UTC timestamps to the API. Each target (an individual server or a bundle) stores its own four paise prices. The optional percentage control only suggests whole-rupee prices in the form; saved per-duration prices are authoritative.

The admin mutation endpoints use the existing `manage_servers` permission. A MongoDB-backed singleton mutation lease serializes writes while the API checks target existence, prices, and overlapping enabled schedules. Conflicting target schedules return HTTP 409. The lease expires after two minutes if a process dies; normal requests release it in `finally`.

Public catalog/quote responses and Razorpay order creation use the shared promotion resolver. Promotion prices are read on each request, so start/end changes need no cache invalidation. The existing 20-second server registry cache remains in place for server base-price data.

## Razorpay price locking

When a new Razorpay order is created, `payments` stores its charged amount, original amount, discount, offer ID/name/end time, and target. A matching `created` Razorpay order can be reused for 30 minutes only for the same user, access type, server/bundle, server membership snapshot, and duration. Reuse returns the stored amount and offer snapshot even if the offer has since ended or been disabled. New orders use the current resolver result. The pricing UI updates its summary and requires confirmation before opening checkout if that returned amount differs from the amount currently displayed.

The signed Razorpay webhook remains the sole fulfillment authority. Captured events without a valid integer amount are rejected, and fulfillment compares the captured amount to the immutable payment amount before VIP access is granted. `vip_history` receives the same price snapshot; historical payment rows are not rewritten.

VIP durations, entitlement membership, and extension rules are unchanged. PayU files and endpoints are unchanged and do not resolve promotions. Keep Razorpay as the active checkout provider while promotional pricing is enabled.
