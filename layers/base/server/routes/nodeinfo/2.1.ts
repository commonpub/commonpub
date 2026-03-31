// NodeInfo 2.1 response
import { buildNodeInfoResponse } from '@commonpub/protocol';
import { getPlatformStats } from '@commonpub/server';

export default defineEventHandler(async () => {
  const config = useConfig();
  const db = useDB();

  let userCount = 0;
  let localPostCount = 0;

  try {
    const stats = await getPlatformStats(db);
    userCount = stats.users.total ?? 0;
    localPostCount = stats.content.total ?? 0;
  } catch {
    // DB may not be available, return zeros
  }

  return buildNodeInfoResponse({
    config,
    version: '0.0.1',
    userCount,
    activeMonthCount: userCount,
    localPostCount,
  });
});
