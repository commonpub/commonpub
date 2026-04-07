import type { CommonPubConfig } from '@commonpub/config';

export function createTestConfig(overrides?: Partial<CommonPubConfig>): CommonPubConfig {
  return {
    instance: {
      domain: 'test.example.com',
      name: 'Test Instance',
      description: 'A test CommonPub instance',
      contactEmail: 'admin@test.example.com',
      maxUploadSize: 10 * 1024 * 1024,
      contentTypes: ['project', 'article', 'blog', 'explainer'],
      ...overrides?.instance,
    },
    features: {
      content: true,
      social: true,
      hubs: true,
      docs: true,
      video: true,
      contests: false,
      learning: true,
      explainers: true,
      federation: false,
      seamlessFederation: false,
      federateHubs: false,
      admin: false,
      emailNotifications: false,
      ...overrides?.features,
    },
    auth: {
      emailPassword: true,
      magicLink: false,
      passkeys: false,
      ...overrides?.auth,
    },
    docs: {
      searchLanguage: 'english',
      ...overrides?.docs,
    },
  };
}
