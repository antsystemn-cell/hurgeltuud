import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type FulfillmentStatus = Database["public"]["Enums"]["fulfillment_status"];
type PaymentStatus = Database["public"]["Enums"]["payment_status"];

export type StatusUpdateInput = {
  orderId: string;
  status: FulfillmentStatus;
  userId: string;
  paymentCollectedInCash?: boolean;
};

export type PaymentUpdateInput = {
  orderId: string;
  status: PaymentStatus;
  userId: string;
};

// ---- Double-submit guard (shared across the whole app) ----
// Drivers may tap a button twice; this drops the duplicate in-flight action
// for the same order+intent before it ever reaches the network.
const inFlight = new Set<string>();

// ---- Outbound sync (server-side; no secrets in the browser) ----
export function fireShopWebhook(orderId: string) {
  supabase.functions
    .invoke("webhook-sync", { body: { order_id: orderId, event_type: "status_changed" } })
    .catch((err) => console.error("Shop webhook invoke failed:", err));
}

function buildStatusUpdates(input: StatusUpdateInput): Record<string, unknown> {
  const updates: Record<string, unknown> = {
    fulfillment_status: input.status,
    updated_by_user_id: input.userId,
  };
  if (input.status === "phone_confirmed") updates.phone_confirmed_at = new Date().toISOString();
  if (input.status === "out_for_delivery") updates.out_for_delivery_at = new Date().toISOString();
  if (input.status === "delivered") updates.delivered_at = new Date().toISOString();
  if (input.status === "cancelled") updates.cancelled_at = new Date().toISOString();
  if (typeof input.paymentCollectedInCash === "boolean") {
    updates.payment_collected_in_cash = input.paymentCollectedInCash;
    if (input.paymentCollectedInCash && input.status === "delivered") {
      updates.payment_status = "paid";
    }
  }
  return updates;
}

export class DuplicateActionError extends Error {
  constructor(msg = "Duplicate action ignored") {
    super(msg);
    this.name = "DuplicateActionError";
  }
}

function isNetworkError(err: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  return msg.includes("failed to fetch") || msg.includes("network") || msg.includes("load failed");
}

export async function applyStatusUpdate(input: StatusUpdateInput): Promise<void> {
  const key = `status:${input.orderId}:${input.status}`;
  if (inFlight.has(key)) throw new DuplicateActionError();
  inFlight.add(key);
  try {
    const { error } = await supabase.from("orders").update(buildStatusUpdates(input)).eq("id", input.orderId);
    if (error) throw error;
    fireShopWebhook(input.orderId);
  } finally {
    inFlight.delete(key);
  }
}

export async function applyPaymentUpdate(input: PaymentUpdateInput): Promise<void> {
  const key = `payment:${input.orderId}:${input.status}`;
  if (inFlight.has(key)) throw new DuplicateActionError();
  inFlight.add(key);
  try {
    const { error } = await supabase
      .from("orders")
      .update({ payment_status: input.status, updated_by_user_id: input.userId })
      .eq("id", input.orderId);
    if (error) throw error;
    fireShopWebhook(input.orderId);
  } finally {
    inFlight.delete(key);
  }
}

// ---- Offline queue ----
const QUEUE_KEY = "swift_offline_queue_v1";

type QueuedItem =
  | ({ kind: "status"; queuedAt: number } & StatusUpdateInput)
  | ({ kind: "payment"; queuedAt: number } & PaymentUpdateInput);

function readQueue(): QueuedItem[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]") as QueuedItem[];
  } catch {
    return [];
  }
}

function writeQueue(items: QueuedItem[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
}

function dedupKey(item: QueuedItem): string {
  return item.kind === "status"
    ? `status:${item.orderId}:${item.status}`
    : `payment:${item.orderId}:${item.status}`;
}

function enqueue(item: QueuedItem) {
  const items = readQueue();
  const key = dedupKey(item);
  const next = items.filter((i) => dedupKey(i) !== key);
  next.push(item);
  writeQueue(next);
}

export function pendingOfflineCount(): number {
  return readQueue().length;
}

// Apply a status update, queueing it for later if the device is offline.
// Combined with the DB idempotency guard, a replayed update is always safe.
export async function applyStatusUpdateResilient(input: StatusUpdateInput): Promise<{ queued: boolean }> {
  try {
    await applyStatusUpdate(input);
    return { queued: false };
  } catch (err) {
    if (err instanceof DuplicateActionError) return { queued: false };
    if (isNetworkError(err)) {
      enqueue({ kind: "status", queuedAt: Date.now(), ...input });
      return { queued: true };
    }
    throw err;
  }
}

export async function applyPaymentUpdateResilient(input: PaymentUpdateInput): Promise<{ queued: boolean }> {
  try {
    await applyPaymentUpdate(input);
    return { queued: false };
  } catch (err) {
    if (err instanceof DuplicateActionError) return { queued: false };
    if (isNetworkError(err)) {
      enqueue({ kind: "payment", queuedAt: Date.now(), ...input });
      return { queued: true };
    }
    throw err;
  }
}

// Replay everything queued. Network failures stay queued; any other error
// (e.g. order already terminal) is treated as resolved and dropped.
export async function flushQueue(): Promise<number> {
  const items = readQueue();
  if (!items.length) return 0;
  const remaining: QueuedItem[] = [];
  let flushed = 0;
  for (const item of items) {
    try {
      if (item.kind === "status") {
        await applyStatusUpdate({
          orderId: item.orderId,
          status: item.status,
          userId: item.userId,
          paymentCollectedInCash: item.paymentCollectedInCash,
        });
      } else {
        await applyPaymentUpdate({ orderId: item.orderId, status: item.status, userId: item.userId });
      }
      flushed++;
    } catch (err) {
      if (isNetworkError(err)) {
        remaining.push(item); // still offline — keep for next time
      } else {
        flushed++; // resolved or rejected by server — drop it
      }
    }
  }
  writeQueue(remaining);
  return flushed;
}
