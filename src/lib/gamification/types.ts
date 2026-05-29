/**
 * Shared types for the StrikeLab gamification engine.
 * Frozen in Phase 0 — extend in Phase 1 when boosts/tiers go live.
 */

// ─── Event types ─────────────────────────────────────────────────────

/** All known event types. Phase 0 only emits checkin_observed and membership events. */
export type EventType =
  | "checkin_observed"
  | "subscription_renewed"
  | "subscription_cancelled"
  | "dunning_detected"
  | "consent_changed"
  | "manual_points_adjust"
  | "monthly_reset"
  | "erasure_executed"
  | "identity_created"
  | "ig_verified";

/** Source of the event — who/what triggered it. */
export type EventSource = "system" | "bot" | "admin" | "cron";

// ─── State ───────────────────────────────────────────────────────────

export type Tier = "bronze" | "silver" | "gold" | "platinum" | "diamond";

/** Shape returned by materializeState(). */
export interface GamificationStateView {
  customerId: number;
  monthlyPoints: number;
  lifetimeXp: number;
  currentTier: Tier;
  currentStreakDays: number;
  streakShieldAvailable: boolean;
  lastClassAt: Date | null;
  lastReplayedEventId: number | null;
}

// ─── Identity ────────────────────────────────────────────────────────

export interface IdentityInput {
  customerId: number;
  phoneE164: string;
  email?: string | null;
  whatsappWaId?: string | null;
}

// ─── Event log ───────────────────────────────────────────────────────

export interface AppendEventInput {
  customerId: number;
  eventType: EventType;
  pointsDelta?: number;
  xpDelta?: number;
  payloadJson?: Record<string, unknown> | null;
  source?: EventSource;
  operatorId?: number | null;
  idempotencyKey: string;
  pointsPeriod?: string | null; // "YYYY-MM" computed by caller
}

export interface AppendEventResult {
  written: boolean;
  eventId?: number;
}
