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
    // Surface the contest submission-form builder on the reference instance:
    // proposal-mode entries + the agreement/address (PII) field types. Other
    // operators stay opt-in (the @commonpub/config + layer defaults are OFF).
    // PII *read* access is always gated server-side by the `contest.pii` permission.
    contestProposals: true,
    contestPii: true,
    learning: true,
    explainers: true,
    editorial: true,
    federation: true,
    federateHubs: true,
    seamlessFederation: true,
    admin: true,
    // commonpub.io is the default discovery registry: accept signed pings from
    // other instances + serve the directory. announceToRegistry defaults true
    // but self-skips here (registryUrl == own domain), so it won't ping itself.
    actAsRegistry: true,
  },
  auth: {
    emailPassword: true,
    magicLink: false,
    passkeys: false,
    trustedInstances: ['deveco.io'],
  },
});
