# Routing Reference

> All routes in the Nuxt 3 reference app. Routes use Nuxt file-based routing (`pages/` for views, `server/api/` for API endpoints, `server/routes/` for non-API endpoints).

---

## Pages (61 total)

### Public

| Route | Description |
|-------|-------------|
| `/` | Homepage — featured content, feed, trending hubs |
| `/explore` | Discover content, hubs, learning paths, people |
| `/search` | Full-text search with filters, pagination |
| `/u/[username]/[type]/[slug]` | Content view (article, blog, project, explainer) |
| `/[type]` | Content listing by type |
| `/[type]/[slug]` | Legacy redirect → `/u/{author}/{type}/{slug}` (301) |
| `/u/[username]` | User profile — projects, articles, about |
| `/hubs` | Hub directory |
| `/hubs/[slug]` | Hub detail — feed, gallery, members, products |
| `/hubs/[slug]/members` | Hub member list |
| `/learn` | Learning path directory |
| `/learn/[slug]` | Learning path detail — modules, enrollment |
| `/learn/[slug]/[lessonSlug]` | Lesson viewer |
| `/contests` | Contest directory |
| `/contests/[slug]` | Contest detail — entries, countdown, rules |
| `/videos` | Video hub — grid, categories, featured |
| `/videos/[id]` | Video detail |
| `/docs` | Documentation sites directory |
| `/docs/[siteSlug]` | Documentation site |
| `/docs/[siteSlug]/[...pagePath]` | Documentation page |
| `/tags` | Tag index |
| `/tags/[slug]` | Content by tag |
| `/products` | Product catalog |
| `/products/[slug]` | Product detail |
| `/cert/[code]` | Certificate verification |
| `/about` | About page |
| `/feed` | RSS feed viewer |

### Auth

| Route | Description |
|-------|-------------|
| `/auth/login` | Login (supports `?redirect=` param) |
| `/auth/register` | Registration (shows email verification message) |
| `/auth/forgot-password` | Password reset request |
| `/auth/reset-password` | Password reset form |
| `/auth/verify-email` | Email verification |

### Authenticated

| Route | Description | Auth |
|-------|-------------|------|
| `/dashboard` | User dashboard — content, bookmarks, learning | Yes |
| `/create` | Content type selector → editor | Yes |
| `/u/[username]/[type]/[slug]/edit` | Content editor (article, blog, project, explainer) | Yes (author) |
| `/[type]/[slug]/edit` | Legacy redirect → `/u/{author}/{type}/{slug}/edit` (301) | Yes |
| `/u/[username]/followers` | Follower list | No |
| `/u/[username]/following` | Following list | No |
| `/hubs/create` | Create new hub | Yes |
| `/hubs/[slug]/settings` | Hub settings (name, description, rules, privacy) | Yes (owner/admin) |
| `/learn/create` | Create learning path | Yes |
| `/learn/[slug]/edit` | Edit learning path modules/lessons | Yes (author) |
| `/learn/[slug]/[lessonSlug]/edit` | Edit lesson | Yes (author) |
| `/docs/create` | Create docs site | Yes |
| `/docs/[siteSlug]/edit` | Edit documentation site | Yes (owner) |
| `/contests/create` | Create contest | Yes |
| `/contests/[slug]/edit` | Edit contest | Yes (author) |
| `/contests/[slug]/judge` | Contest judging interface | Yes (judge) |
| `/videos/submit` | Submit video | Yes |
| `/messages` | Conversations list | Yes |
| `/messages/[conversationId]` | Conversation thread | Yes |
| `/notifications` | Notification list | Yes |
| `/settings` | User settings hub | Yes |
| `/settings/profile` | Edit profile | Yes |
| `/settings/account` | Account settings | Yes |
| `/settings/appearance` | Theme/appearance | Yes |
| `/settings/notifications` | Notification preferences | Yes |

### Admin

| Route | Description |
|-------|-------------|
| `/admin` | Platform stats |
| `/admin/users` | User management |
| `/admin/content` | Content moderation |
| `/admin/reports` | Report moderation |
| `/admin/audit` | Audit logs |
| `/admin/settings` | Instance settings |

---

## API Endpoints (142)

