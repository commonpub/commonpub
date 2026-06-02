# 07 — State & Flow Diagrams

Mermaid diagrams for core domains. Render in any Mermaid-compatible viewer
(GitHub, GitLab, VS Code preview). Diagram bodies re-verified against code
session 181 (2026-06-01).

> Not yet diagrammed (shipped after the original diagrams): **keyset feed
> pagination** (`listContentKeyset` → `GET /api/content/feed`, sessions 178–179),
> **RBAC permission resolution** (`resolveUserPermissions` + `requirePermission`,
> session 175), and the **layout-engine render path** (`<LayoutSlot>` →
> `useLayout` → `<LayoutRow>`/`<LayoutSection>`, sessions 155–169). See the
> homepage-rendering note below and `03`/`05` for those.

## Authentication

```mermaid
flowchart TD
    A[Visitor] --> B{Has session cookie?}
    B -->|yes| C[Better Auth validates]
    B -->|no| D[Show public content]
    C -->|valid| E[Populate event.context.user]
    C -->|invalid| F[Clear cookie] --> D
    E --> G[Request proceeds with auth]

    H[/auth/register] --> I[createUser]
    AA[server boot] --> K[auto-admin startup plugin: promote first/named user → admin]

    M[/api/auth/federated/login] -->|instance B| N[WebFinger lookup]
    N --> O[discoverOAuthEndpoint]
    O --> P[redirect to B's /oauth2/authorize]
    P --> Q[user authenticates at B]
    Q --> R[callback /api/auth/federated/callback]
    R --> S[token exchange /api/auth/oauth2/token]
    S --> T[link federatedAccount to local user]
```

## Content lifecycle

```mermaid
stateDiagram-v2
    [*] --> draft : createContent
    draft --> published : publishContent
    published --> archived : update status
    draft --> archived_soft : deleteContent (soft)
    published --> archived_soft : deleteContent (soft)
    archived --> [*]
    archived_soft --> [*]

    note right of published
      emits content:published
      federates Create activity
      triggers search index
    end note

    note right of archived_soft
      emits content:deleted
      federates Delete activity
      contentStatusEnum = draft|published|archived ONLY —
      "soft delete" sets status='archived' AND deletedAt=now()
      (there is no 'deleted' status value)
    end note
```

## Contest lifecycle

```mermaid
stateDiagram-v2
    [*] --> upcoming : createContest
    upcoming --> active : transitionContestStatus
    active --> judging : transitionContestStatus (entries closed)
    judging --> completed : transitionContestStatus (ranks calc)
    upcoming --> cancelled
    active --> cancelled
    judging --> cancelled

    state active {
        [*] --> accepting_entries
        accepting_entries --> community_voting : if communityVotingEnabled
    }

    state judging {
        [*] --> awaiting_scores
        awaiting_scores --> all_scored : judges submit
    }
```

## Contest judges (session 124)

```mermaid
sequenceDiagram
    participant Owner as Contest Owner
    participant API as /api/contests/:slug/judges
    participant Judge
    participant Notif as notifications

    Owner->>API: POST { userId, role: 'judge' }
    API->>API: addContestJudge (invitedAt=now, acceptedAt=null)
    API->>Notif: Notify judge (type: contest)
    Note right of Judge: User sees invite in inbox

    Judge->>API: POST /judges/accept
    API->>API: update acceptedAt=now
    API->>Notif: Notify contest owner
```

## Events + RSVP

```mermaid
flowchart TD
    A[POST /api/events/:slug/rsvp] --> B{Transaction}
    B --> C{capacity set?}
    C -->|no| D[status=registered]
    C -->|yes| E{attendeeCount < capacity?}
    E -->|yes| D
    E -->|no| F[status=waitlisted]
    D --> G[increment attendeeCount]
    F --> H[no increment]

    J[DELETE /api/events/:slug/rsvp] --> K{Transaction}
    K --> L[Load current RSVP]
    L --> M{was registered?}
    M -->|yes| N[decrement attendeeCount]
    N --> O[find oldest waitlisted]
    O -->|exists| P[promote to registered]
    P --> Q[increment attendeeCount]
    M -->|no| S[delete waitlisted row]
```

> **Note:** `rsvpEvent`/`cancelRsvp` (events.ts) fire **no notifications and no hooks** — the routes just return status. (`cancelRsvp` returns `promoted: userId` but the route discards it to a bare boolean; nobody is notified.)

