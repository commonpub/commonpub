import { PUBLIC_API_SCOPES } from '@commonpub/schema';

/**
 * GET /api/public/v1/openapi.json
 *
 * Hand-written OpenAPI 3.1 spec. Requires a valid key with any scope — we
 * don't expose the spec anonymously because the existence of the API surface
 * is itself gated by the publicApi feature flag. Consumers typically fetch
 * the spec once at integration time and paste into Postman/Insomnia; a
 * per-key spec lets us later vary the spec's advertised scopes by key (not
 * doing that yet, but leaves the door open).
 */
export default defineEventHandler((event) => {
  // Any valid scope grants access to the spec itself.
  const scopes = event.context.apiScopes;
  if (!scopes || scopes.length === 0) {
    throw createError({ statusCode: 401, statusMessage: 'Missing API key' });
  }

  const config = useConfig();
  const base = `https://${config.instance.domain}/api/public/v1`;

  const errorResponse = {
    type: 'object',
    properties: {
      error: { type: 'boolean' },
      statusCode: { type: 'integer' },
      statusMessage: { type: 'string' },
      message: { type: 'string' },
    },
  };

  const paginated = (itemsRef: string) => ({
    type: 'object',
    required: ['items', 'total', 'hasMore', 'limit', 'offset'],
    properties: {
      items: { type: 'array', items: { $ref: itemsRef } },
      // Nullable, and this is load-bearing for clients. Counting every matching
      // row is the expensive half of the query, so it is only done for the first
      // page; past that the count is genuinely unknown rather than zero. A
      // client must not treat null as "no results", and must not assume it can
      // loop `while (offset < total)`.
      //
      // Before session 254 this shipped as `-1` against this very schema, which
      // documents an integer. Any client looping on it truncated the collection
      // silently.
      total: { type: ['integer', 'null'], description: 'Matching rows, or null when the count was not computed for this page.' },
      // Always answerable, which is why a pager should bind to this rather than
      // deriving page counts from `total`.
      hasMore: { type: 'boolean', description: 'Whether a further page exists.' },
      limit: { type: 'integer' },
      offset: { type: 'integer' },
    },
  });

  return {
    openapi: '3.1.0',
    info: {
      title: `${config.instance.name} Public API`,
      version: '1.0.0',
      description:
        'CommonPub Public Read API. Admin-provisioned Bearer tokens, per-key scopes, read-only in v1. ' +
        'See https://commonpub.io/docs/public-api for the full reference.',
      license: { name: 'AGPL-3.0-or-later', url: 'https://www.gnu.org/licenses/agpl-3.0.html' },
    },
    servers: [{ url: base }],
    components: {
      securitySchemes: {
        bearer: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'cpub_<env>_<type>_<random>',
          description: 'Admin-provisioned opaque token. Create keys at /admin/api-keys.',
        },
      },
      schemas: {
        Error: errorResponse,
        PublicUser: {
          type: 'object',
          required: ['id', 'username', 'createdAt'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            username: { type: 'string' },
            displayName: { type: 'string', nullable: true },
            headline: { type: 'string', nullable: true },
            bio: { type: 'string', nullable: true },
            avatarUrl: { type: 'string', format: 'uri', nullable: true },
            bannerUrl: { type: 'string', format: 'uri', nullable: true },
            pronouns: { type: 'string', nullable: true },
            location: { type: 'string', nullable: true },
            website: { type: 'string', format: 'uri', nullable: true },
            skills: { type: 'array', items: { type: 'string' }, nullable: true },
            socialLinks: { type: 'object', additionalProperties: { type: 'string' }, nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        // A listed member: every PublicUser field plus their publishable
        // persona answers. It composes PublicUser rather than restating it, so
        // the ONE serializer with no email field stays the one definition of
        // what a public user is. Free text appears only where the operator
        // marked the field public, and `sensitive` fields never appear.
        OpenMember: {
          allOf: [
            { $ref: '#/components/schemas/PublicUser' },
            {
              type: 'object',
              required: ['persona'],
              properties: {
                persona: {
                  type: 'array',
                  items: {
                    type: 'object',
                    required: ['fieldKey', 'label', 'display', 'values'],
                    properties: {
                      fieldKey: { type: 'string' },
                      label: { type: 'string' },
                      display: { type: 'string', enum: ['chips', 'text'] },
                      values: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Resolved option LABELS, or the single stored string for free text. Never a raw option value.',
                      },
                    },
                  },
                },
              },
            },
          ],
        },
        UserRef: {
          type: 'object',
          required: ['id', 'username'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            username: { type: 'string' },
            displayName: { type: 'string', nullable: true },
            avatarUrl: { type: 'string', format: 'uri', nullable: true },
          },
        },
        PublicContentSummary: {
          type: 'object',
          required: ['id', 'type', 'title', 'slug', 'canonicalUrl', 'source'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            type: { type: 'string', enum: ['project', 'blog', 'explainer'] },
            title: { type: 'string' },
            slug: { type: 'string' },
            description: { type: 'string', nullable: true },
            coverImageUrl: { type: 'string', format: 'uri', nullable: true },
            difficulty: { type: 'string', nullable: true },
            publishedAt: { type: 'string', format: 'date-time', nullable: true },
            updatedAt: { type: 'string', format: 'date-time' },
            viewCount: { type: 'integer' },
            likeCount: { type: 'integer' },
            commentCount: { type: 'integer' },
            author: { $ref: '#/components/schemas/UserRef' },
            canonicalUrl: { type: 'string', format: 'uri' },
            source: { type: 'string', enum: ['local', 'federated'] },
            sourceDomain: { type: 'string', nullable: true },
            sourceUri: { type: 'string', format: 'uri', nullable: true },
          },
        },
        PublicHub: {
          type: 'object',
          required: ['id', 'name', 'slug', 'hubType', 'canonicalUrl'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            slug: { type: 'string' },
            description: { type: 'string', nullable: true },
            hubType: { type: 'string', enum: ['community', 'product', 'company'] },
            iconUrl: { type: 'string', format: 'uri', nullable: true },
            bannerUrl: { type: 'string', format: 'uri', nullable: true },
            memberCount: { type: 'integer' },
            postCount: { type: 'integer' },
            isOfficial: { type: 'boolean' },
            categories: { type: 'array', items: { type: 'string' }, nullable: true },
            website: { type: 'string', format: 'uri', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            canonicalUrl: { type: 'string', format: 'uri' },
          },
        },
        PublicLearningPath: {
          type: 'object',
          required: ['id', 'title', 'slug', 'canonicalUrl'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            title: { type: 'string' },
            slug: { type: 'string' },
            description: { type: 'string', nullable: true },
            coverImageUrl: { type: 'string', format: 'uri', nullable: true },
            difficulty: { type: 'string', nullable: true },
            lessonCount: { type: 'integer' },
            enrollmentCount: { type: 'integer' },
            publishedAt: { type: 'string', format: 'date-time', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            author: { $ref: '#/components/schemas/UserRef' },
            canonicalUrl: { type: 'string', format: 'uri' },
          },
        },
        PublicEvent: {
          type: 'object',
          required: ['id', 'title', 'slug', 'startAt', 'canonicalUrl'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            title: { type: 'string' },
            slug: { type: 'string' },
            description: { type: 'string', nullable: true },
            coverImageUrl: { type: 'string', format: 'uri', nullable: true },
            eventType: { type: 'string' },
            status: { type: 'string', enum: ['published', 'active', 'completed', 'upcoming', 'past'] },
            location: { type: 'string', nullable: true },
            locationUrl: { type: 'string', format: 'uri', nullable: true },
            startAt: { type: 'string', format: 'date-time' },
            endAt: { type: 'string', format: 'date-time', nullable: true },
            timezone: { type: 'string', nullable: true },
            capacity: { type: 'integer', nullable: true },
            attendeeCount: { type: 'integer' },
            waitlistCount: { type: 'integer' },
            hubId: { type: 'string', format: 'uuid', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            host: { $ref: '#/components/schemas/UserRef' },
            canonicalUrl: { type: 'string', format: 'uri' },
          },
        },
        PublicContest: {
          type: 'object',
          required: ['id', 'title', 'slug', 'status', 'canonicalUrl'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            title: { type: 'string' },
            slug: { type: 'string' },
            description: { type: 'string', nullable: true },
            bannerUrl: { type: 'string', format: 'uri', nullable: true },
            status: { type: 'string', enum: ['upcoming', 'active', 'judging', 'completed'] },
            startDate: { type: 'string', format: 'date-time' },
            endDate: { type: 'string', format: 'date-time' },
            entryDeadline: { type: 'string', format: 'date-time', nullable: true },
            judgingDeadline: { type: 'string', format: 'date-time', nullable: true },
            prizeDescription: { type: 'string', nullable: true },
            entryCount: { type: 'integer' },
            communityVotingEnabled: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
            canonicalUrl: { type: 'string', format: 'uri' },
          },
        },
        PublicVideo: {
          type: 'object',
          required: ['id', 'title', 'url', 'canonicalUrl'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            title: { type: 'string' },
            description: { type: 'string', nullable: true },
            url: { type: 'string', format: 'uri' },
            embedUrl: { type: 'string', format: 'uri', nullable: true },
            thumbnailUrl: { type: 'string', format: 'uri', nullable: true },
            duration: { type: 'integer', nullable: true },
            category: { type: 'object', nullable: true },
            viewCount: { type: 'integer' },
            likeCount: { type: 'integer' },
            createdAt: { type: 'string', format: 'date-time' },
            author: { $ref: '#/components/schemas/UserRef' },
            canonicalUrl: { type: 'string', format: 'uri' },
          },
        },
        PublicDocSite: {
          type: 'object',
          required: ['id', 'name', 'slug', 'canonicalUrl'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            slug: { type: 'string' },
            description: { type: 'string', nullable: true },
            pageCount: { type: 'integer' },
            versionCount: { type: 'integer' },
            defaultVersion: { type: 'string', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            owner: { $ref: '#/components/schemas/UserRef' },
            canonicalUrl: { type: 'string', format: 'uri' },
          },
        },
        PublicTag: {
          type: 'object',
          required: ['id', 'name', 'slug'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            slug: { type: 'string' },
            usageCount: { type: 'integer' },
            canonicalUrl: { type: 'string', format: 'uri' },
          },
        },
        PublicInstance: {
          type: 'object',
          required: ['name', 'domain', 'software'],
          properties: {
            name: { type: 'string' },
            description: { type: 'string', nullable: true },
            domain: { type: 'string' },
            software: { type: 'object' },
            users: { type: 'object' },
            content: { type: 'object' },
            hubs: { type: 'object' },
            features: { type: 'object' },
            openRegistrations: { type: 'boolean' },
            links: { type: 'object' },
          },
        },
      },
    },
    security: [{ bearer: PUBLIC_API_SCOPES.slice() }],
    paths: {
      '/content': {
        get: {
          summary: 'List published content',
          security: [{ bearer: ['read:content'] }],
          parameters: [
            { name: 'type', in: 'query', schema: { type: 'string', enum: ['project', 'blog', 'explainer'] } },
            { name: 'tag', in: 'query', schema: { type: 'string' } },
            { name: 'authorId', in: 'query', schema: { type: 'string', format: 'uuid' } },
            { name: 'categoryId', in: 'query', schema: { type: 'string', format: 'uuid' } },
            { name: 'difficulty', in: 'query', schema: { type: 'string', enum: ['beginner', 'intermediate', 'advanced'] } },
            { name: 'sort', in: 'query', schema: { type: 'string', enum: ['recent', 'popular', 'featured'] } },
            { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100 } },
            { name: 'offset', in: 'query', schema: { type: 'integer', minimum: 0 } },
          ],
          responses: {
            '200': { description: 'OK', content: { 'application/json': { schema: paginated('#/components/schemas/PublicContentSummary') } } },
            '401': { description: 'Missing/invalid API key', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            '403': { description: 'Missing scope', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            '429': { description: 'Rate limit exceeded' },
          },
        },
      },
      '/content/{slug}': {
        get: {
          summary: 'Get a single published content item',
          security: [{ bearer: ['read:content'] }],
          parameters: [
            { name: 'slug', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'author', in: 'query', schema: { type: 'string' }, description: 'Disambiguate user-scoped slugs.' },
          ],
          responses: {
            '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/PublicContentSummary' } } } },
            '404': { description: 'Not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
      },
      '/hubs': {
        get: {
          summary: 'List hubs',
          security: [{ bearer: ['read:hubs'] }],
          parameters: [
            { name: 'type', in: 'query', schema: { type: 'string', enum: ['community', 'product', 'company'] } },
            { name: 'search', in: 'query', schema: { type: 'string' } },
            { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100 } },
            { name: 'offset', in: 'query', schema: { type: 'integer', minimum: 0 } },
          ],
          responses: {
            '200': { description: 'OK', content: { 'application/json': { schema: paginated('#/components/schemas/PublicHub') } } },
          },
        },
      },
      '/hubs/{slug}': {
        get: { summary: 'Get a hub', security: [{ bearer: ['read:hubs'] }], parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/PublicHub' } } } } } },
      },
      '/users': {
        get: { summary: 'List public users', security: [{ bearer: ['read:users'] }], parameters: [{ name: 'q', in: 'query', schema: { type: 'string' } }, { name: 'limit', in: 'query', schema: { type: 'integer' } }, { name: 'offset', in: 'query', schema: { type: 'integer' } }], responses: { '200': { description: 'OK', content: { 'application/json': { schema: paginated('#/components/schemas/PublicUser') } } } } },
      },
      '/users/{username}': {
        get: { summary: 'Get a public user profile', security: [{ bearer: ['read:users'] }], parameters: [{ name: 'username', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/PublicUser' } } } } } },
      },
      '/instance': {
        get: { summary: 'Instance metadata', security: [{ bearer: ['read:instance'] }], responses: { '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/PublicInstance' } } } } } },
      },
      '/learn': {
        get: { summary: 'List published learning paths', security: [{ bearer: ['read:learn'] }], responses: { '200': { description: 'OK', content: { 'application/json': { schema: paginated('#/components/schemas/PublicLearningPath') } } } } },
      },
      '/learn/{slug}': {
        get: { summary: 'Get a learning path', security: [{ bearer: ['read:learn'] }], parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/PublicLearningPath' } } } } } },
      },
      '/events': {
        get: { summary: 'List events (feature-gated)', security: [{ bearer: ['read:events'] }], responses: { '200': { description: 'OK', content: { 'application/json': { schema: paginated('#/components/schemas/PublicEvent') } } } } },
      },
      '/events/{slug}': {
        get: { summary: 'Get an event', security: [{ bearer: ['read:events'] }], parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/PublicEvent' } } } } } },
      },
      '/contests': {
        get: { summary: 'List contests (feature-gated)', security: [{ bearer: ['read:contests'] }], responses: { '200': { description: 'OK', content: { 'application/json': { schema: paginated('#/components/schemas/PublicContest') } } } } },
      },
      '/contests/{slug}': {
        get: { summary: 'Get a contest', security: [{ bearer: ['read:contests'] }], parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/PublicContest' } } } } } },
      },
      '/videos': {
        get: { summary: 'List videos (feature-gated)', security: [{ bearer: ['read:videos'] }], responses: { '200': { description: 'OK', content: { 'application/json': { schema: paginated('#/components/schemas/PublicVideo') } } } } },
      },
      '/videos/{id}': {
        get: { summary: 'Get a video by id', security: [{ bearer: ['read:videos'] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/PublicVideo' } } } } } },
      },
      '/docs': {
        get: { summary: 'List docs sites (feature-gated)', security: [{ bearer: ['read:docs'] }], responses: { '200': { description: 'OK', content: { 'application/json': { schema: paginated('#/components/schemas/PublicDocSite') } } } } },
      },
      '/docs/{slug}': {
        get: { summary: 'Get a docs site', security: [{ bearer: ['read:docs'] }], parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/PublicDocSite' } } } } } },
      },
      '/tags': {
        get: { summary: 'List tags with usage counts', security: [{ bearer: ['read:tags'] }], responses: { '200': { description: 'OK', content: { 'application/json': { schema: paginated('#/components/schemas/PublicTag') } } } } },
      },
      '/search': {
        get: { summary: 'Search content', security: [{ bearer: ['read:search'] }], parameters: [{ name: 'q', in: 'query', required: true, schema: { type: 'string' } }, { name: 'type', in: 'query', schema: { type: 'string' } }], responses: { '200': { description: 'OK', content: { 'application/json': { schema: paginated('#/components/schemas/PublicContentSummary') } } } } },
      },
      '/metrics/overview': {
        get: { summary: 'Instance analytics scorecard (totals + 7d/30d deltas)', security: [{ bearer: ['read:analytics'] }], responses: { '200': { description: 'OK', content: { 'application/json': { schema: { type: 'object' } } } }, '403': { description: 'Missing scope', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } } } },
      },
      '/metrics/content/top': {
        get: { summary: 'Top content by engagement metric', security: [{ bearer: ['read:analytics'] }], parameters: [{ name: 'metric', in: 'query', schema: { type: 'string', enum: ['views', 'likes', 'comments'] } }, { name: 'type', in: 'query', schema: { type: 'string', enum: ['project', 'blog', 'explainer'] } }, { name: 'limit', in: 'query', schema: { type: 'integer' } }], responses: { '200': { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { items: { type: 'array', items: { $ref: '#/components/schemas/PublicContentSummary' } } } } } } } } },
      },
      '/metrics/tags/trending': {
        get: { summary: 'Tags ranked by usage', security: [{ bearer: ['read:analytics'] }], parameters: [{ name: 'limit', in: 'query', schema: { type: 'integer' } }], responses: { '200': { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { items: { type: 'array', items: { $ref: '#/components/schemas/PublicTag' } } } } } } } } },
      },
      '/metrics/contributors/top': {
        get: { summary: 'Top public-profile contributors', security: [{ bearer: ['read:analytics'] }], parameters: [{ name: 'limit', in: 'query', schema: { type: 'integer' } }], responses: { '200': { description: 'OK', content: { 'application/json': { schema: { type: 'object' } } } } } },
      },
      '/metrics/engagement': {
        get: { summary: 'Aggregate engagement ratios and funnels', security: [{ bearer: ['read:analytics'] }], responses: { '200': { description: 'OK', content: { 'application/json': { schema: { type: 'object' } } } } } },
      },
      '/metrics/timeseries': {
        get: { summary: 'Daily time-series from rollups', security: [{ bearer: ['read:analytics'] }], parameters: [{ name: 'metric', in: 'query', required: true, schema: { type: 'string', enum: ['users.total', 'users.new', 'content.total', 'content.new', 'content.views', 'content.likes', 'content.comments'] } }, { name: 'interval', in: 'query', schema: { type: 'string', enum: ['day', 'week', 'month'] } }, { name: 'from', in: 'query', schema: { type: 'string', format: 'date' } }, { name: 'to', in: 'query', schema: { type: 'string', format: 'date' } }], responses: { '200': { description: 'OK', content: { 'application/json': { schema: { type: 'object' } } } } } },
      },
      '/metrics/federation': {
        get: { summary: 'Federation reach (opt-in; read:federation)', security: [{ bearer: ['read:federation'] }], parameters: [{ name: 'limit', in: 'query', schema: { type: 'integer' } }], responses: { '200': { description: 'OK', content: { 'application/json': { schema: { type: 'object' } } } }, '404': { description: 'Federation reach metrics not enabled', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } } } },
      },
      // Audience metrics (persona). STATIC entries, deliberately: the fields an
      // instance counts are per-instance and live at /metrics/persona/fields,
      // while the published contract must read the same everywhere. Generating
      // these from the effective schema would make the spec differ per install.
      // `read:audience` is wildcard protected: a `read:*` key is refused here.
      '/metrics/persona/fields': {
        get: { summary: 'Countable persona fields on this instance (read:audience; not covered by read:*)', security: [{ bearer: ['read:audience'] }], parameters: [{ name: 'limit', in: 'query', schema: { type: 'integer' } }], responses: { '200': { description: 'OK', content: { 'application/json': { schema: { type: 'object' } } } }, '404': { description: 'Persona analytics not enabled', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } } } },
      },
      '/metrics/persona/distribution': {
        get: { summary: 'One persona field distribution, consent-joined, floored to the k-anonymity quantum (read:audience; not covered by read:*)', security: [{ bearer: ['read:audience'] }], parameters: [{ name: 'field', in: 'query', required: true, schema: { type: 'string' } }, { name: 'limit', in: 'query', schema: { type: 'integer' } }], responses: { '200': { description: 'OK', content: { 'application/json': { schema: { type: 'object' } } } }, '400': { description: 'Unknown or non-countable field', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } }, '404': { description: 'Persona analytics not enabled', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } } } },
      },
      '/metrics/persona/links': {
        get: { summary: 'Link platform presence counts (read:audience; not covered by read:*)', security: [{ bearer: ['read:audience'] }], responses: { '200': { description: 'OK', content: { 'application/json': { schema: { type: 'object' } } } }, '404': { description: 'Persona analytics not enabled', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } } } },
      },
      '/metrics/persona/audience': {
        get: { summary: 'Counts of members granting each sharing purpose (read:audience; not covered by read:*)', security: [{ bearer: ['read:audience'] }], responses: { '200': { description: 'OK', content: { 'application/json': { schema: { type: 'object' } } } }, '404': { description: 'Persona analytics or data sharing consents not enabled', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } } } },
      },
      // The opt-in member visibility directory. STATIC, like the persona
      // entries above and for a stronger reason: the filterable fields and the
      // link platforms are per-instance, but a published contract must read the
      // same everywhere or a consumer cannot tell a capability it lacks from an
      // instance that spells it differently. `read:members` is wildcard
      // protected AND requires the key to be bound to a named recipient, so a
      // 403 here means one of two different things and the description says so.
      '/members/open-to/{audience}': {
        get: {
          summary: 'Members who opted in to being found by this audience (read:members; not covered by read:*)',
          description:
            'Consenting, identified members who asked to be findable. Never an email and no contact '
            + 'channel: recipients reach a member through the direct messages any two accounts on the '
            + 'instance already have. Every member returned is written to the instance disclosure log '
            + 'and is visible to that member. The key must carry a recipient binding whose declared '
            + 'purposes cover the audience, otherwise 403.',
          security: [{ bearer: ['read:members'] }],
          parameters: [
            { name: 'audience', in: 'path', required: true, schema: { type: 'string', enum: ['recruiters', 'sponsors'] }, description: 'In this release only "recruiters" can return members. The sponsor purpose copy tells members their interests, tech stack and profile links are shared, and never that their name is, so "sponsors" answers 404 until that copy is widened and every member who agreed is re-asked.' },
            { name: 'interests', in: 'query', schema: { type: 'string' }, description: 'Repeatable or comma-joined option values. Unknown value is a 400.' },
            { name: 'techStack', in: 'query', schema: { type: 'string' }, description: 'Repeatable or comma-joined option values.' },
            { name: 'industry', in: 'query', schema: { type: 'string' }, description: 'Repeatable or comma-joined option values.' },
            { name: 'hasLink', in: 'query', schema: { type: 'string' }, description: 'Link platform keys. ANDed: a member must have all of them.' },
            { name: 'location', in: 'query', schema: { type: 'string' } },
            { name: 'q', in: 'query', schema: { type: 'string' }, description: 'Username or display name search, identical to /users.' },
            { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 50 }, description: 'Capped at 50, lower than the metrics family: these are people.' },
            { name: 'offset', in: 'query', schema: { type: 'integer', minimum: 0 } },
          ],
          responses: {
            '200': {
              description: 'OK. Every item is also a logged disclosure.',
              content: {
                'application/json': {
                  schema: {
                    allOf: [
                      paginated('#/components/schemas/OpenMember'),
                      {
                        type: 'object',
                        required: ['disclosed'],
                        properties: {
                          disclosed: { type: 'integer', description: 'Disclosure rows written for this response. Always equals items.length.' },
                        },
                      },
                    ],
                  },
                },
              },
            },
            '400': { description: 'Unknown filter field, unknown option value, or a malformed parameter', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            '403': { description: 'Missing read:members, or the key is not bound to a recipient declared for this audience', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            '404': { description: 'Unknown audience, the directory is not enabled, or the audience purpose does not cover disclosing identity', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
      },
      '/openapi.json': {
        get: { summary: 'This OpenAPI spec', responses: { '200': { description: 'OK' } } },
      },
    },
  };
});
