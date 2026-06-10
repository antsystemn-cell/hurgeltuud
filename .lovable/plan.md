## Swift Delivery Hub — Production Hardening

Goal: make the existing system reliable and consistently synced **without** redesigning the workflow. The driver PWA, operator, and admin screens keep the exact same screens and actions. All changes are reliability/sync layers added underneath.

### Key decisions (please confirm)

1. **Status vocabulary** — The internal database enum stays exactly as today (`confirmed`, `phone_confirmed`, `out_for_delivery`, `delivered`, `cancelled`) so no existing flow breaks. The 8 canonical statuses (`new, confirmed, assigned, picked_up, in_transit, delivered, cancelled, failed`) become the **single shared API vocabulary** used for every Only Hub / external sync, via one central mapping. Today two functions map the same internal status differently (e.g. `confirmed` → `confirmed` in one place but `confirmed` → `assigned` in another) — that inconsistency gets removed. Canonical map:
   - `confirmed` → `confirmed`
   - `phone_confirmed` → `assigned`
   - `out_for_delivery` → `in_transit`
   - `delivered` → `delivered`
   - `cancelled` → `cancelled`
   - (`new`, `picked_up`, `failed` reserved/inbound-accepted)

2. **Payments** — Per the request, the Hub manages logistics only and Only Hub owns SMS/QPay/payment collection. The existing on-site driver "Төлбөр авсан" cash-confirmation button is **kept** (operationally needed) but is recorded only as a logistics flag (`payment_collected_in_cash`); on `delivered`, the Hub fires a completion notification and Only Hub remains the payment authority. Confirm you want the cash button kept rather than removed.

### 1. Database hardening (one migration)

- **Idempotent / monotonic status trigger** on `orders`: ignore an update that sets `fulfillment_status` to its current value (no duplicate processing of `delivered`/`cancelled`/picked-up), and block transitions *out of* terminal states (`delivered`, `cancelled`) so a double-click or stale offline replay can't reopen a finished order.
- **Assignment lock trigger**: once an order is `out_for_delivery`/`delivered`/`cancelled`, the assigned driver can't be silently overwritten; reassignment allowed only by operator/admin. Prevents the same order ending up with two drivers via a race.
- **Sync/retry columns**: reuse existing `sync_attempts`/`sync_error`/`last_sync_at`; add `last_api_error` + `retry_count` for the outbound API path and a manual-retry timestamp.
- **Webhook idempotency**: add a unique constraint on `webhook_logs.event_id` so a replayed webhook can't be processed twice.

### 2. Edge function reliability

- **Central status map** duplicated into each function (functions can't share src) — identical canonical mapping everywhere.
- **`webhook-sync`**: always set `last_sync_at`/`sync_error`/`retry_count`; persist a stable `event_id` per change in `webhook_logs`; on `delivered` for OMH orders fire the explicit completion notification to Only Hub (logistics-only payload — no payment handling).
- **`status-update-inbound`**: dedupe by `event_id` (short-circuit duplicates), accept the canonical vocabulary, ignore no-op updates, prevent loops by never re-emitting outbound on an inbound-applied change.
- **`webhook-retry`**: keep exponential backoff; expose it for an admin **manual retry** action; schedule it via `pg_cron` (every minute) so failed syncs auto-retry.

### 3. Driver app safety + offline queue

- **Double-submit guard**: track in-flight order IDs so `Хүргэсэн`/`Цуцлах`/payment buttons can't be fired twice for the same order; hide actions on already-terminal orders.
- **Offline queue**: when a status update fails due to no connection, queue it in local storage and auto-replay on reconnect (`online` event), then refresh. Combined with the DB idempotency trigger, replays are safe.

### 4. Performance

- Tighten driver/operator/admin queries (select only needed columns for list views, stable query keys, avoid refetch storms). No behavior change, fewer/cheaper queries.

### 5. Validation

- Test via edge-function curl + DB checks: duplicate `delivered` ignored, terminal transitions blocked, reassignment race blocked, duplicate webhook `event_id` rejected, inbound idempotency, offline replay applies once, Only Hub receives canonical statuses. Run the DB linter after the migration.

### Technical notes
- Triggers use `SECURITY DEFINER` + `SET search_path = public`; transition rules implemented in triggers (not CHECK constraints) since they depend on row state.
- No enum change → `src/integrations/supabase/types.ts` untouched for statuses; UI labels/colors unchanged.
- Manual retry button added to the admin order/sync view only (no new workflow).