### Content

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/content` | List content (filterable by type, status, author) |
| POST | `/api/content` | Create content |
| GET | `/api/content/:id` | Get content by ID |
| PUT | `/api/content/:id` | Update content |
| DELETE | `/api/content/:id` | Delete content |
| POST | `/api/content/:id/publish` | Publish content |
| POST | `/api/content/:id/view` | Record view |
| POST | `/api/content/:id/report` | Report content |
| GET | `/api/content/:id/versions` | Version history |
| GET | `/api/content/:id/products` | Content BOM (products) |
| POST | `/api/content/:id/products` | Add product to BOM |
| POST | `/api/content/:id/products-sync` | Bulk sync BOM |
| DELETE | `/api/content/:id/products/:productId` | Remove product from BOM |

### Hubs

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/hubs` | List hubs |
| POST | `/api/hubs` | Create hub |
| GET | `/api/hubs/:slug` | Get hub detail |
| PUT | `/api/hubs/:slug` | Update hub |
| DELETE | `/api/hubs/:slug` | Delete hub |
| POST | `/api/hubs/:slug/join` | Join hub |
| POST | `/api/hubs/:slug/leave` | Leave hub |
| GET | `/api/hubs/:slug/members` | List members |
| PUT | `/api/hubs/:slug/members/:userId` | Change member role |
| DELETE | `/api/hubs/:slug/members/:userId` | Kick member |
| GET | `/api/hubs/:slug/posts` | List posts |
| POST | `/api/hubs/:slug/posts` | Create post |
| DELETE | `/api/hubs/:slug/posts/:postId` | Delete post |
| GET | `/api/hubs/:slug/posts/:postId/replies` | List replies |
| POST | `/api/hubs/:slug/posts/:postId/replies` | Create reply |
| GET | `/api/hubs/:slug/gallery` | Hub content gallery |
| GET | `/api/hubs/:slug/products` | Hub products |
| POST | `/api/hubs/:slug/products` | Add product to hub |
| POST | `/api/hubs/:slug/share` | Share content to hub |
| GET | `/api/hubs/:slug/bans` | List bans |
| POST | `/api/hubs/:slug/bans` | Ban user |
| DELETE | `/api/hubs/:slug/bans/:userId` | Unban user |
| GET | `/api/hubs/:slug/invites` | List invites |
| POST | `/api/hubs/:slug/invites` | Create invite |
| GET | `/api/hubs/:slug/feed.xml` | Hub RSS feed |

### Users & Profile

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/profile` | Current user's profile |
| PUT | `/api/profile` | Update own profile |
| GET | `/api/users/:username` | User public profile |
| GET | `/api/users/:username/content` | User's published content |
| POST | `/api/users/:username/follow` | Follow user |
| DELETE | `/api/users/:username/follow` | Unfollow user |
| GET | `/api/users/:username/followers` | Follower list |
| GET | `/api/users/:username/following` | Following list |
| GET | `/api/users/:username/feed.xml` | User RSS feed |

### Social

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/social/like` | Toggle like |
| GET | `/api/social/like` | Check like status |
| GET | `/api/social/comments` | List comments |
| POST | `/api/social/comments` | Create comment |
| DELETE | `/api/social/comments/:id` | Delete comment |
| POST | `/api/social/bookmark` | Toggle bookmark |
| GET | `/api/social/bookmarks` | List bookmarks |

### Products

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/products` | Search/browse catalog |
| GET | `/api/products/:slug` | Product detail |
| PUT | `/api/products/:id` | Update product |
| DELETE | `/api/products/:id` | Delete product |
| GET | `/api/products/:slug/content` | Projects using product |

### Learning

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/learn` | List learning paths |
| POST | `/api/learn` | Create path |
| GET | `/api/learn/:slug` | Path detail |
| PUT | `/api/learn/:slug` | Update path |
| DELETE | `/api/learn/:slug` | Delete path |
| POST | `/api/learn/:slug/publish` | Publish path |
| POST | `/api/learn/:slug/enroll` | Enroll in path |
| POST | `/api/learn/:slug/unenroll` | Unenroll |
| POST | `/api/learn/:slug/modules` | Add module |
| PUT | `/api/learn/:slug/modules/:moduleId` | Update module |
| POST | `/api/learn/:slug/lessons` | Add lesson |
| GET | `/api/learn/:slug/:lessonSlug` | Get lesson |
| POST | `/api/learn/:slug/:lessonSlug/complete` | Mark lesson complete |
| GET | `/api/learn/enrollments` | User's enrollments |
| GET | `/api/learn/certificates` | User's certificates |

