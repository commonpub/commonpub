import { describe, it, expect, vi } from 'vitest';
import { deleteUserFileBytes } from '../purgeUserFiles';

// The GDPR-erasure byte purge (session-244 post-roll audit): private files must route
// to deletePrivate (a different key space), public to delete, and a storage failure
// must NOT throw (the DB delete has already committed — can't half-delete the account).

describe('deleteUserFileBytes', () => {
  it('routes private→deletePrivate, public→delete; swallows storage errors', async () => {
    const del = vi.fn().mockResolvedValue(undefined);
    const delPriv = vi.fn().mockResolvedValue(undefined);
    Object.assign(globalThis, { useFileStorage: () => ({ delete: del, deletePrivate: delPriv }) });

    await deleteUserFileBytes([
      { storageKey: 'contest/a.pdf', visibility: 'private' },
      { storageKey: 'content/b.png', visibility: 'public' },
      { storageKey: 'contest/c.pdf', visibility: 'private' },
    ]);

    expect(delPriv).toHaveBeenCalledTimes(2);
    expect(delPriv).toHaveBeenCalledWith('contest/a.pdf');
    expect(delPriv).toHaveBeenCalledWith('contest/c.pdf');
    expect(del).toHaveBeenCalledTimes(1);
    expect(del).toHaveBeenCalledWith('content/b.png');
  });

  it('does not throw when the adapter fails (best-effort after DB commit)', async () => {
    Object.assign(globalThis, { useFileStorage: () => ({ delete: vi.fn(), deletePrivate: vi.fn().mockRejectedValue(new Error('S3 down')) }) });
    await expect(deleteUserFileBytes([{ storageKey: 'contest/x.pdf', visibility: 'private' }])).resolves.toBeUndefined();
  });

  it('no-op on empty input (no adapter call)', async () => {
    const spy = vi.fn();
    Object.assign(globalThis, { useFileStorage: spy });
    await deleteUserFileBytes([]);
    expect(spy).not.toHaveBeenCalled();
  });
});
