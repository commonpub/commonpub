import { describe, it, expect } from 'vitest';

describe('@commonpub/infra', () => {
  it('exports security utilities', async () => {
    const mod = await import('../index.js');
    expect(mod.buildCspDirectives).toBeDefined();
    expect(mod.buildCspHeader).toBeDefined();
    expect(mod.getSecurityHeaders).toBeDefined();
    expect(mod.RateLimitStore).toBeDefined();
    expect(mod.checkRateLimit).toBeDefined();
  });

  it('exports storage utilities', async () => {
    const mod = await import('../index.js');
    expect(mod.generateStorageKey).toBeDefined();
    expect(mod.validateUpload).toBeDefined();
    expect(mod.isProcessableImage).toBeDefined();
    expect(mod.LocalStorageAdapter).toBeDefined();
    expect(mod.S3StorageAdapter).toBeDefined();
    expect(mod.createStorageFromEnv).toBeDefined();
  });

  it('exports email utilities', async () => {
    const mod = await import('../index.js');
    expect(mod.ConsoleEmailAdapter).toBeDefined();
    expect(mod.SmtpEmailAdapter).toBeDefined();
    expect(mod.ResendEmailAdapter).toBeDefined();
    expect(mod.emailTemplates).toBeDefined();
  });

  it('exports image utilities', async () => {
    const mod = await import('../index.js');
    expect(mod.getBestVariant).toBeDefined();
    expect(mod.IMAGE_VARIANTS).toBeDefined();
    expect(mod.processImage).toBeDefined();
  });
});
