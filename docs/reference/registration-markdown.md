# Registration form markdown (DSL)

A small, forgiving markdown dialect for authoring a contest **registration form** (or a
stage **submission form**) as plain text. Paste it into the registration editor's
**Markdown** panel and hit **Import** to build the form; hit **Load current form** to
export the current form back to this format. It round-trips: export → edit → import is
stable.

Implementation: `layers/base/utils/registrationMarkdown.ts`
(`registrationMarkdownToTemplate` / `templateToRegistrationMarkdown`). The parsed
`FormField[]` is saved through the normal contest save, which re-validates.

## Syntax

### Sections

A markdown heading is a **section** (a non-input divider with a title). A plain line
right after the heading becomes the section's description.

```markdown
## Participant
Tell us who is entering.
```

### Fields

A top-level list item is a **field**:

```
- <label>[*] [(<type>[, <modifier>…])][: <options>]
```

- `*` right after the label marks it **required**.
- `(<type>, …)` sets the field type and modifiers (see tables). If omitted, the type is
  `text`.
- `: a, b, c` after the field are the **options** for `select` / `radio`.
- An indented `> line` under the field is its **help text**.
- Indented `- bullet` lines under an `(agreement)` become its **terms**.

```markdown
- Full Official Name* (text)
- Email Address* (email, pii)
  > We never show this publicly.
- Challenge Track* (select): Developer, Startup
- Eligibility* (agreement)
  - I am 18 years of age or older.
  - I am a legal US resident.
```

## Types

| Keyword | Field | Aliases |
|---|---|---|
| `text` | Short text | — |
| `textarea` | Long text | `longtext`, `paragraph` |
| `number` | Number | — |
| `date` | Date | — |
| `select` | Dropdown | `dropdown`, `choice` |
| `radio` | Radio group | — |
| `checkbox` | Single checkbox (consent) | `check` |
| `email` | Email | — |
| `tel` | Phone | `phone` |
| `url` | Link | `link` |
| `agreement` | Terms to accept | `agree` |
| `address` | Structured mailing address (always private) | — |
| `file` | Private file upload | — |
| `signature` | E-signature (private) | `sig` |
| `section` | Section header | `header`, `heading` (or just use `##`) |

## Modifiers (inside the parentheses, comma-separated)

| Modifier | Effect | Example |
|---|---|---|
| `required` | Same as a trailing `*` | `- Name (text, required)` |
| `pii` / `private` | Store privately, hide from public listing | `(email, pii)` |
| `max=N` | Character cap (≤ 4000) | `(textarea, max=2000)` |
| `accept=…` | File MIME allow-list — **separate MIME types with `\|`** (commas are the modifier separator) | `(file, accept=application/pdf\|image/png)` |
| `size=N` | Max upload size in KB | `(file, size=10240)` |

## Options

For `select` / `radio`, options follow a colon. The stored value is auto-derived from the
label; use `value=Label` to set it explicitly.

```markdown
- Country* (select): United States, Canada, Other
- Size (radio): sm=Small team, lg=Large team
```

## Notes & limits

- Max **50** fields. Keys are auto-derived from labels (`lowercase_with_underscores`) and
  de-duplicated (`name`, `name_2`, …).
- `address`, `file`, `signature` fields are always stored privately (PII); `file` /
  `signature` require the `contestPrivateFiles` feature flag.
- A repeatable **team-member group** is not yet a field type — see
  `docs/plans/team-registration-and-collaborative-content.md`.
- Import **replaces** the whole form (with a confirm if it isn't empty). Problems (a
  `select` with no options, an `agreement` with no terms, unknown modifiers) are listed
  and block the import until fixed.
