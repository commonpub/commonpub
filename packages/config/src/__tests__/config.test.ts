import { describe, it, expect } from 'vitest';
import { defineSnaplifyConfig } from '../config';

const validInstance = {
  domain: 'test.snaplify.dev',
  name: 'Test Instance',
  description: 'A test Snaplify instance',
};

describe('defineSnaplifyConfig', () => {
  it('should accept minimal valid config', () => {
    const { config, warnings } = defineSnaplifyConfig({ instance: validInstance });

    expect(config.instance.domain).toBe('test.snaplify.dev');
    expect(config.instance.name).toBe('Test Instance');
    expect(config.instance.maxUploadSize).toBe(10 * 1024 * 1024);
    expect(warnings).toHaveLength(0);
  });

  it('should apply default feature flags', () => {
    const { config } = defineSnaplifyConfig({ instance: validInstance });

    expect(config.features.content).toBe(true);
    expect(config.features.social).toBe(true);
    expect(config.features.communities).toBe(true);
    expect(config.features.docs).toBe(true);
    expect(config.features.video).toBe(true);
    expect(config.features.contests).toBe(false);
    expect(config.features.learning).toBe(true);
    expect(config.features.explainers).toBe(true);
    expect(config.features.federation).toBe(false);
  });

  it('should allow disabling content feature flag', () => {
    const { config } = defineSnaplifyConfig({
      instance: validInstance,
      features: { content: false },
    });

    expect(config.features.content).toBe(false);
  });

  it('should allow disabling social feature flag', () => {
    const { config } = defineSnaplifyConfig({
      instance: validInstance,
      features: { social: false },
    });

    expect(config.features.social).toBe(false);
  });

  it('should default content and social to true', () => {
    const { config } = defineSnaplifyConfig({ instance: validInstance });

    expect(config.features.content).toBe(true);
    expect(config.features.social).toBe(true);
  });

  it('should allow enabling content while disabling social', () => {
    const { config } = defineSnaplifyConfig({
      instance: validInstance,
      features: { content: true, social: false },
    });

    expect(config.features.content).toBe(true);
    expect(config.features.social).toBe(false);
  });

  it('should apply default auth config', () => {
    const { config } = defineSnaplifyConfig({ instance: validInstance });

    expect(config.auth.emailPassword).toBe(true);
    expect(config.auth.magicLink).toBe(false);
    expect(config.auth.passkeys).toBe(false);
    expect(config.auth.github).toBeUndefined();
    expect(config.auth.google).toBeUndefined();
  });

  it('should allow overriding feature flags', () => {
    const { config } = defineSnaplifyConfig({
      instance: validInstance,
      features: { contests: true, federation: true },
    });

    expect(config.features.contests).toBe(true);
    expect(config.features.federation).toBe(true);
    expect(config.features.communities).toBe(true); // default preserved
  });

  it('should accept OAuth provider config', () => {
    const { config } = defineSnaplifyConfig({
      instance: validInstance,
      auth: {
        github: { clientId: 'gh-id', clientSecret: 'gh-secret' },
        google: { clientId: 'g-id', clientSecret: 'g-secret' },
      },
    });

    expect(config.auth.github?.clientId).toBe('gh-id');
    expect(config.auth.google?.clientId).toBe('g-id');
  });

  it('should apply default content types', () => {
    const { config } = defineSnaplifyConfig({ instance: validInstance });

    expect(config.instance.contentTypes).toEqual(['project', 'article', 'guide', 'blog']);
  });

  it('should allow custom content types', () => {
    const { config } = defineSnaplifyConfig({
      instance: { ...validInstance, contentTypes: ['project', 'blog'] },
    });

    expect(config.instance.contentTypes).toEqual(['project', 'blog']);
  });

  describe('validation errors', () => {
    it('should reject empty domain', () => {
      expect(() =>
        defineSnaplifyConfig({
          instance: { ...validInstance, domain: '' },
        }),
      ).toThrow();
    });

    it('should reject empty name', () => {
      expect(() =>
        defineSnaplifyConfig({
          instance: { ...validInstance, name: '' },
        }),
      ).toThrow();
    });

    it('should reject name exceeding 128 chars', () => {
      expect(() =>
        defineSnaplifyConfig({
          instance: { ...validInstance, name: 'x'.repeat(129) },
        }),
      ).toThrow();
    });

    it('should reject invalid contact email', () => {
      expect(() =>
        defineSnaplifyConfig({
          instance: { ...validInstance, contactEmail: 'not-an-email' },
        }),
      ).toThrow();
    });

    it('should reject negative upload size', () => {
      expect(() =>
        defineSnaplifyConfig({
          instance: { ...validInstance, maxUploadSize: -1 },
        }),
      ).toThrow();
    });

    it('should reject invalid content types', () => {
      expect(() =>
        defineSnaplifyConfig({
          instance: { ...validInstance, contentTypes: ['invalid' as 'project'] },
        }),
      ).toThrow();
    });
  });

  describe('warnings', () => {
    it('should warn when sharedAuthDb is set', () => {
      const { warnings } = defineSnaplifyConfig({
        instance: validInstance,
        auth: { sharedAuthDb: 'postgresql://shared:5432/auth' },
      });

      expect(warnings).toHaveLength(1);
      expect(warnings[0]!.field).toBe('auth.sharedAuthDb');
      expect(warnings[0]!.message).toContain('Model C');
    });

    it('should warn when federation enabled without trusted instances', () => {
      const { warnings } = defineSnaplifyConfig({
        instance: validInstance,
        features: { federation: true },
      });

      expect(warnings.some((w) => w.field === 'features.federation')).toBe(true);
    });

    it('should warn when learning enabled but explainers disabled', () => {
      const { warnings } = defineSnaplifyConfig({
        instance: validInstance,
        features: { learning: true, explainers: false },
      });

      expect(warnings.some((w) => w.field === 'features.explainers')).toBe(true);
    });

    it('should not warn when federation has trusted instances', () => {
      const { warnings } = defineSnaplifyConfig({
        instance: validInstance,
        features: { federation: true },
        auth: { trustedInstances: ['other.snaplify.dev'] },
      });

      expect(warnings.some((w) => w.field === 'features.federation')).toBe(false);
    });
  });
});
