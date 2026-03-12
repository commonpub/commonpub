# Architecture & State Diagrams

## Package Dependency Graph

```mermaid
graph TD
    subgraph Apps
        REF["apps/reference<br/>(SvelteKit, adapter-node)"]
        LAND["apps/landing<br/>(SvelteKit, adapter-static)"]
    end

    subgraph Packages
        SCHEMA["@commonpub/schema<br/>Drizzle tables + Zod validators"]
        CONFIG["@commonpub/config<br/>defineCommonPubConfig()"]
        PROTO["@commonpub/protocol<br/>Fedify + AP types"]
        AUTH["@commonpub/auth<br/>Better Auth wrapper"]
        UI["@commonpub/ui<br/>Svelte 5 components + theme"]
        EDITOR["@commonpub/editor<br/>TipTap extensions"]
        DOCS["@commonpub/docs<br/>Docs module"]
        EXPLAINER["@commonpub/explainer<br/>Interactive modules"]
        LEARNING["@commonpub/learning<br/>Learning paths"]
        TESTUTILS["@commonpub/test-utils<br/>Test helpers"]
    end

    subgraph External
        PG["PostgreSQL 16"]
        REDIS["Redis / Valkey"]
        MEILI["Meilisearch"]
    end

    REF --> SCHEMA
    REF --> CONFIG
    REF --> PROTO
    REF --> AUTH
    REF --> UI
    REF --> EDITOR
    REF --> DOCS
    REF --> EXPLAINER
    REF --> LEARNING
    LAND --> UI

    AUTH --> SCHEMA
    AUTH --> CONFIG
    PROTO --> SCHEMA
    PROTO --> CONFIG
    DOCS --> SCHEMA
    LEARNING --> SCHEMA
    EXPLAINER --> SCHEMA
    EDITOR --> SCHEMA
    TESTUTILS --> SCHEMA
    TESTUTILS --> CONFIG

    REF -.-> PG
    REF -.-> REDIS
    REF -.-> MEILI
```

## Request Lifecycle

```mermaid
sequenceDiagram
    participant Browser
    participant Hooks as hooks.server.ts
    participant Locals as event.locals
    participant Route as +page.server.ts
    participant Server as Server Module
    participant DB as PostgreSQL
    participant Fed as Federation

    Browser->>Hooks: HTTP Request
    Hooks->>Hooks: createSecurityHook()<br/>(nonce CSP, HSTS)
    Hooks->>Hooks: createRateLimitHook()<br/>(sliding window check)
    Hooks->>Locals: Set db, config, user?, session?
    Hooks->>Hooks: Better Auth session resolution
    Hooks->>Route: Pass event with locals

    alt Page Load (GET)
        Route->>Server: Call server module function
        Server->>DB: Drizzle query
        DB-->>Server: Rows
        Server-->>Route: Typed result
        Route-->>Browser: HTML (SSR)
    else Form Action (POST)
        Route->>Route: Validate with Zod
        Route->>Server: Call server module function
        Server->>DB: Drizzle insert/update/delete
        alt Federation enabled
            Server->>Fed: federateContent/Like/etc.
            Fed->>Fed: Build AP activity
            Fed->>Fed: Sign with HTTP Signatures
            Fed-->>Fed: Deliver to remote inboxes
        end
        Server-->>Route: Result
        Route-->>Browser: Redirect or ActionData
    else API Endpoint
        Route->>Route: Validate JSON body
        Route->>Server: Call server module function
        Server->>DB: Drizzle query
        Server-->>Route: Result
        Route-->>Browser: JSON response
    end
```

## Content Data Flow

```mermaid
flowchart LR
    subgraph Client
        TIPTAP["TipTap Editor"]
        FORM["Form Submission"]
    end

    subgraph Validation
        BT["BlockTuple<br/>[type, content][]"]
        ZOD["Zod Validation<br/>createContentSchema"]
    end

    subgraph Storage
        DRZ["Drizzle Insert<br/>contentItems table"]
        PG["PostgreSQL<br/>(jsonb content column)"]
    end

    subgraph Federation
        MAP["contentToArticle()<br/>Map to AP Article"]
        ACT["buildCreateActivity()<br/>Wrap in Create"]
        DEL["Deliver to<br/>follower inboxes"]
    end

    TIPTAP --> BT
    BT --> FORM
    FORM --> ZOD
    ZOD --> DRZ
    DRZ --> PG

    PG --> MAP
    MAP --> ACT
    ACT --> DEL
```

## State Machines

### Content Lifecycle

```mermaid
stateDiagram-v2
    [*] --> draft: createContent()
    draft --> draft: updateContent()
    draft --> published: publishContent()
    published --> published: updateContent()
    published --> archived: deleteContent(soft)
    archived --> draft: restore (manual)
    published --> [*]: deleteContent(hard)
    draft --> [*]: deleteContent(hard)

    note right of published
        Sets publishedAt timestamp.
        If federation enabled, calls
        federateContent() → Create activity.
        Updates call federateUpdate().
    end note

    note right of archived
        Soft delete: status = 'archived'.
        If federation enabled, calls
        federateDelete() → Delete activity.
    end note
```

### Follow Relationship (Federation)

