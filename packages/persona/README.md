# @commonpub/persona

The persona brain for CommonPub: the typed source of truth for what a persona
field is, where its answer is stored, which answers can ever be counted, and what
a user is actually agreeing to when they turn on a sharing toggle.

Pure TypeScript. The only runtime dependency is `zod`. No framework, no ORM, no
database, no HTTP, no DOM.

## Why it is its own package

The dependency direction is one way and shallow:

```
@commonpub/persona          pure TS, zod only
      |
      | imported by
      v
packages/schema/src/persona.ts     Drizzle tables only
packages/server/src/persona/       resolution, values, consent, metrics
layers/base/**                     routes, pages, components
```

Nothing here imports a sibling package, and an isolation test enforces that. The
result is a package that can be reasoned about, tested and replaced on its own,
and a feature that can change later without reaching into eight live subsystems.

Three deliberate copies live here rather than being lifted out of the code they
mirror, each with a test pinning it to its original:

- `httpUrl` / `optionalUrl` mirror `packages/schema/src/validators/_shared.ts`.
  Importing them would create a package edge for one validator.
- `fnv1a32` mirrors the private digest in
  `layers/base/composables/useCookieConsent.ts`. Editing that file risks changing
  the cookie scope digest, which would silently invalidate every stored consent
  on every instance.
- The field-type taxonomy is persona's own, not the contest form engine's.
  Persona has no `required` and no `pii`, partitions by sink rather than by a PII
  toggle, and has its own renderer. The two share a handful of type names and
  nothing else.

## What is in it

| Module | Contents |
|---|---|
| `fields.ts` | `PERSONA_FIELD_TYPES`, `PERSONA_FIELD_SPECS` (closed with `satisfies`), and a fail-closed registry lookup |
| `persona.ts` | `PersonaField`, `PersonaSection`, `personaFieldSink`, `isPersonaFieldAggregatable`, `personaCompleteness`, the link platforms, `BUILTIN_PERSONA_SECTIONS` |
| `purposes.ts` | `PROCESSING_PURPOSES`, the purpose specs and their plain-language copy, `purposeIsOfferable`, `purposeScopeDigest` |
| `thresholds.ts` | `METRICS_MIN_BUCKET` and `MIN_AUDIENCE_POPULATION`, the k-anonymity floors, in one place |
| `schemas.ts` | Every Zod schema, plus `definePersonaSections` for `commonpub.config.ts` |
| `digest.ts` | `fnv1a32` |
| `url.ts` | `httpUrl`, `optionalUrl` |

## Two invariants worth stating out loud

**Free text is never counted.** `PERSONA_FIELD_SPECS` marks every free-text type
non-aggregatable and routes it to the text sink, so there is no operator setting,
anywhere, that turns a bio into statistics. `personaFieldSink` is the single
source of truth for storage routing, and both the write path and the analytics
field list read it rather than re-deriving it.

**Completeness knows nothing about consent.** `personaCompleteness` takes
sections and answers, and that is all it will ever take. Progress measures what
you chose to write about yourself; sharing is a separate decision. A score that
moved when you flipped a sharing toggle would make consent into a game.

## Usage

```ts
import { definePersonaSections } from '@commonpub/persona';

export default defineCommonPubConfig({
  persona: {
    sections: definePersonaSections([
      {
        key: 'workshop',
        label: 'Workshop',
        fields: [
          {
            key: 'machines',
            label: 'What is in your workshop?',
            type: 'multiselect',
            options: [
              { value: 'lathe', label: 'Lathe' },
              { value: 'cnc', label: 'CNC router' },
            ],
          },
        ],
      },
    ]),
  },
});
```

## License

AGPL-3.0-or-later
