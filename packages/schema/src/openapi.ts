/**
 * OpenAPI 3.1 spec generator from Zod schemas.
 *
 * Converts the project's Zod validators into a machine-readable OpenAPI spec.
 * Run with: npx tsx packages/schema/src/openapi.ts > docs/openapi.json
 */
import { z } from 'zod';
import * as validators from './validators.js';

interface OpenAPISchema {
  type?: string;
  format?: string;
  properties?: Record<string, OpenAPISchema>;
  required?: string[];
  items?: OpenAPISchema;
  enum?: string[];
  description?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  default?: unknown;
  oneOf?: OpenAPISchema[];
  nullable?: boolean;
}

interface OpenAPIEndpoint {
  summary: string;
  tags: string[];
  requestBody?: { content: { 'application/json': { schema: { $ref: string } } } };
  responses: Record<string, { description: string; content?: { 'application/json': { schema: OpenAPISchema } } }>;
  security?: Array<Record<string, string[]>>;
  parameters?: Array<{
    name: string;
    in: string;
    required: boolean;
    schema: OpenAPISchema;
  }>;
}

function zodToOpenAPI(schema: z.ZodType): OpenAPISchema {
  if (schema instanceof z.ZodString) {
    const result: OpenAPISchema = { type: 'string' };
    for (const check of (schema as unknown as { _zod: { def: { checks?: Array<{ kind: string; value?: unknown }> } } })._zod?.def?.checks ?? []) {
      if (check.kind === 'min') result.minLength = check.value as number;
      if (check.kind === 'max') result.maxLength = check.value as number;
      if (check.kind === 'email') result.format = 'email';
      if (check.kind === 'url') result.format = 'uri';
      if (check.kind === 'uuid') result.format = 'uuid';
      if (check.kind === 'datetime') result.format = 'date-time';
      if (check.kind === 'regex') result.format = 'pattern';
    }
    return result;
  }

  if (schema instanceof z.ZodNumber) {
    const result: OpenAPISchema = { type: 'number' };
    for (const check of (schema as unknown as { _zod: { def: { checks?: Array<{ kind: string; value?: unknown }> } } })._zod?.def?.checks ?? []) {
      if (check.kind === 'min') result.minimum = check.value as number;
      if (check.kind === 'max') result.maximum = check.value as number;
      if (check.kind === 'int') result.type = 'integer';
    }
    return result;
  }

  if (schema instanceof z.ZodBoolean) {
    return { type: 'boolean' };
  }

  if (schema instanceof z.ZodEnum) {
    const values = (schema as unknown as { _zod: { def: { entries: Record<string, string> } } })._zod?.def?.entries;
    return {
      type: 'string',
      enum: values ? Object.values(values) : [],
    };
  }

  if (schema instanceof z.ZodArray) {
    const inner = (schema as unknown as { _zod: { def: { type: z.ZodType } } })._zod?.def?.type;
    return {
      type: 'array',
      items: inner ? zodToOpenAPI(inner) : {},
    };
  }

  if (schema instanceof z.ZodObject) {
    const shape = (schema as unknown as { _zod: { def: { shape: Record<string, z.ZodType> } } })._zod?.def?.shape ?? {};
    const properties: Record<string, OpenAPISchema> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      properties[key] = zodToOpenAPI(value as z.ZodType);
      if (!(value instanceof z.ZodOptional) && !(value instanceof z.ZodDefault)) {
        // Check if it's wrapped in optional/default via preprocess
        const isOptional = (value as unknown as { _zod?: { def?: { optional?: boolean } } })?._zod?.def?.optional;
        if (!isOptional) {
          required.push(key);
        }
      }
    }

    const result: OpenAPISchema = { type: 'object', properties };
    if (required.length > 0) result.required = required;
    return result;
  }

  if (schema instanceof z.ZodOptional) {
    const inner = (schema as unknown as { _zod: { def: { innerType: z.ZodType } } })._zod?.def?.innerType;
    return inner ? zodToOpenAPI(inner) : {};
  }

  if (schema instanceof z.ZodDefault) {
    const inner = (schema as unknown as { _zod: { def: { innerType: z.ZodType } } })._zod?.def?.innerType;
    const result = inner ? zodToOpenAPI(inner) : {};
    const defaultVal = (schema as unknown as { _zod: { def: { defaultValue: unknown } } })._zod?.def?.defaultValue;
    if (defaultVal !== undefined) result.default = defaultVal;
    return result;
  }

  if (schema instanceof z.ZodRecord) {
    return { type: 'object' };
  }

  if (schema instanceof z.ZodUnknown) {
    return {};
  }

  // Fallback for preprocessed types
  return {};
}

