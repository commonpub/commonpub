/**
 * Integration tests for the federation circuit breaker.
 *
 * Tests:
 * - isCircuitOpen: closed by default, open when circuitOpenUntil in future
 * - recordDeliverySuccess: resets failures, closes circuit, increments delivered count
 * - recordDeliveryFailure: increments failures, opens circuit at threshold
 * - Escalating cooldown: 5m → 15m → 1h → 6h → 24h
 * - getDeliveryHealth: aggregated stats
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { instanceHealth } from '@commonpub/schema';
import type { DB } from '../types.js';
import { createTestDB, closeTestDB } from './helpers/testdb.js';
import {
  isCircuitOpen,
  recordDeliverySuccess,
  recordDeliveryFailure,
  getDeliveryHealth,
} from '../federation/circuitBreaker.js';

describe('circuit breaker', () => {
  let db: DB;

  beforeAll(async () => {
    db = await createTestDB();
  });

  afterAll(async () => {
    await closeTestDB(db);
  });

  // --- isCircuitOpen ---

  describe('isCircuitOpen', () => {
    it('returns false for unknown domain (no health record)', async () => {
      const open = await isCircuitOpen(db, 'unknown.example.com');
      expect(open).toBe(false);
    });

    it('returns false when circuitOpenUntil is null', async () => {
      await db.insert(instanceHealth).values({
        domain: 'healthy.example.com',
        consecutiveFailures: 0,
        circuitOpenUntil: null,
      });

      const open = await isCircuitOpen(db, 'healthy.example.com');
      expect(open).toBe(false);
    });

    it('returns false when circuitOpenUntil is in the past', async () => {
      await db.insert(instanceHealth).values({
        domain: 'recovered.example.com',
        consecutiveFailures: 50,
        circuitOpenUntil: new Date(Date.now() - 60_000), // 1 minute ago
      });

      const open = await isCircuitOpen(db, 'recovered.example.com');
      expect(open).toBe(false);
    });

    it('returns true when circuitOpenUntil is in the future', async () => {
      await db.insert(instanceHealth).values({
        domain: 'failing.example.com',
        consecutiveFailures: 50,
        circuitOpenUntil: new Date(Date.now() + 300_000), // 5 minutes from now
      });

      const open = await isCircuitOpen(db, 'failing.example.com');
      expect(open).toBe(true);
    });
  });

  // --- recordDeliverySuccess ---

  describe('recordDeliverySuccess', () => {
    it('creates health record for new domain', async () => {
      await recordDeliverySuccess(db, 'new-instance.io');

      const [row] = await db
        .select()
        .from(instanceHealth)
        .where(eq(instanceHealth.domain, 'new-instance.io'));
      expect(row).toBeDefined();
      expect(row!.consecutiveFailures).toBe(0);
      expect(row!.totalDelivered).toBe(1);
      expect(row!.lastSuccessAt).toBeDefined();
    });

    it('increments totalDelivered on subsequent success', async () => {
      await recordDeliverySuccess(db, 'new-instance.io');

      const [row] = await db
        .select()
        .from(instanceHealth)
        .where(eq(instanceHealth.domain, 'new-instance.io'));
      expect(row!.totalDelivered).toBe(2);
    });

    it('resets consecutiveFailures and closes circuit', async () => {
      // Simulate a domain that had failures and open circuit
      await db.insert(instanceHealth).values({
        domain: 'was-failing.io',
        consecutiveFailures: 75,
        totalFailed: 75,
        circuitOpenUntil: new Date(Date.now() + 600_000),
      });

      // Success resets everything
      await recordDeliverySuccess(db, 'was-failing.io');

      const [row] = await db
        .select()
        .from(instanceHealth)
        .where(eq(instanceHealth.domain, 'was-failing.io'));
      expect(row!.consecutiveFailures).toBe(0);
      expect(row!.circuitOpenUntil).toBeNull();
      expect(row!.totalDelivered).toBe(1);
    });
  });

  // --- recordDeliveryFailure ---

  describe('recordDeliveryFailure', () => {
    it('creates health record with 1 failure for new domain', async () => {
      await recordDeliveryFailure(db, 'flaky.io');

      const [row] = await db
        .select()
        .from(instanceHealth)
        .where(eq(instanceHealth.domain, 'flaky.io'));
      expect(row).toBeDefined();
      expect(row!.consecutiveFailures).toBe(1);
      expect(row!.totalFailed).toBe(1);
      expect(row!.lastFailureAt).toBeDefined();
      // Should NOT open circuit yet (threshold = 50)
      expect(row!.circuitOpenUntil).toBeNull();
    });

    it('increments failures without opening circuit below threshold', async () => {
      // Add 8 more failures (total 9)
      for (let i = 0; i < 8; i++) {
        await recordDeliveryFailure(db, 'flaky.io');
      }

      const [row] = await db
        .select()
        .from(instanceHealth)
        .where(eq(instanceHealth.domain, 'flaky.io'));
      expect(row!.consecutiveFailures).toBe(9);
      expect(row!.circuitOpenUntil).toBeNull();
    });

    it('opens circuit at custom threshold', async () => {
      // Use low threshold of 10 (we have 9 failures already)
      await recordDeliveryFailure(db, 'flaky.io', 10);

      const [row] = await db
        .select()
        .from(instanceHealth)
        .where(eq(instanceHealth.domain, 'flaky.io'));
      expect(row!.consecutiveFailures).toBe(10);
      // Circuit should be open
      expect(row!.circuitOpenUntil).not.toBeNull();
      expect(row!.circuitOpenUntil!.getTime()).toBeGreaterThan(Date.now());
    });

    it('opens circuit at default threshold (50)', async () => {
      await db.insert(instanceHealth).values({
        domain: 'dead.io',
        consecutiveFailures: 49,
        totalFailed: 49,
      });

      // This is the 50th failure — should trigger circuit open
      await recordDeliveryFailure(db, 'dead.io');

      const [row] = await db
        .select()
        .from(instanceHealth)
        .where(eq(instanceHealth.domain, 'dead.io'));
      expect(row!.consecutiveFailures).toBe(50);
      expect(row!.circuitOpenUntil).not.toBeNull();
    });

    it('escalates cooldown on repeated threshold crossings', async () => {
      // At 50 failures: first cooldown (5 min)
      // At 100 failures: second cooldown (15 min)
      // At 150 failures: third cooldown (1 hour)
      const domain = 'very-dead.io';
      await db.insert(instanceHealth).values({
        domain,
        consecutiveFailures: 99,
        totalFailed: 99,
      });

      // 100th failure — should be second cooldown (15 minutes)
      await recordDeliveryFailure(db, domain);

      const [row] = await db
        .select()
        .from(instanceHealth)
        .where(eq(instanceHealth.domain, domain));
      expect(row!.consecutiveFailures).toBe(100);
      // openCount = floor(100/50) - 1 = 1 → COOLDOWN_MS[1] = 15 min
      const expectedMinCooldown = Date.now() + 14 * 60_000; // ~14min (accounting for test execution)
      const expectedMaxCooldown = Date.now() + 16 * 60_000; // ~16min
      expect(row!.circuitOpenUntil!.getTime()).toBeGreaterThan(expectedMinCooldown);
      expect(row!.circuitOpenUntil!.getTime()).toBeLessThan(expectedMaxCooldown);
    });
  });

  // --- getDeliveryHealth ---

  describe('getDeliveryHealth', () => {
    it('returns all known instances with health stats', async () => {
      const health = await getDeliveryHealth(db);
      expect(health.length).toBeGreaterThan(0);

      // Find a known domain
      const flaky = health.find(h => h.domain === 'flaky.io');
      expect(flaky).toBeDefined();
      expect(flaky!.consecutiveFailures).toBeGreaterThan(0);
      expect(flaky!.totalFailed).toBeGreaterThan(0);
    });

    it('correctly computes circuitOpen boolean', async () => {
      const health = await getDeliveryHealth(db);

      const failing = health.find(h => h.domain === 'failing.example.com');
      expect(failing).toBeDefined();
      expect(failing!.circuitOpen).toBe(true); // circuitOpenUntil is in future

      const recovered = health.find(h => h.domain === 'recovered.example.com');
      expect(recovered).toBeDefined();
      expect(recovered!.circuitOpen).toBe(false); // circuitOpenUntil is in past
    });
  });
});
