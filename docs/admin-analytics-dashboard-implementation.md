# Admin Overview analytics implementation

## What changed

- The Overview range remains 1D / 7D / 30D, but each option now covers **complete IST calendar days**, ending at today's IST midnight. The previous comparison uses the same number of completed days.
- Overview player metrics classify players from `session_unique_players.firstSeenAt`, which is the durable first-ever index. Unknown first-seen records are shown as unclassified rather than assumed to be returning.
- D1 and D7 are exact calendar-day cohort returns, calculated from first-ever cohorts. Immature return days and return days outside the configured session-retention horizon are omitted (`—`), not reported as zero.
- Concurrency is reconstructed from session intervals, not `playersOnlineAtJoin`. A fresh open interval runs to request time; a stale open interval ends at its last heartbeat. An interval **over 12 hours** is excluded from concurrency and playtime totals and flagged rather than assigned invented duration.
- Concurrent SteamIDs are counted once across servers. When a player's session intervals overlap, the later join takes precedence and the older interval is truncated at that join. Capacity violations are clamped to configured server capacity and reported as data-quality anomalies.
- Server/fleet average concurrency, peak, 17:00–22:00 IST average, utilization bands, and weekday/hour heatmap use time-weighted interval overlap. A configured capacity or anomaly warning accompanies reconstructed metrics.
- Payments are read from `payments`; only confirmed `captured`/`refunded` rows with `paidAt` count as successful purchases. Created orders older than 30 minutes are shown as abandoned checkouts. Free VIP assignments are displayed separately. Fees and operating costs are explicitly unavailable because no verified fee/cost ledger exists.
- Recent connections remain individual session records (not merged visits). Filters apply to the latest 100 records returned; profile names link to profiles, and raw SteamIDs are no longer rendered in the table.
- **Visit grouping decision:** do not merge rows into visits yet. Current telemetry cannot distinguish map changes, reconnects, and intentional leave/rejoin reliably. Preserve session records; if a visit metric is later added, define it as same-player activity across reconnect gaps (with a documented threshold) and validate map/restart behavior against plugin event data first.

## Data limits and known risks

- `player_sessions` still uses the existing 30-day TTL by default. Older session documents have already expired and cannot be reconstructed from lifetime counters. The dashboard labels the retained horizon and does not treat excluded history as zero retention.
- `fleet_session_stats` is an incremental lifetime rollup with a different retention lifecycle. Its lifetime playtime is not used for the new period KPIs because it includes historical session-quality issues.
- Connection intervals are heartbeat-derived, not raw join/leave event logs or continuous presence snapshots. The 12-hour outlier threshold is a conservative data-quality policy, not a claim that all longer sessions were AFK. Excluded intervals are visible in the dashboard warning.
- The existing `playersOnlineAtJoin` snapshot remains available to the separate server-stats/session pages; this change corrects the Overview reporting path only.
- The app has no acquisition source on server joins and no verified operating-cost data. Existing players and historical spikes cannot be attributed retroactively.
- The Overview endpoint continues to use existing `ensureProfileIndexes` and lifetime-stat initialization behavior. This change adds no collection, index, or production-data migration. Review that pre-existing initialization behavior before any future read-only-only dashboard guarantee.

## Safe production retention change (not performed)

The deployed code defaults to `PLAYER_SESSION_RETENTION_DAYS=30`. A retention increase is not part of this implementation because it changes a production TTL index. To preserve future cohorts, prepare this separately:

1. Confirm the active Atlas database, collection, `joinedAt_ttl` index, and current `expireAfterSeconds`; take and verify a backup first.
2. Select and approve a retention target (for example, 180 days) and set `PLAYER_SESSION_RETENTION_DAYS` to the same value in production.
3. Prefer a reviewed MongoDB `collMod` TTL-index update for `player_sessions.joinedAt` over dropping/recreating the index. Confirm the resulting index value and verify that no documents were deleted by this operation. Deploy only after the app configuration and index agree.
4. Verify that the TTL index remains longer than the desired D30 reporting/cohort horizon and watch the collection/index status.

**Rollback:** roll back the application code if necessary, but keep the longer retention setting/index in place. Do not shorten the TTL as an automatic rollback: that would start deleting history again, and previously expired documents cannot be restored except from a verified backup. A TTL reduction requires separate approval and an explicit data-loss decision.

## Minimum attribution and cost instrumentation still required

- At a consent-aware website entry/signup boundary, capture allowlisted `utm_source`, `utm_medium`, `utm_campaign`, landing page, and timestamp. Persist first-touch only once and update latest-touch separately on the account associated with Steam; do not send SteamIDs or account details to GA4.
- Add an optional in-game self-report command (for example, `!from youtube|discord|friend|server-browser|brosena|other`) that submits a validated enum through the authenticated plugin API and stores a timestamped attribution event keyed server-side to the player. Report only aggregates in admin.
- Add a verified monthly expense ledger (service, currency/amount, effective dates, fixed/variable, invoice-verified status) behind owner-only access and an audit trail. Until this exists, break-even must remain unavailable rather than use guessed costs.

## Tests

`lib/profile/overview-analytics.test.ts` covers completed IST period boundaries, UTC/IST day transitions, time-weighted averages, cross-server duplicate players, reconnect/restart boundaries, stale open sessions, impossible capacity counts, long-session exclusion, unknown capacity, retained-history cutoffs, and exact-day retention assignment.

## Dedicated Analytics page follow-up

The permission-protected `/admin/analytics` page reuses the interval calculations and supports 1D/7D/30D/90D plus validated custom completed IST windows. It adds player-session duration buckets, daily active-player counts based on interval overlap, and exact D1/D7/D30 cohort returns when the return-day session data remains within the TTL. Historical comparisons are suppressed when the preceding session period is outside retention.

The page intentionally shows unavailable states for:

- **Historical uptime:** `serverStatus` is a short-lived current-status cache (about 120 seconds), not an uptime timeline.
- **Top-map playtime:** `player_sessions.map` is updated as the map changes and stores only the latest snapshot; it does not contain map-duration segments.
- **Acquisition source:** server joins have no attribution field or source event. The page does not reuse website visits as a proxy for game joins.
- **Payment fees and break-even:** payment rows do not include verified fees and there is no operating-cost ledger.

The map, uptime, attribution, and cost panels require separate durable instrumentation to become measurable. No such historical data is inferred or backfilled by the page.
