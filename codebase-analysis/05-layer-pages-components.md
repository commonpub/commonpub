# 05 — Layer: Pages, Components, Composables, Middleware

`layers/base/` — published as `@commonpub/layer`. The distribution unit.
Instances extend it via `extends: ['@commonpub/layer']` in their nuxt.config.

**85 pages, 106 components, 20 composables, 6 server plugins, 7 request middlewares, 257 API routes.**

As of session 125.

## Directory layout (depth 3)

```
layers/base/
├── app.vue                    root with NuxtLayout / NuxtPage / skip-link
├── error.vue                  404 / error page — re-applies data-theme for SSR
├── nuxt.config.ts             modules, CSS bundle, runtime config, features
├── components/                117 Vue components (grouped below)
├── composables/               20 useX helpers
├── layouts/                   default, admin, auth, editor
├── middleware/                auth.ts + feature-gate.global.ts
├── pages/                     75 routes (Nuxt file-based)
├── plugins/                   theme.ts + auth.ts (client)
├── server/
│   ├── api/                   257 Nitro routes (REST)
│   ├── routes/                ActivityPub federation routes
│   ├── middleware/            auth, theme, features, security, content-ap, content-redirect, blog-redirect
│   ├── plugins/               auto-admin, federation-delivery, federation-hub-sync, migrate-article-to-blog, notification-email, search-index
│   └── utils/                 config, db, session, hooks wiring
├── theme/                     CSS tokens + component/prose/forms/layouts/editor-panels CSS
├── types/                     hub.ts + meilisearch.d.ts
└── utils/                     themeConfig.ts
```

## Pages (75)

Grouped by section.

### Public

| Route | Purpose |
|---|---|
| `/` | Homepage (configurable sections from instanceSettings) |
| `/about`, `/privacy`, `/terms`, `/cookies` | Static |
| `/explore` | Curated browse |
| `/search` | Full-text across local + federated |
| `/feed` | User activity feed (authed) |
| `/dashboard` | Authed user's dashboard — drafts, published, bookmarks, learning enrollments |
| `/notifications` | Inbox |
| `/tags`, `/tags/:slug` | Tag directory + filtered |
| `/[type]` | Browse by content type |

### Auth

