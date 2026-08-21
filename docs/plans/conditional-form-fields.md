# Conditional form fields

**Status: built (session 256). Flag `contestConditionalFields`, default ON.**

An operator can make a registration or submission field appear only while another
answer matches. A hidden field is not shown, not required, and nothing is stored
for it.

## Why

deveco's live Resilient America contest has a 42-field registration form with 20
required fields, and its shape is the argument for this feature:

| Field | Asked of | Actually needed from |
| --- | --- | --- |
| Entity Verification Document (upload) | everyone | entrants who ticked "registered US entity" |
| Recipient / Attention (required) | everyone | entrants who might be shipped a dev kit |
| Phone Number (required) | everyone | same |
| Shipping Address (required) | everyone | same |
| Organization name / role / website | everyone | entrants entering as an organization |

Every entrant hands over a home address and a phone number, before they have
decided to enter, for a shipment that only happens if they reach the semi-finals.
That is a funnel problem and a data-minimisation problem in the same form.

## The model

```ts
interface FormFieldCondition {
  field: string;    // key of an EARLIER select/radio/checkbox field
  equals: string[]; // stored values that reveal this field
}
interface FormField { /* … */ showWhen?: FormFieldCondition }
```

Four constraints, each earning its place:

- **One controlling field, not a boolean tree.** Operators reason "show the
  shipping block to hardware entrants". Nested and/or was not worth the builder
  UI or the failure modes it opens.
- **The source must be EARLIER in the template.** A cycle becomes
  unrepresentable rather than merely rejected, and visibility resolves in a
  single forward pass.
- **The source must be `select`, `radio` or `checkbox`** — a closed answer set
  the builder can offer as checkboxes. Matching on free text breaks silently on a
  typo or a trailing space.
- **`equals` holds STORED values**, never labels, so relabelling an option never
  breaks a rule.

A `section` may carry a rule, which gates the section header and every field down
to the next section. An unconditional section reopens the gate. A field's own rule
is ANDed with its section's.

**An answer belonging to a hidden field is not an answer.** A rule keyed on a
hidden field is unsatisfied, so hiding cascades instead of resurrecting a
grandchild whose parent went away.

## Where it lives

| Concern | File |
| --- | --- |
| Type + resolution (single source of truth) | `packages/schema/src/contest.ts` — `FormFieldCondition`, `visibleFormFieldKeys`, `isConditionSourceField`, `FORM_ACCEPTANCE_VALUES` |
| Write validation (cross-field) | `packages/schema/src/validators/contest.ts` — `formFieldConditionSchema`, `applyTemplateConditionRules` |
| Authoritative validate + partition | `packages/server/src/contest/validation.ts` |
| Entrant-side gate + payload | `layers/base/utils/contestSubmission.ts` — `visibleTemplateFields`, `blockingFieldKeys`, `buildSubmissionPayload` |
| Builder edit ops + repair | `layers/base/utils/contestStages.ts` — `templateConditionsRepaired`, `templateFieldConditionSet`, `conditionSourcesFor`, `conditionValueChoices` |
| Builder UI | `layers/base/components/contest/FormTemplateEditor.vue` |
| Entrant forms | `ContestRegistrationForm.vue`, `ContestProposalForm.vue`, `ContestStageSubmission.vue` |
| Markdown DSL | `layers/base/utils/registrationMarkdown.ts` — `show=key:a|b` |

`visibleFormFieldKeys` is called by the renderer, the client required-gate, the
payload builder and the server. A second implementation is how a field gets hidden
on screen but still demanded by the server.

## The repair pass

Deleting the source, moving it below its dependent, retyping it, renaming an
option value, or deleting the matched option each leave a rule that can never
hold. Every builder op routes through `templateConditionsRepaired`, which drops
what cannot hold — otherwise the operator's NEXT save fails Zod with an error
about a field they were not editing.

Renaming a source's LABEL re-keys it (the key tracks the label until hand-edited),
so `templateFieldLabelChanged` carries dependents to the new key. Without that,
one keystroke in a label silently orphans every rule pointing at it and the repair
pass then deletes the rules the operator just wrote.

## Server semantics

`validateSubmissionFields` resolves visibility once, from the SUBMITTED answers,
then skips every hidden field: no required check, no domain check, nothing stored
in any of the three partitions (artifact, PII, agreements).

Evaluating against the submitted answers is the only coherent option — the
entrant's own answers are what determined what they saw — and it is why a rule may
only name an earlier field of a closed type. The unknown-key guard is unchanged: a
hidden field's key is in the template, a smuggled key is not.

## The flag

`contestConditionalFields` gates what the BUILDER OFFERS, mirroring `contestPii`.
A stored rule is always honoured. Turning the flag off must never resurrect a
hidden required field mid-contest, which would block every submission.

Default ON: the affordance is additive and the feature is inert until an operator
authors a rule, which puts it with `contestStageSubmissions` rather than with the
data-collecting flags.

## Markdown DSL

```
- Registered US entity (checkbox)
## Organization (show=registered_us_entity:true)
- Legal name (text)
- Proof of registration (file, pii, show=registered_us_entity:true)
- Notes (text, show=track:developer|startup)
```

Values are pipe-separated because commas already split modifiers. Import mirrors
the server's cross-field rules and reports a bad rule naming the field, rather
than letting an opaque PUT 400 land after the operator has replaced their form.

## Verified

Against a local instance carrying a byte-identical copy of deveco's live contest
(42 fields, 20 required, same stages):

| Check | Result |
| --- | --- |
| Field rule hides the entity upload | 38 inputs → 29, page 5677px → 5007px |
| Section rule hides the whole dev-kit block | recipient + phone + address all gone; the next section still shows |
| Required errors drop with the hidden fields | 20 → 17 |
| Ticking the source reveals its field | back to 38 inputs |
| Switching the track back hides the block again | independent rules, both correct |
| Developer registers with no shipping fields | 200 |
| Same answers on the startup track | 400 "Recipient / Attention is required" |
| Stale answer to a hidden field | dropped, not stored |
| Builder control | on 40 of 42 cards (the first two have no eligible source above them) |

Tests: 27 schema, 10 server, 31 layer utils, 8 registration-form component
(including axe), 6 builder component.

## Deliberately not built

- Boolean trees (`any`/`all`, nested groups).
- Conditions on free-text sources, or operators other than equality.
- Cross-stage conditions (a stage form keyed on a registration answer). The forms
  are validated independently and share no answer scope.
- Server-side rewriting of already-stored answers when an operator adds a rule to
  a running contest. Existing rows keep the answers they were given; only new
  writes are filtered.
