# CommonPub Architecture

## System Overview

```
                         ┌─────────────────────────────┐
                         │      Nuxt 3 Reference App   │
                         │   (apps/reference)           │
                         │                              │
                         │  ┌────────┐  ┌───────────┐  │
                         │  │ Pages  │  │ Components│  │
                         │  │ (47)   │  │ (79+)     │  │
                         │  └───┬────┘  └─────┬─────┘  │
                         │      │             │        │
                         │  ┌───┴─────────────┴───┐    │
                         │  │   Composables (8)    │    │
                         │  │   useAuth, useToast  │    │
                         │  │   useBlockEditor ... │    │
                         │  └──────────┬───────────┘    │
                         │             │                │
                         │  ┌──────────┴───────────┐    │
                         │  │  Nitro Server (97     │    │
                         │  │  API routes)          │    │
                         │  └──────────┬───────────┘    │
                         └─────────────┼────────────────┘
                                       │
              ┌────────────────────────┼────────────────────────┐
              │                        │                        │
    ┌─────────┴──────────┐   ┌────────┴────────┐    ┌─────────┴──────────┐
    │  @commonpub/server │   │ @commonpub/auth │    │ @commonpub/protocol│
    │  Business Logic    │   │ Better Auth     │    │ ActivityPub        │
    │  (41 files)        │   │ SSO, Guards     │    │ WebFinger, OAuth   │
    └─────────┬──────────┘   └────────┬────────┘    └─────────┬──────────┘
              │                        │                        │
    ┌─────────┴────────────────────────┴────────────────────────┴──────────┐
    │                        @commonpub/schema                             │
    │              Drizzle Tables (20) + Zod Validators (40+)              │
    └──────────────────────────────┬───────────────────────────────────────┘
                                   │
                          ┌────────┴────────┐
                          │  PostgreSQL 16  │
                          └─────────────────┘

    ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
    │@commonpub/ui │  │@commonpub/   │  │@commonpub/   │  │@commonpub/   │
    │ 24 Vue       │  │  editor      │  │  docs        │  │  config      │
    │ components   │  │ 19 TipTap    │  │ Markdown     │  │ Feature      │
    │ + themes     │  │ extensions   │  │ rendering    │  │ flags (11)   │
    └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘

    ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
    │@commonpub/   │  │@commonpub/   │  │@commonpub/   │
    │  explainer   │  │  learning    │  │  test-utils  │
    │ Interactive  │  │ Paths,       │  │ Factories    │
    │ modules      │  │ certificates │  │ + mocks      │
    └──────────────┘  └──────────────┘  └──────────────┘
```

## Package Dependency Graph

```
schema ─────────── (no deps, foundation)
  │
  ├── config ───── (zod)
  │     │
  │     ├── auth ─────── (better-auth, schema, config)
  │     ├── protocol ─── (jose, schema, config)
  │     ├── editor ───── (tiptap, schema, config)
  │     ├── docs ─────── (remark, rehype, shiki, schema, config)
  │     ├── explainer ── (editor, schema, config)
  │     └── learning ─── (schema, config, explainer, editor)
  │
  └── server ──────────── (all packages above + sharp, dompurify)

ui ─────────────── (vue, standalone)
test-utils ─────── (schema, config)
```

## Content Lifecycle

```
                    ┌──────┐
                    │ User │
                    └──┬───┘
                       │ clicks "New" → /create
                       ▼
              ┌────────────────┐
              │  Content Type  │
              │  Selection     │
              │  (article,     │
              │   blog,        │
              │   project,     │
              │   explainer)   │
              └───────┬────────┘
                      │ → /{type}/new/edit
                      ▼
              ┌────────────────┐
              │  Block Editor  │◄─── BlockCanvas + type-specific editors
              │                │     (ArticleEditor, BlogEditor,
              │  draft status  │      ProjectEditor, ExplainerEditor)
              │                │
              │  auto-save     │───► POST/PUT /api/content
              │  Ctrl+S save   │
              └───────┬────────┘
                      │ "Publish" button
                      ▼
              ┌────────────────┐
              │  POST          │
              │  /api/content/ │
              │  {id}/publish  │
              └───────┬────────┘
                      │
          ┌───────────┼───────────┐
          │           │           │
          ▼           ▼           ▼
   ┌──────────┐ ┌──────────┐ ┌──────────┐
   │ Version  │ │ Search   │ │ AP       │
   │ created  │ │ indexed  │ │ federated│
   └──────────┘ └──────────┘ └──────────┘
```

## Authentication Flow

```
  ┌──────────────┐     ┌──────────────┐
  │  /auth/login │     │/auth/register│
  └──────┬───────┘     └──────┬───────┘
         │                     │
         ▼                     ▼
  POST /api/auth/       POST /api/auth/
  sign-in/email         sign-up/email
         │                     │
         └─────────┬───────────┘
                   │
                   ▼
          ┌────────────────┐
          │  Better Auth   │
          │  Middleware     │
          │  (server/      │
          │   middleware/   │
          │   auth.ts)     │
          └───────┬────────┘
                  │
         ┌────────┼────────┐
         │        │        │
         ▼        ▼        ▼
    Session   Cookie    event.context
    stored    set       .auth populated
    in DB               for all routes
```

