import { describe, it, expect, vi } from 'vitest';
import { deleteUserPrivateFileBytes } from '../purgeUserFiles';

// The GDPR-erasure byte purge (session-244). SAFETY-CRITICAL: it must delete ONLY
// private bytes (via deletePrivate) and NEVER the public `delete` path — a public
// file's bytes are served at a direct bucket URL that may be embedded in other users'
// content, so purging them would break live embeds. It must also never throw (the DB
// delete has already committed — can't half-delete the account).

describe('deleteUserPrivateFileBytes', () => {
  it('deletes every key via deletePrivate — never touches the public delete path', async () => {
    const del = vi.fn().mockResolvedValue(undefined);
    const delPriv = vi.fn().mockResolvedValue(undefined);
    Object.assign(globalThis, { useFileStorage: () => ({ delete: del, deletePrivate: delPriv }) });

    await deleteUserPrivateFileBytes([
      { storageKey: 'contest/a.pdf' },
      { storageKey: 'contest/b.pdf' },
    ]);

    expect(delPriv).toHaveBeenCalledTimes(2);
    expect(delPriv).toHaveBeenCalledWith('contest/a.pdf');
    expect(delPriv).toHaveBeenCalledWith('contest/b.pdf');
    // The public delete path must NEVER run — purging public bytes breaks embeds.
    expect(del).not.toHaveBeenCalled();
  });

  it('does not throw when the adapter fails (best-effort after DB commit)', async () => {
    Object.assign(globalThis, { useFileStorage: () => ({ delete: vi.fn(), deletePrivate: vi.fn().mockRejectedValue(new Error('S3 down')) }) });
    await expect(deleteUserPrivateFileBytes([{ storageKey: 'contest/x.pdf' }])).resolves.toBeUndefined();
  });

  it('no-op on empty input (no adapter call)', async () => {
    const spy = vi.fn();
    Object.assign(globalThis, { useFileStorage: spy });
    await deleteUserPrivateFileBytes([]);
    expect(spy).not.toHaveBeenCalled();
  });
});
