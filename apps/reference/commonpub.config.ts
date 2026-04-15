import { defineCommonPubConfig } from '@commonpub/config';

export default defineCommonPubConfig({
  instance: {
    name: 'CommonPub',
    domain: 'localhost:3000',
    description: 'A CommonPub reference instance',
    contentTypes: ['project', 'blog', 'explainer'],
    contestCreation: 'open',
  },
  features: {
    content: true,
    social: true,
    hubs: true,
    docs: true,
    video: true,
    contests: true,
    learning: true,
    explainers: true,
    editorial: true,
    federation: true,
    federateHubs: true,
    seamlessFederation: true,
    admin: true,
  },
  auth: {
    emailPassword: true,
    magicLink: false,
    passkeys: false,
    trustedInstances: ['deveco.io'],
  },
});
