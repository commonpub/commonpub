import type { SnaplifyConfig } from '@snaplify/config';

export function createTestConfig(overrides?: Partial<SnaplifyConfig>): SnaplifyConfig {
  return {
    instance: {
      domain: 'test.example.com',
      name: 'Test Instance',
      description: 'A test Snaplify instance',
      contactEmail: 'admin@test.example.com',
      maxUploadSize: 10 * 1024 * 1024,
      contentTypes: ['project', 'article', 'guide', 'blog'],
      ...overrides?.instance,
    },
    features: {
      content: true,
      social: true,
      communities: true,
      docs: true,
      video: true,
      contests: false,
      learning: true,
      explainers: true,
      federation: false,
      ...overrides?.features,
    },
    auth: {
      emailPassword: true,
      magicLink: false,
      passkeys: false,
      ...overrides?.auth,
    },
  };
}