## Hub post voting

```mermaid
sequenceDiagram
    participant User
    participant API as /api/hubs/:slug/posts/:postId/vote
    participant DB

    User->>API: POST { direction: 'up' }
    API->>DB: BEGIN TRANSACTION
    DB->>DB: SELECT existing vote
    alt no existing vote
        DB->>DB: INSERT hubPostVote (up)
        DB->>DB: UPDATE hubPosts.voteScore += 1
    else existing vote same direction
        DB->>DB: DELETE hubPostVote
        DB->>DB: UPDATE hubPosts.voteScore -= 1 (for up; +1 for down)
    else existing vote opposite direction
        DB->>DB: UPDATE hubPostVote.direction
        DB->>DB: UPDATE hubPosts.voteScore += 2 (or -2)
    end
    API->>DB: COMMIT
    API->>User: { score, userVote }
```

## Poll voting

```mermaid
sequenceDiagram
    participant User
    participant API as /api/hubs/:slug/posts/:postId/poll-vote
    participant DB

    User->>API: POST { optionId }
    API->>DB: BEGIN TRANSACTION
    DB->>DB: SELECT pollVote by (postId, userId)
    alt no existing vote
        DB->>DB: INSERT pollVote
        DB->>DB: UPDATE pollOptions.voteCount += 1
    else re-vote (same option)
        Note right of DB: idempotent — no-op
    else switch option
        DB->>DB: UPDATE pollVote.optionId
        DB->>DB: UPDATE old option.voteCount -= 1
        DB->>DB: UPDATE new option.voteCount += 1
    end
    API->>DB: COMMIT
```

## Hub join flow

```mermaid
flowchart TD
    A[POST /api/hubs/:slug/join] --> B{Check bans}
    B -->|banned| X[403]
    B -->|ok| C{hub.joinPolicy}
    C -->|open| D[insert hubMember status=active]
    C -->|approval OR invite| F{invite token valid + matches hubId?}
    F -->|no| X2[error: invite required / invalid]
    F -->|yes| G[increment invite useCount toward maxUses]
    G --> D
    D --> H[increment hub.memberCount]
    H --> I[emit hub:member:joined]
    I --> J[notify hub admins]
```

**Note:** `approval` policy currently behaves the same as `invite` —
`joinHub()` requires an invite token for any non-open policy. A separate
request-to-join / admin-approves workflow (using `hubMembers.status =
'pending'`) is not implemented; the `hubMemberStatusEnum('pending')` value
exists in the schema but no code path sets it today.

## ActivityPub federation: outbound delivery

```mermaid
flowchart LR
    A[publishContent] --> B[insert activity: pending, outbound]
    B --> C[federation-delivery worker poll]
    C --> D{instance healthy?}
    D -->|circuit open| E[skip, retry later]
    D -->|ok| F[build HTTP Signature]
    F --> G[POST to remote inbox]
    G -->|200| H[status=delivered]
    G -->|4xx/5xx| I[status=failed, attempts++]
    I -->|attempts < max| J[backoff schedule]
    I -->|attempts >= max| K[deadLetteredAt=now]
    G -->|timeout| L[update instanceHealth.consecutiveFailures]
    L --> M{threshold hit?}
    M -->|yes| N[circuitOpenUntil = now + cool-off]
```

## ActivityPub federation: inbound routing

```mermaid
flowchart TD
    A[POST /users/:username/inbox] --> B[verify HTTP Signature]
    B -->|invalid| X[401]
    B -->|valid| C[resolveRemoteActor if unknown]
    C --> D[insert activity: pending, inbound]
    D --> E[dispatch by activity.type]
    E -->|Follow| F[insert followRelationship pending]
    F --> G[auto-accept if policy=auto-accept]
    G --> H[send Accept activity back]
    E -->|Accept| I[update followRelationship status=accepted]
    E -->|Undo| J[delete follow / like]
    E -->|Create + Article| K[insert federatedContent]
    K --> L[emit federation:content:received]
    E -->|Create + Note with inReplyTo| M[insert reply]
    E -->|Announce| N[treat as boost / cross-post]
    E -->|Like| O[local engagement mirror]
    E -->|Delete| P[soft-delete federatedContent]
    E -->|Update| Q[update cached federatedContent]
```

## Hub federation (Group actor, session 083+)

