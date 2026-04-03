/**
 * Tests for the CommonPub hook system.
 *
 * Tests:
 * - onHook registers handlers
 * - emitHook calls registered handlers with correct payload
 * - Multiple handlers per event
 * - Failing handler doesn't break other handlers
 * - clearHooks resets all registrations
 * - hookCount returns correct count
 * - Hooks receive DB instance in payload
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { onHook, emitHook, clearHooks, hookCount } from '../hooks.js';
import type { HookPayloads } from '../hooks.js';

describe('hook system', () => {
  beforeEach(() => {
    clearHooks();
  });

  describe('onHook + emitHook', () => {
    it('registered handler is called with correct payload', async () => {
      const calls: Array<HookPayloads['content:published']> = [];

      onHook('content:published', async (payload) => {
        calls.push(payload);
      });

      await emitHook('content:published', {
        db: {} as HookPayloads['content:published']['db'],
        contentId: 'test-id',
        authorId: 'author-1',
        contentType: 'project',
        slug: 'test-project',
      });

      expect(calls).toHaveLength(1);
      expect(calls[0]!.contentId).toBe('test-id');
      expect(calls[0]!.contentType).toBe('project');
      expect(calls[0]!.slug).toBe('test-project');
    });

    it('multiple handlers for same event are all called', async () => {
      let count = 0;

      onHook('hub:post:created', async () => { count++; });
      onHook('hub:post:created', async () => { count++; });
      onHook('hub:post:created', async () => { count++; });

      await emitHook('hub:post:created', {
        db: {} as HookPayloads['hub:post:created']['db'],
        postId: 'p1',
        hubId: 'h1',
        authorId: 'a1',
        postType: 'text',
      });

      expect(count).toBe(3);
    });

    it('returns count of successful handlers', async () => {
      onHook('content:updated', async () => { /* success */ });
      onHook('content:updated', async () => { /* success */ });

      const succeeded = await emitHook('content:updated', {
        db: {} as HookPayloads['content:updated']['db'],
        contentId: 'c1',
        authorId: 'a1',
      });

      expect(succeeded).toBe(2);
    });

    it('returns 0 when no handlers registered', async () => {
      const succeeded = await emitHook('content:deleted', {
        db: {} as HookPayloads['content:deleted']['db'],
        contentId: 'c1',
        authorId: 'a1',
      });

      expect(succeeded).toBe(0);
    });
  });

  describe('error isolation', () => {
    it('failing handler does not prevent other handlers from running', async () => {
      const results: string[] = [];

      onHook('hub:member:joined', async () => {
        results.push('first');
      });
      onHook('hub:member:joined', async () => {
        throw new Error('Hook failure!');
      });
      onHook('hub:member:joined', async () => {
        results.push('third');
      });

      const succeeded = await emitHook('hub:member:joined', {
        db: {} as HookPayloads['hub:member:joined']['db'],
        hubId: 'h1',
        userId: 'u1',
        role: 'member',
      });

      expect(results).toEqual(['first', 'third']);
      expect(succeeded).toBe(2); // 2 of 3 succeeded
    });
  });

  describe('clearHooks', () => {
    it('removes all registered handlers', async () => {
      onHook('content:published', async () => {});
      onHook('hub:post:created', async () => {});

      expect(hookCount('content:published')).toBe(1);
      expect(hookCount('hub:post:created')).toBe(1);

      clearHooks();

      expect(hookCount('content:published')).toBe(0);
      expect(hookCount('hub:post:created')).toBe(0);
    });
  });

  describe('hookCount', () => {
    it('returns 0 for unregistered events', () => {
      expect(hookCount('content:liked')).toBe(0);
    });

    it('returns correct count after registration', () => {
      onHook('content:liked', async () => {});
      onHook('content:liked', async () => {});
      expect(hookCount('content:liked')).toBe(2);
    });
  });

  describe('typed payloads', () => {
    it('federation content received hook has federation-specific fields', async () => {
      const calls: Array<HookPayloads['federation:content:received']> = [];

      onHook('federation:content:received', async (payload) => {
        calls.push(payload);
      });

      await emitHook('federation:content:received', {
        db: {} as HookPayloads['federation:content:received']['db'],
        federatedContentId: 'fc-1',
        objectUri: 'https://remote.example.com/content/test',
        actorUri: 'https://remote.example.com/users/alice',
        originDomain: 'remote.example.com',
        apType: 'Article',
        cpubType: 'project',
      });

      expect(calls[0]!.originDomain).toBe('remote.example.com');
      expect(calls[0]!.cpubType).toBe('project');
    });

    it('hub member left hook has minimal payload', async () => {
      const calls: Array<HookPayloads['hub:member:left']> = [];

      onHook('hub:member:left', async (payload) => {
        calls.push(payload);
      });

      await emitHook('hub:member:left', {
        db: {} as HookPayloads['hub:member:left']['db'],
        hubId: 'h1',
        userId: 'u1',
      });

      expect(calls[0]!.hubId).toBe('h1');
      expect(calls[0]!.userId).toBe('u1');
    });
  });
});
