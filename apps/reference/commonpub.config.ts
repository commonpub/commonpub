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
    // Private file-upload + signature registration field types (P6). Uploads are
    // stored non-public and served only through the gated /api/files/[id]/raw route,
    // scoped to the specific contest's organizers. Requires contestPii.
    contestPrivateFiles: true,
    learning: true,
    explainers: true,
    editorial: true,
    federation: true,
    federateHubs: true,
    seamlessFederation: true,
    admin: true,
    // Session 255: persona customization + purpose-scoped sharing consent +
    // k-anonymous audience analytics.
    //
    // OFF on purpose. This file builds the commonpub.io production image
    // (`Dockerfile` copies `apps/reference/.output`, and `deploy.yml` fires on
    // every push to main), so flipping one of these to `true` here starts
    // COLLECTING PERSONAL DATA in production as a side effect of a code deploy.
    // Turn them on deliberately, after a browser pass on the target instance,
    // and read `docs/reference/guides/persona-schema.md` first.
    persona: false,
    dataSharingConsents: false,
    personaAnalytics: false,
    // The opt-in member visibility directory. OFF for the same reason, and
    // doubly inert without a `dataSharing.recipients` entry: `purposeIsOfferable`
    // refuses to offer `recruiter_visibility` with no covering recipient, so
    // nobody is asked, nobody consents, and the endpoint 403s every caller.
    memberDirectory: false,
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
  /**
   * Persona: the profile questions this instance asks, committable to git.
   *
   * COMMENTED OUT deliberately. `features.persona` IS on for this reference
   * instance (see above) so the feature can be exercised locally, but the
   * schema stays absent so the instance runs on the built-in sections, which
   * is the path every operator gets by default. The @commonpub/config defaults
   * for all three persona flags remain OFF, because turning them on starts
   * collecting personal data that was not collected before.
   *
   * Omitting this key entirely gives every instance the built-in sections
   * (Basics, Interests, Tech stack, Links). Declaring it REPLACES them
   * wholesale, never merges.
   *
   * Precedence: an admin override saved at /admin/persona beats this file, and
   * this file beats the built-ins. That is deliberate whole-document precedence
   * in both directions: merging key by key means an operator deletes a section
   * in git and the database resurrects it. /admin/persona shows which source is
   * live and can revert to this file in one click.
   *
   * The rules a bare example does not show, each of which bites:
   *
   * - a field `key` is `^[a-z0-9_]+$`, max 40, unique across EVERY section (it
   *   is the analytics namespace), and IMMUTABLE once answers exist: renaming it
   *   orphans every member's rows for that field;
   * - an option `value` is `^[a-z0-9_]+$`, max 64, and is what gets stored, so
   *   relabelling an option never rewrites user data;
   * - a section holds at most 24 fields, a template at most 300, and at most 120
   *   countable buckets in total (one per option of each counted field);
   * - ANSWERS ARE PRIVATE BY DEFAULT. A field appears on the public profile
   *   route only when it declares `showOnProfile: true`, and no built-in field
   *   declares it, so a default instance publishes no answers at all. Marking
   *   interests and tech stack visible is the common choice, not the default,
   *   and an operational question (which tools are you trained on) should
   *   usually stay private;
   * - `sensitive: true` is the Art. 9 escape hatch. It moves the field to the
   *   free-text store and removes it from EVERY count, permanently, and it is
   *   never on the public profile whatever `showOnProfile` says;
   * - `analytics: false` does the same without the Art. 9 claim;
   * - neither may be set on a `multiselect`, and nor may `column`: those three
   *   all route a field to a store that holds ONE value, so the field would be
   *   unfillable. The config parse refuses it at boot rather than at save time;
   * - a `link` field must name a declared platform. The seven built-ins are
   *   github, twitter, linkedin, youtube, instagram, mastodon and discord;
   *   anything else has to appear in `linkPlatforms` below.
   *
   * `dataSharing` is separate, below, and is FILE-ONLY: there is no runtime
   * override route for recipients or the k-anonymity floors in this release.
   */
  // persona: {
  //   sections: [
  //     {
  //       key: 'workshop',
  //       label: 'Your workshop',
  //       help: 'None of this is required, and none of it is shared unless you say so.',
  //       order: 4,
  //       fields: [
  //         {
  //           // A COUNTED field: closed vocabulary, so it can become a cohort.
  //           // Answers are PRIVATE by default; this one opts in to the public
  //           // profile, which is a choice rather than a formality.
  //           key: 'workshop_space',
  //           label: 'Where do you build?',
  //           type: 'select',
  //           showOnProfile: true,
  //           options: [
  //             { value: 'home', label: 'At home' },
  //             { value: 'makerspace', label: 'A makerspace' },
  //             { value: 'work', label: 'At work' },
  //           ],
  //         },
  //         {
  //           // NEVER counted, and never on the public profile: `sensitive` is
  //           // the Art. 9 hatch, so it overrides `showOnProfile` even if
  //           // somebody sets it. No visibility flag is needed here, private is
  //           // already the default. The closed vocabulary is still enforced.
  //           key: 'accessibility_needs',
  //           label: 'Anything we should know to make events work for you?',
  //           type: 'select',
  //           sensitive: true,
  //           options: [
  //             { value: 'step_free', label: 'Step-free access' },
  //             { value: 'quiet', label: 'A quiet space' },
  //             { value: 'other', label: 'Something else, I will get in touch' },
  //           ],
  //         },
  //         {
  //           // Collected, private like every other answer, and deliberately
  //           // kept out of statistics.
  //           key: 'shop_notes',
  //           label: 'What is on your bench right now?',
  //           type: 'textarea',
  //           maxLength: 500,
  //           analytics: false,
  //         },
  //         {
  //           // An OPERATOR-DECLARED platform, which needs the entry below.
  //           key: 'link_gitlab',
  //           label: 'GitLab',
  //           type: 'link',
  //           platform: 'gitlab',
  //         },
  //       ],
  //     },
  //   ],
  //   linkPlatforms: [
  //     {
  //       key: 'gitlab',
  //       label: 'GitLab',
  //       // An EMPTY list means any http(s) host, which is what a self-hosted or
  //       // federated platform needs. Every other entry should name its hosts.
  //       hostSuffixes: ['gitlab.com'],
  //       placeholder: 'https://gitlab.com/yourname',
  //       // A registry FACT, decided once where the platform is named: is a link
  //       // here evidence the account is really theirs?
  //       authenticitySignal: true,
  //     },
  //   ],
  //   completeness: 'progress',
  //   firstRun: 'offer',
  // },
  //
  // dataSharing: {
  //   // Bump this when the disclosure copy or the recipient list changes in a
  //   // way members should re-read. It moves the consent scope digest, so every
  //   // existing grant stops authorising anything until it is confirmed again.
  //   policyVersion: '1',
  //   // FLOORS, not values: 5 and 25 are the hard minimums and cannot be dialled
  //   // below. Raise them on a small instance, or where the audience API is
  //   // published to key holders you do not control.
  //   minBucket: 5,
  //   minPopulation: 25,
  //   // Declaring a recipient is what makes `recruiter_visibility` offerable:
  //   // `purposeIsOfferable` refuses a purpose with no covering recipient, and
  //   // refuses one whose non-processor recipient has no `agreementRef`. So the
  //   // directory cannot be switched on before the transfer is papered.
  //   // `features.publicApi` and `features.memberDirectory` must also be on.
  //   recipients: [
  //     {
  //       id: 'acme_robotics',
  //       name: 'Acme Robotics',
  //       privacyPolicyUrl: 'https://example.com/privacy',
  //       purposes: ['recruiter_visibility'],
  //       // 'processor' acts only on your instructions and needs no agreementRef.
  //       // A joint or independent controller decides for itself, and is refused
  //       // until `agreementRef` names the signed Art. 26/28 instrument.
  //       relationship: 'independent_controller',
  //       agreementRef: 'https://example.com/dpa/acme-2026',
  //       country: 'US',
  //       transferMechanism: 'scc',
  //     },
  //   ],
  // },
  // Declare any non-essential (analytics/functional) cookies here to surface the
  // consent banner; an essential-only instance needs none (and shows no banner).
  // The reference instance declares a provider so the consent-gated path is
  // exercised by the e2e suite, but `features.analytics` stays OFF, so nothing
  // is ever loaded here. A real instance sets both.
  analytics: {
    provider: 'ga4',
    measurementId: 'G-REFERENCE0',
  },
});