```mermaid
sequenceDiagram
    participant RemoteUser as Remote AP user
    participant LocalHub as Local hub (Group actor)
    participant Member as Local hub member

    RemoteUser->>LocalHub: Follow Group actor
    LocalHub->>LocalHub: insert hubFollowers
    LocalHub->>RemoteUser: Accept
    
    Member->>LocalHub: createPost
    LocalHub->>LocalHub: hub:post:created hook
    LocalHub->>LocalHub: federate Announce activity
    LocalHub->>RemoteUser: deliver Announce to all hubFollowers

    RemoteUser->>LocalHub: Reply (Create + inReplyTo)
    LocalHub->>LocalHub: insert hubPostReply (authorId=null, remoteActorUri set)
```

## Instance mirroring (session 079)

```mermaid
flowchart TD
    A[admin creates instanceMirror remoteDomain=B.com] --> B{direction}
    B -->|pull| C[backfill worker]
    C --> D[fetch /actor of B]
    D --> E[fetch outbox first page]
    E --> F[iterate pages using backfillCursor]
    F --> G[insert federatedContent per item]
    G --> H{filter match?}
    H -->|no| F
    H -->|yes| I[respect filterContentTypes / filterTags]
    I --> J[emit federation:content:received]
    F -->|done| K[status=active]

    B -->|push| L[send Follow to B]
    L --> M[B accepts → status=active]
    M --> N[B now delivers all matching content]
```

## Learning progress

> **Note:** `enrollments` has **no status enum** — these are *derived*
> states, not stored values. The row tracks `progress` (0–100),
> `startedAt`, and a nullable `completedAt`. "in_progress"/"certified" are
> presentation labels; "unenroll" deletes the enrollment row.

```mermaid
stateDiagram-v2
    [*] --> enrolled : POST /api/learn/:slug/enroll (progress=0)
    enrolled --> in_progress : markLessonComplete (progress > 0)
    in_progress --> in_progress : markLessonComplete (progress recomputed)
    in_progress --> completed : progress=100 (completedAt set)
    completed --> certified : auto-issue certificate row
    certified --> [*]
    enrolled --> unenrolled : POST /api/learn/:slug/unenroll (row deleted)
    unenrolled --> [*]

    note right of certified
      verification code: CPUB-{timestamp_base36_UPPERCASED}-{random_hex8}
      public route /cert/:code
      no feature flag required
    end note
```

## Homepage rendering

`pages/index.vue` is a 3-way `v-if`: (1) when `features.layoutEngine` is ON
**and** a layout exists at scope `('route','/')`, render via `<LayoutSlot>`
(the live commonpub.io canary); (2) else if configurable sections exist,
the legacy `HomepageSectionRenderer` below; (3) else the hardcoded homepage.
Section `type` strings are **kebab-case** and component names are
`Homepage`-prefixed (Nuxt pathPrefix registration of `components/homepage/*`).

```mermaid
flowchart TD
    A[GET /] --> B[server middleware resolves theme + features]
    B --> Z{layoutEngine ON AND layout at route '/'?}
    Z -->|yes| Y[LayoutSlot → LayoutRow → LayoutSection]
    Z -->|no| C[fetch instanceSettings.homepage.sections]
    C --> D[HomepageSectionRenderer dispatches on section.enabled/zone/feature]
    D --> E{section.type}
    E -->|hero| F[HomepageHeroSection]
    E -->|content-grid| G[HomepageContentGridSection]
    E -->|editorial| H[HomepageEditorialSection]
    E -->|contests| I[HomepageContestsSection]
    E -->|hubs| J[HomepageHubsSection]
    E -->|stats| K[HomepageStatsSection]
    E -->|custom-html| L[HomepageCustomHtmlSection]
    F --> M[render]
    G --> M
    H --> M
    I --> M
    J --> M
    K --> M
    L --> M
```

## Navigation rendering (session 124)

```mermaid
flowchart TD
    A[NavRenderer mounts] --> B[fetch /api/navigation/items]
    B --> C[reactive NavItem[] from instanceSettings.nav.items]
    C --> D[filter by feature flags + auth state]
    D --> E{item.type}
    E -->|link| F[NavLink]
    E -->|dropdown| G[NavDropdown]
    G --> H{all children feature-gated out?}
    H -->|yes| I[hide dropdown]
    H -->|no| J[render with filtered children]
    E -->|external| K[target=_blank]
```