### Other

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/search` | Global search |
| GET | `/api/search/trending` | Trending searches |
| GET | `/api/stats` | Platform statistics |
| POST | `/api/files/upload` | Upload file |
| GET | `/api/files/mine` | User's files |
| DELETE | `/api/files/:id` | Delete file |
| GET | `/api/videos` | List videos |
| POST | `/api/videos` | Create video |
| GET | `/api/videos/:id` | Video detail |
| GET | `/api/videos/categories` | Video categories |
| GET | `/api/contests` | List contests |
| POST | `/api/contests` | Create contest |
| GET | `/api/contests/:slug` | Contest detail |
| PUT | `/api/contests/:slug` | Update contest |
| DELETE | `/api/contests/:slug` | Delete contest |
| GET | `/api/contests/:slug/entries` | List entries |
| POST | `/api/contests/:slug/entries` | Submit entry |
| POST | `/api/contests/:slug/judge` | Score entry |
| POST | `/api/contests/:slug/transition` | Transition status |
| GET | `/api/messages` | List conversations |
| POST | `/api/messages` | Start conversation |
| GET | `/api/messages/:id` | Get messages |
| POST | `/api/messages/:id` | Send message |
| GET | `/api/notifications` | List notifications |
| GET | `/api/notifications/count` | Unread count |
| POST | `/api/notifications/read` | Mark as read |
| DELETE | `/api/notifications/:id` | Delete notification |
| GET | `/api/notifications/stream` | SSE notification stream |
| GET | `/api/health` | Health check |

### Docs

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/docs` | List doc sites |
| POST | `/api/docs` | Create doc site |
| GET | `/api/docs/:siteSlug` | Doc site detail |
| PUT | `/api/docs/:siteSlug` | Update doc site |
| DELETE | `/api/docs/:siteSlug` | Delete doc site |
| GET | `/api/docs/:siteSlug/pages` | List pages |
| POST | `/api/docs/:siteSlug/pages` | Create page |
| PUT | `/api/docs/:siteSlug/pages/:pageId` | Update page |
| GET | `/api/docs/:siteSlug/nav` | Navigation tree |
| GET | `/api/docs/:siteSlug/search` | Search docs |
| POST | `/api/docs/:siteSlug/versions` | Create version |

### Admin

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/admin/stats` | Platform statistics |
| GET | `/api/admin/users` | List all users |
| PUT | `/api/admin/users/:id/role` | Change user role |
| PUT | `/api/admin/users/:id/status` | Change user status |
| DELETE | `/api/admin/users/:id` | Delete user |
| DELETE | `/api/admin/content/:id` | Delete content (admin) |
| GET | `/api/admin/reports` | List reports |
| POST | `/api/admin/reports/:id/resolve` | Resolve report |
| GET | `/api/admin/audit` | Audit log |
| GET | `/api/admin/settings` | Instance settings |
| PUT | `/api/admin/settings` | Update instance settings |

---

## Federation Endpoints

| Endpoint | Method | Content-Type | Purpose |
|----------|--------|-------------|---------|
| `/.well-known/webfinger` | GET | `application/jrd+json` | WebFinger discovery |
| `/.well-known/nodeinfo` | GET | `application/json` | NodeInfo discovery |
| `/nodeinfo/2.1` | GET | `application/json` | NodeInfo 2.1 document |
| `/users/:username` | GET | `application/activity+json` | Actor profile |
| `/users/:username/followers` | GET | `application/activity+json` | Followers collection |
| `/users/:username/following` | GET | `application/activity+json` | Following collection |
| `/users/:username/outbox` | GET | `application/activity+json` | Outbox (paginated) |
| `/users/:username/inbox` | POST | `application/activity+json` | Per-user inbox |
| `/inbox` | POST | `application/activity+json` | Shared inbox |

## Other Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/feed.xml` | GET | Site-wide RSS feed |
| `/sitemap.xml` | GET | XML sitemap |
| `/robots.txt` | GET | Robots.txt |
