const bearerSecurity = [{ bearerAuth: [] }];
const json = (schema: object) => ({ 'application/json': { schema } });
const body = (schema: object) => ({ required: true, content: json(schema) });
const ok = (description: string, schema: object = { type: 'object' }) => ({
  description,
  content: json(schema),
});
const protectedOperation = (tag: string, summary: string) => ({
  tags: [tag],
  summary,
  security: bearerSecurity,
  responses: { 200: ok('Successful response'), 401: { description: 'Unauthorized' } },
});

export const openApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'SocialRecipe API',
    version: '1.0.0',
    description: 'Community recipes, social features, RBAC, and moderation API.',
  },
  servers: [{ url: '/', description: 'Current server' }],
  tags: [
    { name: 'System' },
    { name: 'Health' },
    { name: 'Authentication' },
    { name: 'Social' },
    { name: 'Posts' },
    { name: 'Reports' },
    { name: 'Moderation' },
    { name: 'Administration' },
    { name: 'Monitoring' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      PublicUser: {
        type: 'object',
        required: ['id', 'name', 'email', 'dob', 'role', 'status', 'permissions', 'createdAt'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
          image: { type: ['string', 'null'], format: 'uri' },
          dob: { type: 'string', format: 'date' },
          role: { type: 'string' },
          status: { type: 'string', enum: ['ACTIVE', 'BANNED'] },
          bannedReason: { type: ['string', 'null'] },
          permissions: { type: 'array', items: { type: 'string' } },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Pagination: {
        type: 'object',
        properties: {
          page: { type: 'integer' },
          limit: { type: 'integer' },
          total: { type: 'integer' },
          totalPages: { type: 'integer' },
        },
      },
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: { code: { type: 'string' }, message: { type: 'string' } },
          },
        },
      },
    },
  },
  paths: {
    '/api/v1': {
      get: {
        tags: ['System'],
        summary: 'Get API information',
        responses: { 200: ok('API information') },
      },
    },
    '/health/live': {
      get: {
        tags: ['Health'],
        summary: 'Liveness check',
        responses: { 200: ok('API is running') },
      },
    },
    '/health/ready': {
      get: {
        tags: ['Health'],
        summary: 'Database readiness check',
        responses: { 200: ok('API is ready'), 503: { description: 'Unavailable' } },
      },
    },
    '/metrics': {
      get: {
        tags: ['Monitoring'],
        summary: 'Scrape Prometheus metrics',
        description: 'Requires the dedicated METRICS_TOKEN as a Bearer token.',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Prometheus text exposition',
            content: { 'text/plain': { schema: { type: 'string' } } },
          },
          401: { description: 'Invalid metrics token' },
        },
      },
    },
    '/api/v1/auth/register': {
      post: {
        tags: ['Authentication'],
        summary: 'Register a member account',
        requestBody: body({
          type: 'object',
          required: ['name', 'email', 'password', 'dob'],
          additionalProperties: false,
          properties: {
            name: { type: 'string', minLength: 2, maxLength: 100 },
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 12, maxLength: 128 },
            image: { type: ['string', 'null'], format: 'uri' },
            dob: { type: 'string', format: 'date' },
          },
        }),
        responses: {
          201: ok('Account created'),
          400: { description: 'Invalid input' },
          409: { description: 'Email exists' },
        },
      },
    },
    '/api/v1/auth/login': {
      post: {
        tags: ['Authentication'],
        summary: 'Log in',
        requestBody: body({
          type: 'object',
          required: ['email', 'password'],
          properties: { email: { type: 'string', format: 'email' }, password: { type: 'string' } },
        }),
        responses: { 200: ok('Login successful'), 401: { description: 'Invalid credentials' } },
      },
    },
    '/api/v1/auth/refresh': {
      post: {
        tags: ['Authentication'],
        summary: 'Rotate tokens',
        requestBody: body({
          type: 'object',
          required: ['refreshToken'],
          properties: { refreshToken: { type: 'string' } },
        }),
        responses: { 200: ok('Tokens rotated'), 401: { description: 'Invalid refresh token' } },
      },
    },
    '/api/v1/auth/me': { get: protectedOperation('Authentication', 'Get current user') },
    '/api/v1/auth/logout': {
      post: {
        ...protectedOperation('Authentication', 'Log out current session'),
        responses: { 204: { description: 'Logged out' }, 401: { description: 'Unauthorized' } },
      },
    },
    '/api/v1/social/users/{userId}/followers': {
      get: {
        ...protectedOperation('Social', 'List followers'),
        parameters: userPaginationParameters(),
      },
    },
    '/api/v1/social/users/{userId}/following': {
      get: {
        ...protectedOperation('Social', 'List followed users'),
        parameters: userPaginationParameters(),
      },
    },
    '/api/v1/social/users/{userId}/follow': {
      put: { ...protectedOperation('Social', 'Follow a user'), parameters: [uuidPath('userId')] },
      delete: {
        ...protectedOperation('Social', 'Unfollow a user'),
        parameters: [uuidPath('userId')],
      },
    },
    '/api/v1/posts': {
      post: {
        ...protectedOperation('Posts', 'Create a post'),
        requestBody: body({
          type: 'object',
          required: ['title'],
          additionalProperties: false,
          properties: {
            title: { type: 'string', minLength: 3, maxLength: 200 },
            content: { type: 'string', maxLength: 20000 },
            images: { type: 'array', maxItems: 10, items: { type: 'string', format: 'uri' } },
            visibility: { type: 'string', enum: ['PUBLIC', 'FOLLOWERS', 'PRIVATE'] },
          },
        }),
        responses: {
          201: ok('Post created'),
          400: { description: 'Invalid input' },
          401: { description: 'Unauthorized' },
        },
      },
    },
    '/api/v1/posts/feed': {
      get: {
        ...protectedOperation('Posts', 'Get the personalized feed'),
        parameters: paginationParameters(),
      },
    },
    '/api/v1/posts/{postId}/likes': {
      put: { ...protectedOperation('Posts', 'Like a post'), parameters: [uuidPath('postId')] },
      delete: {
        ...protectedOperation('Posts', 'Remove a post like'),
        parameters: [uuidPath('postId')],
      },
    },
    '/api/v1/posts/{postId}/comments': {
      get: {
        ...protectedOperation('Posts', 'List comments'),
        parameters: [uuidPath('postId'), ...paginationParameters()],
      },
      post: {
        ...protectedOperation('Posts', 'Create a comment or reply'),
        parameters: [uuidPath('postId')],
        requestBody: body({
          type: 'object',
          required: ['content'],
          properties: {
            content: { type: 'string', minLength: 1, maxLength: 5000 },
            parentId: { type: ['string', 'null'], format: 'uuid' },
          },
        }),
        responses: {
          201: ok('Comment created'),
          400: { description: 'Invalid input' },
          401: { description: 'Unauthorized' },
        },
      },
    },
    '/api/v1/posts/{postId}/comments/{commentId}/likes': {
      put: {
        ...protectedOperation('Posts', 'Like a comment'),
        parameters: [uuidPath('postId'), uuidPath('commentId')],
      },
      delete: {
        ...protectedOperation('Posts', 'Remove a comment like'),
        parameters: [uuidPath('postId'), uuidPath('commentId')],
      },
    },
    '/api/v1/posts/{postId}/share': {
      post: {
        ...protectedOperation('Posts', 'Increment a post share count'),
        parameters: [uuidPath('postId')],
      },
    },
    '/api/v1/reports': {
      post: {
        ...protectedOperation('Reports', 'Report a post or comment'),
        requestBody: body({
          type: 'object',
          required: ['reason'],
          properties: {
            reason: { type: 'string', minLength: 10, maxLength: 2000 },
            postId: { type: 'string', format: 'uuid' },
            commentId: { type: 'string', format: 'uuid' },
          },
        }),
        responses: {
          201: ok('Report created'),
          400: { description: 'Invalid input' },
          401: { description: 'Unauthorized' },
        },
      },
    },
    '/api/v1/moderation/reports': {
      get: {
        ...protectedOperation('Moderation', 'List reports'),
        parameters: [
          ...paginationParameters(),
          {
            name: 'status',
            in: 'query',
            schema: { type: 'string', enum: ['PENDING', 'REVIEWED', 'DISMISSED', 'ACTIONED'] },
          },
        ],
      },
    },
    '/api/v1/moderation/reports/{reportId}': {
      patch: {
        ...protectedOperation('Moderation', 'Update report status'),
        parameters: [uuidPath('reportId')],
        requestBody: body({
          type: 'object',
          required: ['status'],
          properties: { status: { type: 'string', enum: ['REVIEWED', 'DISMISSED', 'ACTIONED'] } },
        }),
      },
    },
    '/api/v1/moderation/reports/{reportId}/action': {
      post: {
        ...protectedOperation('Moderation', 'Ban reported content or dismiss the report'),
        parameters: [uuidPath('reportId')],
        requestBody: body({
          type: 'object',
          required: ['action', 'reason'],
          additionalProperties: false,
          properties: {
            action: { type: 'string', enum: ['BAN_CONTENT', 'DISMISS'] },
            reason: { type: 'string', minLength: 5, maxLength: 1000 },
          },
        }),
      },
    },
    '/api/v1/moderation/policies': {
      get: protectedOperation('Moderation', 'List moderation policy settings'),
    },
    '/api/v1/moderation/policies/{key}': {
      put: {
        ...protectedOperation('Moderation', 'Update a moderation policy'),
        parameters: [
          {
            name: 'key',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
              enum: ['moderation.enabled', 'moderation.bannedKeywords', 'moderation.policy'],
            },
          },
        ],
        requestBody: body({ type: 'object', required: ['value'], properties: { value: {} } }),
      },
    },
    '/api/v1/admin/dashboard': {
      get: protectedOperation('Administration', 'Get administration dashboard metrics'),
    },
    '/api/v1/admin/users': {
      get: {
        ...protectedOperation('Administration', 'List users'),
        parameters: [
          ...paginationParameters(),
          { name: 'role', in: 'query', schema: { type: 'string' } },
        ],
      },
    },
    '/api/v1/admin/users/{userId}/ban': {
      patch: {
        ...protectedOperation('Administration', 'Ban a user account'),
        parameters: [uuidPath('userId')],
        requestBody: body({
          type: 'object',
          required: ['reason'],
          additionalProperties: false,
          properties: { reason: { type: 'string', minLength: 5, maxLength: 1000 } },
        }),
      },
      delete: {
        ...protectedOperation('Administration', 'Restore a banned user account'),
        parameters: [uuidPath('userId')],
      },
    },
    '/api/v1/admin/monitoring': {
      get: protectedOperation('Monitoring', 'Get live API process health'),
    },
    '/api/v1/admin/audit-logs': {
      get: {
        ...protectedOperation('Administration', 'List AI moderation audit logs'),
        parameters: paginationParameters(),
      },
    },
    '/api/v1/admin/audit-logs/{jobId}/override': {
      post: {
        ...protectedOperation('Administration', 'Override an AI moderation decision'),
        parameters: [uuidPath('jobId')],
        requestBody: body({
          type: 'object',
          required: ['action'],
          additionalProperties: false,
          properties: { action: { type: 'string', enum: ['APPROVE', 'BAN_CONTENT'] } },
        }),
      },
    },
    '/api/v1/admin/notifications': {
      get: {
        ...protectedOperation('Administration', 'List administrator notifications'),
        parameters: [
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100 } },
        ],
      },
    },
    '/api/v1/admin/notifications/read-all': {
      patch: protectedOperation('Administration', 'Mark all notifications as read'),
    },
    '/api/v1/admin/notifications/{notificationId}/read': {
      patch: {
        ...protectedOperation('Administration', 'Mark one notification as read'),
        parameters: [uuidPath('notificationId')],
      },
    },
  },
} as const;

function uuidPath(name: string) {
  return { name, in: 'path', required: true, schema: { type: 'string', format: 'uuid' } } as const;
}

function paginationParameters() {
  return [
    { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
    {
      name: 'limit',
      in: 'query',
      schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
    },
  ] as const;
}

function userPaginationParameters() {
  return [uuidPath('userId'), ...paginationParameters()];
}