/** Map of schema name → Zod validator for generating named schemas */
const schemaMap: Record<string, z.ZodType> = {
  CreateUser: validators.createUserSchema,
  UpdateProfile: validators.updateProfileSchema,
  CreateContent: validators.createContentSchema,
  UpdateContent: validators.updateContentSchema,
  CreateComment: validators.createCommentSchema,
  CreateHub: validators.createHubSchema,
  UpdateHub: validators.updateHubSchema,
  CreatePost: validators.createPostSchema,
  CreateReply: validators.createReplySchema,
  CreateInvite: validators.createInviteSchema,
  BanUser: validators.banUserSchema,
  ChangeRole: validators.changeRoleSchema,
  CreateProduct: validators.createProductSchema,
  UpdateProduct: validators.updateProductSchema,
  AddContentProduct: validators.addContentProductSchema,
  CreateContest: validators.createContestSchema,
  UpdateContest: validators.updateContestSchema,
  JudgeEntry: validators.judgeEntrySchema,
  ContestTransition: validators.contestTransitionSchema,
  CreateVideo: validators.createVideoSchema,
  CreateVideoCategory: validators.createVideoCategorySchema,
  CreateLearningPath: validators.createLearningPathSchema,
  UpdateLearningPath: validators.updateLearningPathSchema,
  CreateModule: validators.createModuleSchema,
  UpdateModule: validators.updateModuleSchema,
  CreateLesson: validators.createLessonSchema,
  UpdateLesson: validators.updateLessonSchema,
  CreateConversation: validators.createConversationSchema,
  SendMessage: validators.sendMessageSchema,
  CreateDocsSite: validators.createDocsSiteSchema,
  UpdateDocsSite: validators.updateDocsSiteSchema,
  CreateDocsPage: validators.createDocsPageSchema,
  UpdateDocsPage: validators.updateDocsPageSchema,
  CreateDocsVersion: validators.createDocsVersionSchema,
  CreateReport: validators.createReportSchema,
  AdminSetting: validators.adminSettingSchema,
  AdminUpdateRole: validators.adminUpdateRoleSchema,
  AdminUpdateStatus: validators.adminUpdateStatusSchema,
  ResolveReport: validators.resolveReportSchema,
};

