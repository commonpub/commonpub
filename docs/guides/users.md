# CommonPub — Users Guide

_For people running an instance, moderating one, or using the features._
_No code required. For developer setup see [developers.md](./developers.md)._

**Contents**
- [What CommonPub is](#what-commonpub-is)
- [Key concepts](#key-concepts)
- [Getting started as a member](#getting-started-as-a-member)
- [Publishing content](#publishing-content)
- [Hubs — communities, product pages, company spaces](#hubs)
- [Contests](#contests)
- [Events](#events)
- [Learning paths + certificates](#learning-paths)
- [Docs sites](#docs-sites)
- [Explainers](#explainers)
- [Videos](#videos)
- [Federation in plain language](#federation-in-plain-language)
- [Settings you'll actually use](#settings)
- [Running an instance as an admin](#admin-tasks)
- [Getting help](#getting-help)

---

## What CommonPub is

CommonPub is the software behind small-to-mid sized communities that want to
own their home on the web. A single instance looks like a cross between a
forum, a publishing platform, and a learning site:

- People can publish long-form **articles, projects, and explainers** — not
  just status updates.
- Communities are organized into **hubs** with their own members, posts,
  resources, and products.
- You can run **contests** with judges and community voting, and **events**
  with RSVP and waitlists.
- You can build **learning paths** and issue **verifiable certificates** when
  someone completes one.
- You can host **docs sites** with versioned documentation.
- All of the above can **federate** — your instance talks to others using the
  same protocol that powers Mastodon (ActivityPub). Users on other instances
  can follow your content. CommonPub instances share full fidelity; other
  fediverse servers see a simplified, still-readable version.

CommonPub is open source (AGPL-3.0) and self-hosted. You own your data.

## Key concepts

| Term | What it means |
|---|---|
| **Instance** | A single deployment. `commonpub.io` is one; `deveco.io` is another. |
| **User** | Someone with an account on your instance. |
| **Content** | Anything you publish: an article, a project with a bill of materials, an explainer, a blog post. |
| **Hub** | A space for a group of people — a community, a product page, or a company space. Has members, a feed, and shared resources. |
| **Contest** | A time-bounded submission event with judges, entries, and optionally community voting. |
| **Event** | Something happening at a time — in-person, online, or hybrid. Supports RSVP and waitlisting. |
| **Learning path** | A structured course — modules → lessons. Completing it earns a certificate. |
| **Docs site** | A versioned documentation site within your instance. |
| **Federation** | Your instance talking to other servers so content can flow across the fediverse. |
| **Admin** | Role that controls instance-level settings and moderation. |

## Getting started as a member

1. **Register** — click "Sign up", enter email/username/password. If your
   instance has email verification enabled, check your inbox.
2. **Set up your profile** — visit `/settings/profile`. Add a display name,
   bio, avatar, and any social links you want to show.
3. **Pick a theme** — `/settings/appearance`. Switch between light and dark
   mode; some instances offer multiple theme families.
4. **Find things to follow** — explore `/hubs`, `/explore`, and `/search`.
5. **Publish your first thing** — click "Create" from the nav. Pick a content
   type. Write. Save as draft. Publish when ready.

## Publishing content

Content types your instance might have enabled:

- **Project** — build logs, bill of materials, step-by-step instructions, cover image.
- **Blog** — long-form post with a cover image.
- **Explainer** — interactive content with scroll-driven sections, quizzes, and progress gating.

The editor uses **blocks**: paragraphs, headings, code, images, galleries,
videos, callouts, quotes, parts lists, build steps, tool lists, downloads,
quizzes, dividers. Drag to rearrange. Each block type is designed for maker
content.

### Drafts and publishing

- New content starts as a **draft**. Visible only to you.
- **Autosave** runs as you type.
- **Publish** makes the content public (or members-only, depending on your
  visibility setting).
- **Archive** hides it from feeds without deleting.
- **Delete** soft-deletes (recoverable by an admin).

### Bill of materials (for projects)

Projects can list **parts**. When those parts match products in the instance
catalog, your project automatically appears on the product page. If the
instance federates products, this linking works across instances too.

### Forking

Any published content can be forked. Fork count shows up on the original.
Forks are independent; they don't auto-sync back.

### "I built this"

Readers can click **"I built this"** on a project. It adds to the build
count, notifies the author, and shows up in the reader's profile activity.

## Hubs

A hub is a named space with members and a feed. Three types:

- **Community** — general-interest group.
- **Product** — centered on a product (often linked to the product catalog).
- **Company** — organization space.

Every hub has:
- A **feed** of posts, pinned items, discussions, polls, links, announcements.
- **Members** with roles: owner > admin > moderator > member.
- **Resources** — curated links, docs, tools the hub wants to showcase.
- Optionally **products** and **shared content** from members.

### Joining

- **Open** — click Join. You're in.
- **Approval** — click Join; an admin approves.
- **Invite only** — you need an invite link.

### Posting

Members can post. Post types:
- Text, link, share (content from the platform), **poll**, discussion,
  question, showcase, announcement.

### Voting on posts

Hub posts support up/down votes (session 124+). Click the up or down arrow.
The post's **score** is `up − down`. Click the same arrow again to remove
your vote. Click the opposite to flip.

### Polls

Any post can be a poll. Polls have options; one vote per user per poll (not
per option). Results show as percentages after you vote.

### Threaded replies

Replies are threaded. Reply to a reply to nest.

### Moderation

Moderators can: pin posts, lock posts (no new replies), and issue temporary
bans. Admins can do everything, including permanent bans and role changes.

## Contests

Contests run in 5 phases:

1. **Upcoming** — announced, not yet accepting entries.
2. **Active** — accepting entries. Community voting can be on or off.
3. **Judging** — entries closed, judges scoring.
4. **Completed** — ranks calculated; winners announced.
5. **Cancelled** — contest was cancelled.

### Entering

- Click "Submit entry" on a contest in the Active phase.
- Pick one of your published content items as the entry.
- Withdraw anytime before Judging.

### Judges

Contests can have **judges** with roles:
- **Lead** — organizes the judging.
- **Judge** — scores entries.
- **Guest** — observer.

Judges are invited; they must accept. Until they accept, they don't see
private judging data.

**Judging visibility** controls who can see the judging interface:
- **Public** — anyone can see scores.
- **Judges-only** — visible to judges during judging, public on completion.
- **Private** — judges only, ever.

### Community voting

If the contest creator enables it, any user can vote on entries — one vote
per user per entry (heart click). Contest ranks combine judge scores and
community votes.

### Prizes

Prizes are displayed on the contest page. Award is manual (not automated).

## Events

Events are single occurrences with a start and end date. Three types:

- **In-person** — has a physical location.
- **Online** — has an online URL (Zoom, Meet, whatever).
- **Hybrid** — both.

### RSVP

- Click **RSVP** on an event page to register.
- If the event has capacity limits and is full, you're **waitlisted** instead.
- If someone registered cancels, the oldest waitlisted person gets
  auto-promoted and notified.
- You can cancel your RSVP any time.

### Event statuses

- **Draft** — organizer is still setting it up.
- **Published** — visible, not yet started.
- **Active** — happening now.
- **Completed** — finished.
- **Cancelled** — cancelled.

### Filters on the listing

- Upcoming, Featured, All, Past, My events (RSVPed or created by me).
- 12 events per page with pagination.

### Hub-scoped events

An event can optionally belong to a hub. Hub members see those events
prominently.

## Learning paths

A **path** is a course. Structure: path → modules → lessons.

- **Lessons** can be: article, video, quiz, project, or explainer.
- **Progress**: percentage of lessons completed.
- **Certificate**: issued automatically when you complete 100%. Has a public
  **verification code** (format `CPUB-xxx-xxx`). Anyone can check its
  authenticity at `/cert/<code>`.

### Enrolling

Click **Enroll** on a path. Your progress is tracked automatically. You can
unenroll at any time — progress is reset if you re-enroll.

### Quizzes and gating

Some lessons are quizzes. Some paths are configured so you can't advance to
the next lesson until you pass the quiz. Explainer lessons can also gate —
you must complete earlier sections before accessing later ones.

## Docs sites

Docs sites are versioned, hierarchical documentation collections. Each site
has:

- A slug (URL path).
- One or more **versions** (e.g. `1.0`, `2.0`).
- A tree of **pages** (hierarchical, drag to reorder).
- **Search** across pages.

Pages use the same block editor as content. Legacy markdown pages still
render; they convert to blocks on edit.

## Explainers

Explainers are a content type — scroll-driven interactive pieces. Sections
can include:

- Text blocks.
- Interactive controls (sliders, toggles) that drive animations or demos.
- Quizzes that gate progression.
- Checkpoints — forced stops to confirm understanding.

Progress is saved automatically. Completed explainers can be exported as
self-contained HTML (works offline, carries all 4 themes inline).

## Videos

If enabled, videos can be submitted by users. They:
- Link to YouTube, Vimeo, or another platform.
- Live in categories.
- Support comments and likes like other content.

## Federation in plain language

Your instance can connect to other servers that speak ActivityPub —
Mastodon, Lemmy, GoToSocial, other CommonPub instances. What this means
concretely:

- **Users can follow across instances.** Someone on `mastodon.social` can
  follow someone on your instance and see their posts in their Mastodon feed.
- **Hubs can act as Group actors** (session 083+). Remote users can follow a
  hub like they'd follow a Mastodon account.
- **Content flows.** A project published on your instance shows up in
  followers' feeds everywhere.
- **CommonPub-to-CommonPub = full fidelity.** Blocks, bill of materials,
  product links, cover images all come through intact.
- **CommonPub-to-Mastodon = readable fallback.** Mastodon sees an article
  with HTML content; the richer structure is silently ignored.

### What federates, what stays local

| Federates | Stays local |
|---|---|
| Articles, projects, blogs, explainers | Docs sites |
| Hubs (as Group actors, if federateHubs is on) | Learning paths |
| Products (BOM link-ups across instances) | Contests |
| User follows and likes | Videos |
| Comments on federated content | Direct messages (v1) |

### Controls

Admins can:
- Allow, block, or selectively federate per domain.
- Set up **content mirrors** to pull content from specific instances.
- Review federation activity and inbox contents.

### OAuth SSO across instances

If your instance marks another instance as **trusted**, users can sign into
yours with their account on the trusted instance (Model B / WebFinger +
OAuth2).

## Settings

Settings you'll touch most:

- **Profile** — display name, bio, avatar, social links.
- **Account** — email, password, 2FA, deletion.
- **Appearance** — theme, dark mode.
- **Notifications** — what to email, digest mode, likes/comments/follows/mentions.

## Admin tasks

If you're an instance admin, the `/admin/` panel has:

- **Users** — list, search, change role, suspend, delete.
- **Content** — moderate, archive, delete; bulk editorial flags.
- **Categories** — content taxonomy for the instance.
- **Reports** — abuse reports; resolve or dismiss.
- **Audit log** — every admin action is logged.
- **Theme** — pick the active theme family and default dark mode.
- **Homepage** — configurable sections (hero, content grid, editorial, stats,
  hubs, contests, custom HTML). Drag to reorder.
- **Navigation** (session 124) — configure the top-nav items: links,
  dropdowns, external links, feature gates, role visibility.
- **Features** — runtime overrides for feature flags (on top of what the
  deployment config sets).
- **Federation** — trusted instances, mirror management, pending activities,
  retry failed deliveries.
- **Settings** — instance name, description, domain.

### Moderation workflow

1. A user files a report via the "Report" menu on content, a comment, or a
   user profile.
2. Admins see it in `/admin/reports` with status **pending**.
3. Admin reviews, writes a resolution note, and optionally removes the content
   or actions the user.
4. Status moves to **resolved** or **dismissed**.
5. Action and reason written to the audit log.

### Promoting users

Role hierarchy: member → pro → verified → staff → admin. Use
`/admin/users/<id>/role` to change. All role changes are audit-logged.

## Getting help

- **Session logs** (`docs/sessions/`) are detailed progress notes per feature.
- **Developer docs** ([developers.md](./developers.md)) if you want to poke under
  the hood.
- **Codebase analysis** (`codebase-analysis/`) has the raw inventory of every
  piece.
- **Issues / feedback** — your instance operator decides the support channel.
