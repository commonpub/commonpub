import { describe, it, expect } from 'vitest';
import { buildNodeInfoResponse, buildNodeInfoWellKnown } from '../nodeinfo';

function createTestConfig(federation = false) {
  return {
    instance: {
      domain: 'test.example.com',
      name: 'Test Instance',
      description: 'A test instance',
    },
    features: {
      hubs: true,
      docs: true,
      video: true,
      contests: false,
      learning: true,
      explainers: true,
      federation,
    },
    auth: {
      emailPassword: true,
      magicLink: false,
      passkeys: false,
    },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe('buildNodeInfoResponse', () => {
  it('should produce valid NodeInfo 2.1', () => {
    const result = buildNodeInfoResponse({
      config: createTestConfig(),
      version: '0.1.0',
      userCount: 42,
      activeMonthCount: 10,
      localPostCount: 200,
    });

    expect(result.version).toBe('2.1');
    expect(result.software.name).toBe('commonpub');
    expect(result.software.version).toBe('0.1.0');
    expect(result.usage.users.total).toBe(42);
    expect(result.usage.users.activeMonth).toBe(10);
    expect(result.usage.localPosts).toBe(200);
    expect(result.openRegistrations).toBe(true);
  });

  it('should include activitypub protocol when federation is enabled', () => {
    const result = buildNodeInfoResponse({
      config: createTestConfig(true),
      version: '0.1.0',
      userCount: 0,
      activeMonthCount: 0,
      localPostCount: 0,
    });

    expect(result.protocols).toContain('activitypub');
  });

  it('should have empty protocols when federation is disabled', () => {
    const result = buildNodeInfoResponse({
      config: createTestConfig(false),
      version: '0.1.0',
      userCount: 0,
      activeMonthCount: 0,
      localPostCount: 0,
    });

    expect(result.protocols).toEqual([]);
  });

  it('should include feature flags in metadata', () => {
    const result = buildNodeInfoResponse({
      config: createTestConfig(),
      version: '0.1.0',
      userCount: 0,
      activeMonthCount: 0,
      localPostCount: 0,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const features = (result.metadata as any).features;
    expect(features.communities).toBe(true);
    expect(features.contests).toBe(false);
    expect(features.learning).toBe(true);
  });

  it('should include instance name in metadata', () => {
    const result = buildNodeInfoResponse({
      config: createTestConfig(),
      version: '0.1.0',
      userCount: 0,
      activeMonthCount: 0,
      localPostCount: 0,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result.metadata as any).nodeName).toBe('Test Instance');
  });
});

describe('buildNodeInfoWellKnown', () => {
  it('should produce well-known nodeinfo link', () => {
    const result = buildNodeInfoWellKnown('test.example.com');

    expect(result.links).toHaveLength(1);
    expect(result.links[0]).toEqual({
      rel: 'http://nodeinfo.diaspora.software/ns/schema/2.1',
      href: 'https://test.example.com/nodeinfo/2.1',
    });
  });
});