/** Endpoint definitions that reference the schemas */
const endpoints: Record<string, Record<string, OpenAPIEndpoint>> = {
  '/api/content': {
    get: { summary: 'List content', tags: ['Content'], responses: { '200': { description: 'Content list' } } },
    post: { summary: 'Create content', tags: ['Content'], security: [{ bearerAuth: [] }], requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateContent' } } } }, responses: { '201': { description: 'Created content' } } },
  },
  '/api/content/{id}': {
    get: { summary: 'Get content by ID', tags: ['Content'], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { '200': { description: 'Content detail' } } },
    put: { summary: 'Update content', tags: ['Content'], security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateContent' } } } }, responses: { '200': { description: 'Updated content' } } },
    delete: { summary: 'Delete content', tags: ['Content'], security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { '200': { description: 'Deleted' } } },
  },
  '/api/content/{id}/publish': {
    post: { summary: 'Publish content', tags: ['Content'], security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { '200': { description: 'Published' } } },
  },
  '/api/content/{id}/report': {
    post: { summary: 'Report content', tags: ['Content', 'Social'], security: [{ bearerAuth: [] }], requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateReport' } } } }, responses: { '200': { description: 'Reported' } } },
  },
  '/api/content/{id}/products': {
    get: { summary: 'List content products (BOM)', tags: ['Content', 'Products'], responses: { '200': { description: 'Product list' } } },
    post: { summary: 'Add product to BOM', tags: ['Content', 'Products'], security: [{ bearerAuth: [] }], requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/AddContentProduct' } } } }, responses: { '200': { description: 'Added' } } },
  },
  '/api/hubs': {
    get: { summary: 'List hubs', tags: ['Hubs'], responses: { '200': { description: 'Hub list' } } },
    post: { summary: 'Create hub', tags: ['Hubs'], security: [{ bearerAuth: [] }], requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateHub' } } } }, responses: { '201': { description: 'Created hub' } } },
  },
  '/api/hubs/{slug}': {
    get: { summary: 'Get hub by slug', tags: ['Hubs'], parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Hub detail' } } },
    put: { summary: 'Update hub', tags: ['Hubs'], security: [{ bearerAuth: [] }], requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateHub' } } } }, responses: { '200': { description: 'Updated' } } },
  },
  '/api/hubs/{slug}/products': {
    get: { summary: 'List hub products', tags: ['Hubs', 'Products'], responses: { '200': { description: 'Product list' } } },
    post: { summary: 'Add product to hub', tags: ['Hubs', 'Products'], security: [{ bearerAuth: [] }], requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateProduct' } } } }, responses: { '201': { description: 'Created product' } } },
  },
  '/api/products/{slug}': {
    get: { summary: 'Get product by slug', tags: ['Products'], responses: { '200': { description: 'Product detail' } } },
  },
  '/api/products/{id}': {
    put: { summary: 'Update product', tags: ['Products'], security: [{ bearerAuth: [] }], requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateProduct' } } } }, responses: { '200': { description: 'Updated' } } },
    delete: { summary: 'Delete product', tags: ['Products'], security: [{ bearerAuth: [] }], responses: { '200': { description: 'Deleted' } } },
  },
  '/api/contests': {
    get: { summary: 'List contests', tags: ['Contests'], responses: { '200': { description: 'Contest list' } } },
    post: { summary: 'Create contest', tags: ['Contests'], security: [{ bearerAuth: [] }], requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateContest' } } } }, responses: { '201': { description: 'Created' } } },
  },
  '/api/learn': {
    get: { summary: 'List learning paths', tags: ['Learning'], responses: { '200': { description: 'Path list' } } },
    post: { summary: 'Create learning path', tags: ['Learning'], security: [{ bearerAuth: [] }], requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateLearningPath' } } } }, responses: { '201': { description: 'Created' } } },
  },
  '/api/videos': {
    get: { summary: 'List videos', tags: ['Videos'], responses: { '200': { description: 'Video list' } } },
    post: { summary: 'Create video', tags: ['Videos'], security: [{ bearerAuth: [] }], requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateVideo' } } } }, responses: { '201': { description: 'Created' } } },
  },
  '/api/videos/categories': {
    get: { summary: 'List video categories', tags: ['Videos'], responses: { '200': { description: 'Category list' } } },
    post: { summary: 'Create video category (admin)', tags: ['Videos', 'Admin'], security: [{ bearerAuth: [] }], requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateVideoCategory' } } } }, responses: { '201': { description: 'Created' } } },
  },
  '/api/videos/categories/{id}': {
    put: { summary: 'Update video category (admin)', tags: ['Videos', 'Admin'], security: [{ bearerAuth: [] }], responses: { '200': { description: 'Updated' } } },
    delete: { summary: 'Delete video category (admin)', tags: ['Videos', 'Admin'], security: [{ bearerAuth: [] }], responses: { '200': { description: 'Deleted' } } },
  },
  '/api/messages': {
    get: { summary: 'List conversations', tags: ['Messaging'], security: [{ bearerAuth: [] }], responses: { '200': { description: 'Conversation list' } } },
    post: { summary: 'Create conversation', tags: ['Messaging'], security: [{ bearerAuth: [] }], requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateConversation' } } } }, responses: { '201': { description: 'Created' } } },
  },
  '/api/messages/{conversationId}': {
    get: { summary: 'Get messages', tags: ['Messaging'], security: [{ bearerAuth: [] }], responses: { '200': { description: 'Message list' } } },
    post: { summary: 'Send message', tags: ['Messaging'], security: [{ bearerAuth: [] }], requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/SendMessage' } } } }, responses: { '200': { description: 'Sent' } } },
  },
  '/api/messages/{conversationId}/stream': {
    get: { summary: 'Real-time message stream (SSE)', tags: ['Messaging'], security: [{ bearerAuth: [] }], responses: { '200': { description: 'SSE event stream' } } },
  },
  '/api/social/like': {
    get: { summary: 'Check like status', tags: ['Social'], security: [{ bearerAuth: [] }], responses: { '200': { description: 'Like status' } } },
    post: { summary: 'Toggle like', tags: ['Social'], security: [{ bearerAuth: [] }], responses: { '200': { description: 'Toggled' } } },
  },
  '/api/social/comments': {
    get: { summary: 'List comments', tags: ['Social'], responses: { '200': { description: 'Comment list' } } },
    post: { summary: 'Create comment', tags: ['Social'], security: [{ bearerAuth: [] }], requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateComment' } } } }, responses: { '201': { description: 'Created' } } },
  },
  '/api/social/bookmark': {
    post: { summary: 'Toggle bookmark', tags: ['Social'], security: [{ bearerAuth: [] }], responses: { '200': { description: 'Toggled' } } },
  },
  '/api/social/bookmarks': {
    get: { summary: 'List bookmarks', tags: ['Social'], security: [{ bearerAuth: [] }], responses: { '200': { description: 'Bookmark list' } } },
  },
  '/api/users/{username}': {
    get: { summary: 'Get user profile', tags: ['Users'], responses: { '200': { description: 'User profile' } } },
  },
  '/api/users/{username}/follow': {
    post: { summary: 'Follow user', tags: ['Users', 'Social'], security: [{ bearerAuth: [] }], responses: { '200': { description: 'Followed' } } },
    delete: { summary: 'Unfollow user', tags: ['Users', 'Social'], security: [{ bearerAuth: [] }], responses: { '200': { description: 'Unfollowed' } } },
  },
  '/api/profile': {
    get: { summary: 'Get own profile', tags: ['Profile'], security: [{ bearerAuth: [] }], responses: { '200': { description: 'Profile' } } },
    put: { summary: 'Update own profile', tags: ['Profile'], security: [{ bearerAuth: [] }], requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateProfile' } } } }, responses: { '200': { description: 'Updated' } } },
  },
  '/api/files/upload': {
    post: { summary: 'Upload file', tags: ['Files'], security: [{ bearerAuth: [] }], responses: { '200': { description: 'Upload result' } } },
  },
  '/api/files/mine': {
    get: { summary: 'List my files', tags: ['Files'], security: [{ bearerAuth: [] }], responses: { '200': { description: 'File list' } } },
  },
  '/api/notifications/stream': {
    get: { summary: 'Notification stream (SSE)', tags: ['Notifications'], security: [{ bearerAuth: [] }], responses: { '200': { description: 'SSE stream' } } },
  },
  '/api/search': {
    get: { summary: 'Global search', tags: ['Search'], parameters: [{ name: 'q', in: 'query', required: false, schema: { type: 'string' } }, { name: 'type', in: 'query', required: false, schema: { type: 'string' } }, { name: 'limit', in: 'query', required: false, schema: { type: 'integer' } }, { name: 'offset', in: 'query', required: false, schema: { type: 'integer' } }], responses: { '200': { description: 'Search results' } } },
  },
  '/api/health': {
    get: { summary: 'Health check', tags: ['System'], responses: { '200': { description: 'OK' } } },
  },
  '/api/docs/{siteSlug}': {
    get: { summary: 'Get docs site', tags: ['Docs'], responses: { '200': { description: 'Docs site' } } },
    put: { summary: 'Update docs site', tags: ['Docs'], security: [{ bearerAuth: [] }], requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateDocsSite' } } } }, responses: { '200': { description: 'Updated' } } },
  },
  '/api/admin/users': {
    get: { summary: 'List users (admin)', tags: ['Admin'], security: [{ bearerAuth: [] }], responses: { '200': { description: 'User list' } } },
  },
  '/api/admin/stats': {
    get: { summary: 'Instance stats (admin)', tags: ['Admin'], security: [{ bearerAuth: [] }], responses: { '200': { description: 'Stats' } } },
  },
  '/api/admin/settings': {
    get: { summary: 'Get settings (admin)', tags: ['Admin'], security: [{ bearerAuth: [] }], responses: { '200': { description: 'Settings' } } },
    put: { summary: 'Update settings (admin)', tags: ['Admin'], security: [{ bearerAuth: [] }], requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/AdminSetting' } } } }, responses: { '200': { description: 'Updated' } } },
  },
};

export function generateOpenAPISpec(): Record<string, unknown> {
  // Build component schemas from Zod validators
  const schemas: Record<string, OpenAPISchema> = {};
  for (const [name, zodSchema] of Object.entries(schemaMap)) {
    schemas[name] = zodToOpenAPI(zodSchema);
  }

  return {
    openapi: '3.1.0',
    info: {
      title: 'CommonPub API',
      description: 'Open ActivityPub federation protocol for self-hosted maker communities.',
      version: '1.0.0',
      license: { name: 'MIT', identifier: 'MIT' },
    },
    servers: [
      { url: 'http://localhost:3000', description: 'Local development' },
    ],
    tags: [
      { name: 'Content', description: 'Content CRUD (projects, articles, blogs, explainers)' },
      { name: 'Hubs', description: 'Community, product, and company hubs' },
      { name: 'Products', description: 'Product catalog and BOM management' },
      { name: 'Contests', description: 'Contest management and judging' },
      { name: 'Learning', description: 'Learning paths, modules, and lessons' },
      { name: 'Videos', description: 'Video content and categories' },
      { name: 'Messaging', description: 'Direct messaging with real-time SSE' },
      { name: 'Social', description: 'Likes, comments, bookmarks, follows' },
      { name: 'Users', description: 'User profiles and discovery' },
      { name: 'Profile', description: 'Authenticated user profile management' },
      { name: 'Files', description: 'File upload and management' },
      { name: 'Notifications', description: 'Notification management and real-time stream' },
      { name: 'Search', description: 'Global search across content types' },
      { name: 'Docs', description: 'Documentation sites' },
      { name: 'Admin', description: 'Instance administration' },
      { name: 'System', description: 'Health checks and system info' },
    ],
    paths: endpoints,
    components: {
      schemas,
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'session',
          description: 'Better Auth session cookie or bearer token',
        },
      },
    },
  };
}

// CLI entry point — run with: npx tsx packages/schema/src/openapi.ts
if (typeof process !== 'undefined' && process.argv[1]?.endsWith('openapi.ts')) {
  const spec = generateOpenAPISpec();
  console.log(JSON.stringify(spec, null, 2));
}
