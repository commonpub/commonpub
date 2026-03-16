# Session 026: Mockup-Faithful Page Rebuild

**Date**: 2026-03-15

## What was done

Continued the page-by-page rebuild to match the unified-v2 mockup HTML files. Each page was rebuilt by reading the actual mockup HTML file and faithfully reproducing the structure, layout, and styling.

### Branding fix
- Replaced all "Snaplify" references with "CommonPub" in `default.vue` and `index.vue`
- Verified no source files contain "Snaplify" (only `.nuxt` build artifacts, which auto-regenerate)

### Search page (`pages/search.vue`) — matches `02-search.html`
- Complete rewrite from left-sidebar-filters layout to main + right sidebar (280px)
- Search hero: label with line separator, large search input with ⌘K badge, result count
- Type filter strip: All, Projects, Articles, Blogs, Explainers, Videos, Communities, People
- Collapsible advanced filters panel: 5-col grid with Difficulty checkboxes, Tags input + chips, Date Range inputs, Author/Community inputs, Apply/Clear actions
- Results header with grid/list view toggle
- 3-col results grid with pagination
- Right sidebar: Trending Searches (ranked list with trend indicators), Suggested Tags (clickable tag cloud), Browse by Category (2x4 icon grid), Related Communities

### Profile page (`pages/u/[username].vue`) — matches `12-profile-page.html`
- Updated tabs from `[projects, articles, experience, awards, skills]` to `[Projects, Articles, Explainers, Videos, About]` with icons
- Stats bar expanded from 4 to 6 items: Projects, Followers, Following, Articles, Total Views, Likes
- About tab now combines Experience timeline, Awards grid, Skills with progress bars in a 2-col layout (main + 280px sidebar with Featured Projects)
- Added tag row under bio, share/more buttons, YouTube/Mastodon social links
- Added all inline CSS: timeline dots, skill bars, section headers, sidebar cards, mini project cards

### Community page (`pages/communities/[slug].vue`) — matches `13-hub-page.html`
- Complete rewrite replacing broken CSS variable references (`--content-max-width`, `--space-6`, etc.)
- Decorative banner: 160px height, grid pattern overlay, dot pattern overlay
- Hub meta bar: 64px icon overlapping banner (-32px), name, description, stats row, join/subscribe/share buttons, verified badge, tags
- Tabs: Feed, Projects, Discussions, Learn, Events, Members (with icons, mono font)
- Main + sidebar (300px) layout
- Feed: compose bar, filter chips, typed feed cards (question/discussion/showcase/announcement) with colored badges, vote/reply/bookmark/share actions, announcement highlight band
- Discussions: vote count + title + replies layout
- Members: 4-col card grid
- Sidebar: Moderators (avatar + name + role), Rules (numbered), Related Communities (icon + name + count)

## Decisions Made

- Each mockup HTML file is read in full before any code changes — no relying on text descriptions
- All CSS uses direct `var(--*)` tokens from the design system, no undefined custom properties
- Community page tabs match mockup (Feed/Projects/Discussions/Learn/Events/Members) not the old (Feed/Discussions/Members/About)
- Profile "About" tab consolidates experience, awards, and skills in one view with a sidebar, matching the mockup's single-page scroll layout

## Open Questions

- 12 mockup pages still need faithful rebuilds (editors, views, contest, learning, video hub)
- Some API endpoints referenced by new pages may not exist yet (`/api/search`, `/api/search/trending`)
- The old agent-generated components (`AnnouncementBand`, `FeedItem`, `DiscussionItem`, `MemberCard`) may now be unused since the community page was rewritten with inline templates

## Next Steps

- Continue page-by-page rebuild: editors (03-06), views (08-11), contest (14), learning (15), video hub (16)
- Audit for broken imports, unused components, missing API endpoints
- Clean up old agent-generated components if confirmed unused
