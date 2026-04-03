# Session 059 — Second-Pass Deep Audit & Fixes

## What was done

Second-pass audit covering every package not deeply reviewed in session 058: protocol, auth, learning, explainer, docs, all frontend pages/composables/middleware/plugins. Found and fixed 10 additional issues.

### Fixes applied (10 total)

**P1 — Security:**

1. **Explainer `sectionRenderer` HTML sanitization** (`packages/explainer/src/render/sectionRenderer.ts`)
   - Text, quote, and callout blocks passed `attrs.html` directly into output HTML
   - Added `sanitizeRichHtml()` that strips script tags, event handler attributes, javascript: URLs, and disallowed tags/attributes while preserving TipTap-safe markup

2. **`createContent`/`updateContent` dropped 3 validated fields** (`packages/server/src/content/content.ts`)
   - `estimatedMinutes`, `licenseType`, and `series` were accepted by Zod schema and existed as DB columns but were never stored
   - Added all three to both INSERT (createContent) and UPDATE (updateContent) paths

3. **Auth middleware leaked internal error details** (`apps/reference/server/middleware/auth.ts`)
   - Changed from `Auth error: ${err.message}` to generic `Authentication service error`
   - Internal details now logged to server console only

**P2 — Security/Correctness:**

4. **Certificate prefix SNAP → CPUB** (`packages/learning/src/certificate.ts`)
   - Default prefix was "SNAP" (Snaplify branding), changed to "CPUB" (CommonPub)
   - Updated test expectation

5. **SSE reconnect exponential backoff** (`apps/reference/composables/useNotifications.ts`)
   - Changed from fixed 5s retry to exponential backoff: 5s → 10s → 20s → 40s → 60s cap
   - Reset on successful connection; cleanup timer on disconnect

6. **`getUserByUsername` filtered soft-deleted users** (`packages/server/src/profile/profile.ts`)
   - Added `isNull(users.deletedAt)` to prevent viewing deleted user profiles

7. **`listContent`/`getContentBySlug` filtered soft-deleted content** (`packages/server/src/content/content.ts`)
   - Added `isNull(contentItems.deletedAt)` to both functions

8. **AP Note content HTML-escaped** (`packages/protocol/src/contentMapper.ts`)
   - `contentToNote` now escapes comment content with `escapeHtmlForAP()` before setting as AP Note content
   - Prevents plain-text comments from being interpreted as HTML by remote instances

9. **OAuth client secret timing-safe comparison** (`packages/protocol/src/oauth.ts`)
   - Replaced `!==` with `timingSafeCompare()` using constant-time XOR comparison
   - Prevents timing side-channel attacks on the token endpoint

10. **`buildCurriculumTree` O(n²) → O(n)** (`packages/learning/src/curriculum.ts`)
    - Precompute `getNextLesson()` once instead of calling `getLessonStatus()` per lesson
    - Removed unused `getLessonStatus` import

### Test results

1077 tests passed across all packages, 0 failures.