`/auth/login`, `/auth/register`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/verify-email`, `/auth/oauth/authorize`.

### User profile

`/u/:username`, `/u/:username/followers`, `/u/:username/following`, `/u/:username/:type/:slug`, `/u/:username/:type/:slug/edit`.

URL restructure landed in session 108: canonical content lives at `/u/{username}/{type}/{slug}`.

### Hubs

`/hubs`, `/hubs/create`, `/hubs/:slug`, `/hubs/:slug/members`, `/hubs/:slug/settings`, `/hubs/:slug/posts/:postId`.

### Contests

`/contests`, `/contests/create`, `/contests/:slug`, `/contests/:slug/edit`, `/contests/:slug/judge`, `/contests/:slug/results`.

### Events (session 124)

`/events`, `/events/create`, `/events/:slug`, `/events/:slug/edit`.

### Learning

`/learn`, `/learn/create`, `/learn/:slug`, `/learn/:slug/edit`, `/learn/:slug/:lessonSlug`, `/learn/:slug/:lessonSlug/edit`.

### Docs sites

`/docs`, `/docs/create`, `/docs/:siteSlug`, `/docs/:siteSlug/:...pagePath`, `/docs/:siteSlug/edit`.

### Videos / products

`/videos`, `/videos/:id`, `/videos/submit`, `/products`, `/products/:slug`.

### Federated

`/federation`, `/federation/search`, `/federation/users/:handle`, `/federated-hubs/:id`, `/federated-hubs/:id/posts/:postId`.

### Messages

`/messages`, `/messages/:conversationId`.

### Settings

`/settings` (redirect), `/settings/profile`, `/settings/account`, `/settings/appearance`, `/settings/notifications`.

### Admin (flag: `admin`)

`/admin`, `/admin/users`, `/admin/content`, `/admin/categories`, `/admin/reports`, `/admin/audit`, `/admin/theme`, `/admin/homepage`, **`/admin/navigation` (session 124)**, `/admin/features`, `/admin/federation`, `/admin/settings`.

### Misc

`/authorize_interaction`, `/cert/:code`, `/mirror/:id`.

## Components (117) — grouped

### Block renderers (`components/blocks/`, ~20)

BlockBuildStepView, BlockCalloutView, BlockCheckpointView, BlockCodeView, BlockContentRenderer (dispatcher), BlockDividerView, BlockDownloadsView, BlockEmbedView, BlockGalleryView, BlockHeadingView, BlockImageView, BlockMarkdownView, BlockMathView, BlockPartsListView, BlockQuizView, BlockQuoteView, BlockSectionHeaderView, BlockSliderView, BlockTextView, BlockToolListView, BlockVideoView.

### Content editors (`components/editors/`, 4)

ArticleEditor, BlogEditor, ExplainerEditor, ProjectEditor.

### Content views (`components/views/`, 3)

ArticleView, ExplainerView, ProjectView.

### Contest (7)

ContestEntries, ContestHero, **ContestJudgeManager** (session 124), ContestJudges, ContestPrizes, ContestRules, ContestSidebar.

### Events (session 124)

EventCard, EventCalendar.

### Hubs (8)

HubDiscussions, HubFeed, HubHero, HubLayout (tabs), HubMembers, HubProducts, HubProjects, HubResources, HubSidebar, HubSidebarCard.

### Homepage sections (8)

ContentGridSection, ContestsSection, CustomHtmlSection, EditorialSection, HeroSection, HomepageSectionRenderer (dispatcher), HubsSection, StatsSection.

### Navigation (session 124)

**NavRenderer**, **NavDropdown**, **MobileNavRenderer**, **NavLink**.

### Voting / polls (session 124–125)

**PostVoteButtons**, **PollDisplay**.

### Utilities / widgets

AnnouncementBand, AppToast, AuthorCard, AuthorRow, CategoryBadge, CommentSection, ContentAttachments, ContentCard, ContentPicker, ContentStarterForm, ContentTypeBadge, CookieConsent, CountdownTimer, CpubEditor, DiscussionItem, EditorialBadge, EngagementBar, FederatedContentCard, FeedItem, FilterChip, ImageUpload (events cover image integration in session 125), ImportUrlModal, MarkdownImportDialog, MemberCard, MentionText, MessageThread, NotificationItem, ProgressTracker, PublishErrorsModal, RemoteActorCard, RemoteFollowDialog, RemoteUserSearch, SearchFilters, SearchSidebar, SectionHeader, ShareToHubModal, SiteLogo (OVERRIDE POINT), SkillBar, SortSelect, StatBar, TOCNav, TimelineItem, VideoCard.

### Docs

DocsPageTree.

## Composables (20)

| Name | Purpose |
|---|---|
| useAuth | session state (user, isAuthenticated, isAdmin), sign-in/out |
| useFeatures | reactive feature flags, hydrated from /api/features |
| useTheme | data-theme / isDark / setDarkMode |
| useToast | notification system |
| useCookieConsent | GDPR consent state |
| useContentSave | autosave + publish workflow |
| useContentTypes | enabled content types |
| useContentUrl | URL builders for content pages |
| usePublishValidation | pre-publish validation |
| useMarkdownImport | md → BlockTuple |
| useApiError | HTTP error parsing |
| useMessages | DMs + unread count + SSE |
| useNotifications | notification inbox + SSE |
| useRealtimeCounts | per-target live counters |
| useSiteName | from runtime config |
| useJsonLd | schema.org structured data |
| useFederation | AP resolve + search |
| useMirrorContent | federated content handlers |
| useSanitize | DOMPurify wrapper |
| useEngagement | like/bookmark state |

## Middleware

### Client-side route guards (2)

- **auth.ts** — `definePageMeta({ middleware: 'auth' })` redirects to `/auth/login?redirect=...`
- **feature-gate.global.ts** — global middleware that throws 404 if route's feature is disabled. Path mapping: `/learn → learning`, `/docs → docs`, `/videos → video`, `/admin → admin`, `/contests → contests`, `/events → events`, `/explainer → explainers`.

### Server-side request middleware (7)

- `auth.ts` — enrich `event.context` with Better Auth session/user
- `theme.ts` — resolve instance theme + user dark-mode pref → `event.context.resolvedTheme`
- `features.ts` — populate feature flags (build-time + DB overrides)
- `security.ts` — CSP, HSTS, X-Frame-Options, etc.
- `content-ap.ts` — Accept: application/activity+json content negotiation
- `content-redirect.ts` — legacy content URL redirects
- `blog-redirect.ts` — article↔blog legacy redirects

### Server plugins (6)

- `auto-admin.ts` — promote first registered user to admin
- `federation-delivery.ts` — start outbound delivery worker
- `federation-hub-sync.ts` — periodic hub mirror sync
- `migrate-article-to-blog.ts` — one-time content type normalization
- `notification-email.ts` — register email sender callback with `@commonpub/server/notification`
- `search-index.ts` — subscribe to content hooks → index in Meilisearch

## Theme & CSS

Bundled CSS loaded by the layer's nuxt.config:

```
theme/
├── base.css             :root tokens (colors, fonts, spacing, shadows, radii)
├── dark.css             [data-theme="dark"]
├── generics.css         alt theme family
├── agora.css            editorial theme
├── agora-dark.css       agora dark variant
├── components.css       .cpub-* component styles
├── prose.css            rich text / BlockTuple output
├── layouts.css          layout utilities
├── forms.css            form defaults
└── editor-panels.css    TipTap UI panels
```

Plus presets from `@commonpub/explainer/vue/theme/`: dark-industrial, punk-zine, paper-teal, clean-light.

Fonts pulled from Google Fonts (Fraunces serif, Work Sans sans) + Font Awesome 6.5.1 CDN.

### Consumer override

Consumer apps add `assets/theme.css` with `:root { --accent: #ff0000; ... }`. Consumer CSS loads AFTER the layer's, so it wins.

Key overridable tokens:

- `--border-width-default` (2px default, e.g. 1px for deveco)
- `--radius` (0px default)
- `--shadow-sm/md/lg`
- `--accent` (#5b9cf6 default)
- `--font-sans`, `--font-display`

## SSR theme plumbing

1. Server middleware `theme.ts` reads instance theme (from instanceSettings) and user dark-mode cookie → `event.context.resolvedTheme = 'base' | 'dark' | 'agora' | ...`.
2. Server plugins write `event.context.instanceTheme` + `isDarkMode` + `resolvedTheme` for client hydration.
3. Client plugin `plugins/theme.ts` reads context and calls `useHead({ htmlAttrs: { 'data-theme': themeId } })` → `<html data-theme="...">` rendered on server. Zero FOUC.
4. `useTheme().setDarkMode(bool)` mutates cookie + re-applies `data-theme`.

`error.vue` re-applies the same useHead call because error pages render outside the layout tree on SSR.

## Nuxt config highlights

- `compatibilityDate: '2024-11-01'`
- `nitro.preset: 'node-server'`
- Route rule: `/docs/**` prerendered if docs feature on
- Runtime config:
  - **private**: databaseUrl, authSecret, smtp/resend creds, S3 keys, uploadDir
  - **public**: siteUrl, domain, siteName, features (all 15 flags), contentTypes, contestCreation, instanceCookies
- CSS array loads the whole `theme/` bundle + explainer presets

## Recent additions (sessions 124–125) confirmed present

✔ Nav system: NavRenderer + NavDropdown + MobileNavRenderer + NavLink
✔ Admin nav page `/admin/navigation` + API
✔ Events pages, EventCard, EventCalendar
✔ Events API with pagination + status whitelist + filters
✔ PostVoteButtons + hub post voting API
✔ PollDisplay + poll voting API
✔ ContestJudgeManager + judges API
✔ `error.vue` SSR theme re-apply via useHead
✔ ImageUpload wired into event cover images (create/edit)
✔ Contest entry heart-vote UI with optimistic updates (session 125)
✔ Batch `/api/contests/:slug/votes` endpoint

## Known mobile gap

~70 components lack `@media` breakpoints. Mobile polish is low-priority outstanding.
