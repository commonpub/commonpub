import { listFederationActivity } from '@commonpub/server';

const VALID_DIRECTIONS = ['inbound', 'outbound'] as const;
const VALID_STATUSES = ['pending', 'delivered', 'failed', 'processed'] as const;

export default defineEventHandler(async (event) => {
  requireFeature('admin');
  requireAdmin(event);
  const db = useDB();

  const query = getQuery(event);

  const direction = VALID_DIRECTIONS.includes(query.direction as typeof VALID_DIRECTIONS[number])
    ? (query.direction as 'inbound' | 'outbound')
    : undefined;

  const status = VALID_STATUSES.includes(query.status as typeof VALID_STATUSES[number])
    ? (query.status as 'pending' | 'delivered' | 'failed' | 'processed')
    : undefined;

  const limit = Math.max(1, Math.min(100, parseInt(query.limit as string, 10) || 50));
  const offset = Math.max(0, parseInt(query.offset as string, 10) || 0);

  return listFederationActivity(db, {
    direction,
    status,
    type: typeof query.type === 'string' ? query.type : undefined,
    limit,
    offset,
  });
});