## Hub Membership Flow

```
  ┌──────┐
  │ User │
  └──┬───┘
     │ visits /hubs/{slug}
     ▼
  ┌──────────────┐    joinPolicy?
  │  Hub Page    │──────────────────┐
  └──────┬───────┘                  │
         │ "Join" click             │
         ▼                          │
  ┌──────────────┐          ┌───────┴──────┐
  │ POST         │          │              │
  │ /api/hubs/   │          │   "open"     │──► member immediately
  │ {slug}/join  │          │              │
  └──────┬───────┘          │  "approval"  │──► pending → mod approves
         │                  │              │
         │                  │  "invite"    │──► must have invite code
         │                  └──────────────┘
         ▼
  ┌──────────────┐
  │  Member      │
  │  Roles:      │
  │  member      │──► post, comment, vote
  │  moderator   │──► + ban, pin, lock
  │  admin       │──► + settings, delete
  │  owner       │──► full control
  └──────────────┘
```

## Learning Path Flow

```
  ┌──────────────┐
  │ Learning     │ /learn
  │ Path Index   │
  └──────┬───────┘
         │ select path
         ▼
  ┌──────────────┐
  │ Path Detail  │ /learn/{slug}
  │              │
  │ Modules →    │
  │   Lessons    │
  └──────┬───────┘
         │ "Enroll"
         ▼
  ┌──────────────┐
  │ Enrollment   │ POST /api/learn/{slug}/enroll
  │ created      │
  └──────┬───────┘
         │ navigate lessons
         ▼
  ┌──────────────┐
  │ Lesson View  │ /learn/{slug}/{lessonSlug}
  │              │
  │ Content +    │
  │ optional     │
  │ quiz         │
  └──────┬───────┘
         │ complete
         ▼
  ┌──────────────┐
  │ POST /.../   │
  │ complete     │
  │              │
  │ Updates      │
  │ progress %   │
  └──────┬───────┘
         │ all lessons done?
         ▼
  ┌──────────────┐
  │ Certificate  │
  │ generated    │
  │ with verify  │
  │ code         │
  └──────────────┘
```

## Page Map

```
/                          Home (tabbed feed, sidebar)
/about                     About page
/explore                   Platform explorer (4 tabs)
/feed                      Recent content feed
/search                    Full-text search + filters

/auth/login                Login
/auth/register             Register
/auth/forgot-password      Password reset request
/auth/reset-password       Password reset
/auth/verify-email         Email verification

/create                    Content type selector
/[type]                    Content listing by type
/[type]/[slug]             Content view (article/blog/project/explainer)
/[type]/[slug]/edit        Block editor

/dashboard                 User dashboard (content/bookmarks/learning)
/u/[username]              User profile (5 tabs)
/settings                  Settings shell
/settings/profile          Profile editor
/settings/account          Password change, account deletion
/settings/notifications    Notification preferences
/settings/appearance       Theme switcher

/hubs                      Hub listing
/hubs/create               Create hub
/hubs/[slug]               Hub detail (feed/discussions/members/etc)
/hubs/[slug]/members       Member list
/hubs/[slug]/settings      Hub settings (owner/admin)

/learn                     Learning path index
/learn/create              Create learning path
/learn/[slug]              Path detail
/learn/[slug]/edit         Path editor
/learn/[slug]/[lessonSlug] Lesson view

/docs                      Documentation sites index
/docs/[siteSlug]           Docs site with navigation
/docs/[siteSlug]/edit      Docs page/version editor
/docs/[siteSlug]/[...path] Docs page view

/videos                    Video hub
/videos/[id]               Video player

/contests                  Contest listing
/contests/[slug]           Contest detail
/contests/[slug]/judge     Judging interface

/messages                  Conversation list
/messages/[id]             Message thread

/notifications             Notification feed

/tags/[slug]               Tag-filtered content

/admin                     Admin dashboard
/admin/users               User management
/admin/reports             Abuse reports
/admin/audit               Audit log
/admin/settings            Instance settings
/admin/content             Content moderation
```

## API Route Map (97 routes)

| Domain | Routes | Description |
|--------|--------|-------------|
| Content | 13 | CRUD, publish, versions, reports, product links |
| Products | 5 | CRUD, content associations |
| Social | 7 | Likes, comments, bookmarks |
| Hubs | 15 | CRUD, members, posts, replies, bans, invites |
| Learning | 15 | Paths, modules, lessons, enrollment, certificates |
| Docs | 11 | Sites, pages, versions, navigation, search |
| Videos | 7 | CRUD, categories, view tracking |
| Messages | 5 | Conversations, messages, SSE stream |
| Users | 8 | Profiles, follow, followers, feed |
| Search | 2 | Full-text search, trending |
| Admin | 11 | Users, reports, audit, settings, content |
| Notifications | 5 | List, count, read, delete, SSE stream |
| System | 3 | Health, OpenAPI, profile update |
