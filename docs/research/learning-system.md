# Learning System — Prior Art Research

## Platform Survey

### Udemy

- **Structure**: Course → Section → Lecture (video/article/quiz)
- **Progress**: Per-lecture completion, overall % displayed
- **Enrollment**: One-click enroll, no prerequisites
- **Certificates**: Auto-issued on 100% completion, downloadable PDF with unique ID
- **Takeaway**: Simple flat progress model works for self-paced

### Coursera

- **Structure**: Course → Week/Module → Item (video/reading/quiz/assignment)
- **Progress**: Per-item + per-module percentages, graded vs ungraded
- **Enrollment**: Enroll → audit (free) or verified (paid)
- **Certificates**: Shareable link, verification page, tied to identity
- **Takeaway**: Module-level grouping aids navigation; quiz gates enforce learning

### freeCodeCamp

- **Structure**: Certification → Section → Challenge (code exercise)
- **Progress**: Binary per challenge, section % derived
- **Enrollment**: Implicit (start any challenge)
- **Certificates**: Auto-issued per certification, public verification URL
- **Takeaway**: Verification URLs are powerful for portfolio/resume use

### Khan Academy

- **Structure**: Course → Unit → Lesson → Exercise/Video
- **Progress**: Mastery-based (not just completion)
- **Takeaway**: Linear progression with mastery gates is engaging but complex

## Enrollment UX Patterns

1. **One-click enroll** (Udemy, fCC) — lowest friction, best for open platforms
2. **Audit vs verified** (Coursera) — adds paywall complexity
3. **Implicit enrollment** (Khan) — start = enrolled, no explicit action

**Decision**: One-click explicit enrollment. Creates a DB record (enrollment row) to track progress. Idempotent — re-enrolling returns existing enrollment.

## Progress Calculation Strategies

1. **Flat count**: `completedLessons / totalLessons * 100` — simple, predictable
2. **Weighted by duration**: Longer lessons count more — adds complexity
3. **Module-weighted**: Each module counts equally regardless of lesson count
4. **Mastery-based**: Requires minimum quiz scores — most complex

**Decision**: Flat count (strategy 1). Simple, transparent, matches user expectation. Progress stored as numeric(5,2) in enrollment row, recalculated on each lesson completion.

## Certificate Verification Approaches

1. **UUID in URL** (Coursera) — `coursera.org/verify/XXXXX`
2. **QR code on PDF** — links to verification page
3. **Blockchain** — overkill for maker communities
4. **Signed JWT** — verifiable offline but complex

**Decision**: Custom verification code format `SNAP-{base36_timestamp}-{hex_random}`. Public verification route at `/certificates/{code}` — no auth required. Displays path title, earner name, completion date.

## Key Design Decisions

- Lesson content is a discriminated union in JSONB (not separate tables per type)
- Quiz-type lessons reuse `@commonpub/explainer` quiz engine (no duplication)
- Auto-certificate at 100% progress (no manual issuance)
- Single-page editor with accordion (matches hack-build reference pattern)
- Soft delete for paths, hard delete for modules/lessons (cascade)
