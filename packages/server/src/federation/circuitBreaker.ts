/**
 * Circuit breaker for federation delivery.
 * Tracks consecutive failures per remote instance domain.
 * After N consecutive failures, opens the circuit (stops delivery attempts)
 * for an exponentially increasing cooldown period.
 */
import { eq, sql } from 'drizzle-orm';
import { instanceHealth } from '@commonpub/schema';
import type { DB } from '../types.js';

/** Default: open circuit after 50 consecutive failures */
const DEFAULT_FAILURE_THRESHOLD = 50;

/** Cooldown periods: 5min, 15min, 1h, 6h, 24h */
const COOLDOWN_MS = [
  5 * 60_000,       // 5 minutes
  15 * 60_000,      // 15 minutes
  60 * 60_000,      // 1 hour
  6 * 60 * 60_000,  // 6 hours
  24 * 60 * 60_000, // 24 hours
];

/**
 * Check if the circuit is open for a domain (should skip delivery).
 * Returns true if delivery should be SKIPPED (circuit is open).
 */
export async function isCircuitOpen(db: DB, domain: string): Promise<boolean> {
  const [health] = await db
    .select({ circuitOpenUntil: instanceHealth.circuitOpenUntil })
    .from(instanceHealth)
    .where(eq(instanceHealth.domain, domain))
    .limit(1);

  if (!health?.circuitOpenUntil) return false;
  return health.circuitOpenUntil.getTime() > Date.now();
}

/**
 * Record a successful delivery to a domain.
 * Resets consecutive failures and closes the circuit.
 */
export async function recordDeliverySuccess(db: DB, domain: string): Promise<void> {
  await db
    .insert(instanceHealth)
    .values({
      domain,
      consecutiveFailures: 0,
      totalDelivered: 1,
      lastSuccessAt: new Date(),
      circuitOpenUntil: null,
    })
    .onConflictDoUpdate({
      target: instanceHealth.domain,
      set: {
        consecutiveFailures: 0,
        totalDelivered: sql`${instanceHealth.totalDelivered} + 1`,
        lastSuccessAt: new Date(),
        circuitOpenUntil: null,
        updatedAt: new Date(),
      },
    });
}

/**
 * Record a delivery failure to a domain.
 * Increments consecutive failures. If threshold exceeded, opens the circuit.
 */
export async function recordDeliveryFailure(
  db: DB,
  domain: string,
  failureThreshold = DEFAULT_FAILURE_THRESHOLD,
): Promise<void> {
  // Upsert: increment failures, update timestamp
  await db
    .insert(instanceHealth)
    .values({
      domain,
      consecutiveFailures: 1,
      totalFailed: 1,
      lastFailureAt: new Date(),
    })
    .onConflictDoUpdate({
      target: instanceHealth.domain,
      set: {
        consecutiveFailures: sql`${instanceHealth.consecutiveFailures} + 1`,
        totalFailed: sql`${instanceHealth.totalFailed} + 1`,
        lastFailureAt: new Date(),
        updatedAt: new Date(),
      },
    });

  // Check if we need to open the circuit
  const [health] = await db
    .select({
      consecutiveFailures: instanceHealth.consecutiveFailures,
    })
    .from(instanceHealth)
    .where(eq(instanceHealth.domain, domain))
    .limit(1);

  if (health && health.consecutiveFailures >= failureThreshold) {
    // Calculate cooldown: escalating based on how many times we've opened
    const openCount = Math.floor(health.consecutiveFailures / failureThreshold) - 1;
    const cooldownMs = COOLDOWN_MS[Math.min(openCount, COOLDOWN_MS.length - 1)]!;
    const openUntil = new Date(Date.now() + cooldownMs);

    await db
      .update(instanceHealth)
      .set({ circuitOpenUntil: openUntil, updatedAt: new Date() })
      .where(eq(instanceHealth.domain, domain));
  }
}

/**
 * Get delivery health stats for all known remote instances.
 */
export async function getDeliveryHealth(db: DB): Promise<Array<{
  domain: string;
  consecutiveFailures: number;
  totalDelivered: number;
  totalFailed: number;
  circuitOpen: boolean;
  circuitOpenUntil: Date | null;
  lastSuccessAt: Date | null;
  lastFailureAt: Date | null;
}>> {
  const rows = await db.select().from(instanceHealth).orderBy(instanceHealth.domain);
  return rows.map((r) => ({
    domain: r.domain,
    consecutiveFailures: r.consecutiveFailures,
    totalDelivered: r.totalDelivered,
    totalFailed: r.totalFailed,
    circuitOpen: r.circuitOpenUntil ? r.circuitOpenUntil.getTime() > Date.now() : false,
    circuitOpenUntil: r.circuitOpenUntil,
    lastSuccessAt: r.lastSuccessAt,
    lastFailureAt: r.lastFailureAt,
  }));
}