```mermaid
stateDiagram-v2
    [*] --> pending: sendFollow()<br/>Follow activity sent
    pending --> accepted: acceptFollow()<br/>Accept activity received
    pending --> rejected: rejectFollow()<br/>Reject activity received
    accepted --> [*]: unfollowRemote()<br/>Undo(Follow) sent
    rejected --> [*]: cleanup

    note right of pending
        followRelationships row created.
        Status: 'pending'.
        Remote inbox receives Follow activity.
    end note

    note right of accepted
        Status updated to 'accepted'.
        Follower now receives outbound
        Create/Update/Delete activities.
    end note
```

### Activity Status (Federation)

```mermaid
stateDiagram-v2
    [*] --> pending: Activity created
    pending --> delivered: Outbound: HTTP 2xx from remote
    pending --> failed: Outbound: HTTP error or timeout
    pending --> processed: Inbound: callback executed
    failed --> pending: Retry (manual)
    delivered --> [*]
    processed --> [*]

    note right of pending
        activities table row.
        direction: 'inbound' or 'outbound'.
        attempts counter tracks retries.
    end note
```

### Enrollment (Learning Paths)

```mermaid
stateDiagram-v2
    [*] --> enrolled: enroll()
    enrolled --> in_progress: markLessonComplete()<br/>(first lesson)
    in_progress --> in_progress: markLessonComplete()<br/>(progress updates)
    in_progress --> completed: All lessons complete<br/>(progress = 100)
    completed --> certificate: issueCertificate()
    enrolled --> [*]: unenroll()
    in_progress --> [*]: unenroll()

    note right of enrolled
        enrollments row created.
        progress = 0.00.
        learningPaths.enrollmentCount incremented.
    end note

    note right of completed
        enrollments.completedAt set.
        learningPaths.completionCount incremented.
    end note

    note right of certificate
        certificates row created.
        Unique verificationCode generated.
        Public at /certificates/[code].
    end note
```

### Community Membership

```mermaid
stateDiagram-v2
    [*] --> member: joinCommunity()<br/>(open policy)
    [*] --> pending_approval: joinCommunity()<br/>(approval policy)
    [*] --> invited: createInvite()
    pending_approval --> member: approve
    invited --> member: accept invite
    member --> kicked: kickMember()
    member --> banned: banUser()
    kicked --> [*]
    banned --> member: unbanUser()
    banned --> [*]: ban expires

    note right of member
        communityMembers row.
        role: 'member' (default).
        Can be promoted: moderator → admin → owner.
    end note

    note right of banned
        communityBans row created.
        Optional expiresAt for temp bans.
        Prevents rejoin while active.
    end note
```

### Report Lifecycle

```mermaid
stateDiagram-v2
    [*] --> pending: User submits report
    pending --> reviewed: Admin views report
    reviewed --> resolved: Admin resolves<br/>(action taken)
    reviewed --> dismissed: Admin dismisses<br/>(no action needed)
    resolved --> [*]
    dismissed --> [*]

    note right of pending
        reports table row.
        reason: spam | harassment |
        inappropriate | copyright | other.
    end note

    note right of resolved
        reviewedById set.
        resolution text recorded.
        Audit log entry created.
    end note
```

## Database Entity Relationship Overview

```mermaid
erDiagram
    users ||--o{ sessions : has
    users ||--o{ accounts : has
    users ||--o{ contentItems : authors
    users ||--o{ likes : creates
    users ||--o{ comments : writes
    users ||--o{ bookmarks : saves
    users ||--o{ follows : "follows/followed"
    users ||--o{ notifications : receives
    users ||--o{ communityMembers : joins
    users ||--o{ enrollments : enrolls
    users ||--o{ certificates : earns
    users ||--o{ federatedAccounts : "SSO links"
    users ||--o{ actorKeypairs : "has keypair"
    users ||--o{ reports : submits

    contentItems ||--o{ contentTags : tagged
    contentItems ||--o{ contentForks : forked
    tags ||--o{ contentTags : used

    communities ||--o{ communityMembers : has
    communities ||--o{ communityPosts : contains
    communities ||--o{ communityBans : enforces
    communities ||--o{ communityInvites : creates
    communities ||--o{ communityShares : shares

    communityPosts ||--o{ communityPostReplies : has

    learningPaths ||--o{ learningModules : contains
    learningModules ||--o{ learningLessons : contains
    learningPaths ||--o{ enrollments : tracks
    learningPaths ||--o{ certificates : awards

    docsSites ||--o{ docsVersions : versions
    docsVersions ||--o{ docsPages : contains
    docsVersions ||--o{ docsNav : "has nav"

    remoteActors ||--o{ activities : performs
    followRelationships }o--o{ users : connects
```

## Infrastructure Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        BROWSER["Browser"]
    end

    subgraph "Application Layer"
        SK["SvelteKit<br/>(Node.js)"]
        BA["Better Auth<br/>(embedded)"]
    end

    subgraph "Data Layer"
        PG["PostgreSQL 16<br/>(primary store)"]
        REDIS["Redis / Valkey<br/>(rate limiting, sessions)"]
        MEILI["Meilisearch<br/>(full-text search)"]
    end

    subgraph "Federation Layer"
        FED["Fedify<br/>(AP protocol)"]
        REMOTE["Remote<br/>AP Instances"]
    end

    BROWSER <--> SK
    SK <--> BA
    SK <--> PG
    SK <--> REDIS
    SK <--> MEILI
    SK <--> FED
    FED <--> REMOTE
```
