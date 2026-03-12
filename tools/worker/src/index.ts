// @commonpub/worker — Activity delivery monitoring and queue utilities
//
// Fedify handles actual activity delivery via its built-in message queue.
// This package provides monitoring, retry management, and admin utilities.

export interface ActivityDeliveryStatus {
  id: string;
  type: string;
  actorUri: string;
  targetInbox: string;
  status: 'pending' | 'delivered' | 'failed';
  attempts: number;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DeliveryStats {
  pending: number;
  delivered: number;
  failed: number;
  totalAttempts: number;
}

export interface ActivityLogEntry {
  id: string;
  type: string;
  actorUri: string;
  objectUri?: string;
  direction: 'inbound' | 'outbound';
  status: string;
  createdAt: Date;
}

export interface ActivityLogFilters {
  direction?: 'inbound' | 'outbound';
  status?: string;
  type?: string;
  limit?: number;
  offset?: number;
}

/** Calculate delivery stats from a list of activities */
export function calculateDeliveryStats(
  activities: Pick<ActivityDeliveryStatus, 'status' | 'attempts'>[],
): DeliveryStats {
  return activities.reduce(
    (stats, activity) => {
      stats[activity.status]++;
      stats.totalAttempts += activity.attempts;
      return stats;
    },
    { pending: 0, delivered: 0, failed: 0, totalAttempts: 0 },
  );
}

/** Determine if an activity should be retried based on attempts and status */
export function shouldRetry(status: string, attempts: number, maxAttempts: number = 3): boolean {
  return status === 'failed' && attempts < maxAttempts;
}

/** Calculate next retry delay using exponential backoff (in ms) */
export function getRetryDelay(attempts: number): number {
  const delays = [60_000, 300_000, 1_800_000]; // 1m, 5m, 30m
  return delays[Math.min(attempts, delays.length - 1)] ?? delays[delays.length - 1]!;
}

/** Format an activity for logging */
export function formatActivityLog(entry: ActivityLogEntry): string {
  const direction = entry.direction === 'inbound' ? '←' : '→';
  const time = entry.createdAt.toISOString();
  return `[${time}] ${direction} ${entry.type} ${entry.actorUri} ${entry.objectUri ?? ''} (${entry.status})`;
}
