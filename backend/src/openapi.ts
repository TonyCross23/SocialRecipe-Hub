const appealIdentity = {
  type: 'object',
  additionalProperties: false,
  required: ['email', 'password'],
  properties: {
    email: { type: 'string', format: 'email' },
    password: { type: 'string', minLength: 1, maxLength: 128 },
  },
};
const recipeSchema = {
  type: ['object', 'null'],
  additionalProperties: false,
  required: ['servings', 'prepMinutes', 'cookMinutes', 'ingredients', 'steps'],
  properties: {
    servings: { type: 'integer', minimum: 1, maximum: 100 },
    prepMinutes: { type: 'integer', minimum: 0, maximum: 1440 },
    cookMinutes: { type: 'integer', minimum: 0, maximum: 1440 },
    ingredients: {
      type: 'array',
      minItems: 1,
      maxItems: 60,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'quantity', 'unit'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 200 },
          quantity: { type: ['number', 'null'], exclusiveMinimum: 0, maximum: 100000 },
          unit: { type: 'string', maxLength: 50 },
        },
      },
    },
    steps: {
      type: 'array',
      minItems: 1,
      maxItems: 30,
      items: { type: 'string', minLength: 1, maxLength: 2000 },
    },
  },
};
const shoppingSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'items'],
  properties: {
    title: { type: 'string', minLength: 1, maxLength: 200 },
    items: {
      type: 'array',
      minItems: 1,
      maxItems: 60,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'quantity'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 200 },
          quantity: { type: 'string', maxLength: 100 },
        },
      },
    },
  },
};
const pushTokenSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['token'],
  properties: {
    token: {
      type: 'string',
      maxLength: 256,
      pattern: '^(Expo|Exponent)PushToken\\[[A-Za-z0-9_-]+\\]$',
    },
  },
};
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
    { name: 'Media' },
    { name: 'Community' },
    { name: 'Assistant' },
    { name: 'Library' },
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
    '/api/v1/auth/forgot-password': {
      post: {
        tags: ['Authentication'],
        summary: 'Send a single-use reset code; generic response for unknown accounts',
        requestBody: body({
          type: 'object',
          additionalProperties: false,
          required: ['email'],
          properties: {
            email: { type: 'string', format: 'email' },
            language: { type: 'string', enum: ['en', 'my'], default: 'en' },
          },
        }),
        responses: {
          200: ok('Generic message and random requestId; never contains a reset code'),
          429: { description: 'Rate limited' },
        },
      },
    },
    '/api/v1/auth/reset-password': {
      post: {
        tags: ['Authentication'],
        summary: 'Consume an emailed code and replace password, revoking all sessions',
        requestBody: body({
          type: 'object',
          additionalProperties: false,
          required: ['requestId', 'code', 'newPassword'],
          properties: {
            requestId: { type: 'string', format: 'uuid' },
            code: { type: 'string', pattern: '^\\d{6}$' },
            newPassword: { type: 'string', minLength: 12, maxLength: 128 },
          },
        }),
        responses: {
          204: { description: 'Password reset; ban status unchanged' },
          400: { description: 'Invalid, expired, reused or locked code' },
          429: { description: 'Rate limited' },
        },
      },
    },
    '/api/v1/auth/appeals': {
      post: {
        tags: ['Authentication'],
        summary: 'Submit an appeal using banned-owner email/password verification',
        requestBody: body({
          ...appealIdentity,
          required: ['email', 'password', 'message'],
          properties: {
            ...appealIdentity.properties,
            message: { type: 'string', minLength: 20, maxLength: 2000 },
          },
        }),
        responses: {
          201: ok('Submitted or existing pending appeal'),
          401: { description: 'Invalid credentials' },
          409: { description: 'Account is not banned' },
          429: { description: 'Submission limit reached' },
        },
      },
    },
    '/api/v1/auth/appeals/status': {
      post: {
        tags: ['Authentication'],
        summary: 'Read only your own latest appeal and admin response without a session',
        requestBody: body(appealIdentity),
        responses: {
          200: ok('Current account status and latest appeal'),
          401: { description: 'Invalid credentials' },
        },
      },
    },
    '/api/v1/admin/appeals': {
      get: {
        ...protectedOperation(
          'Administration',
          'List account appeals (admin:read and user:ban required)',
        ),
        parameters: [
          ...libraryPagination(),
          {
            name: 'status',
            in: 'query',
            schema: {
              type: 'string',
              enum: ['PENDING', 'APPROVED', 'REJECTED', 'STALE', 'ALL'],
              default: 'PENDING',
            },
          },
        ],
      },
    },
    '/api/v1/admin/appeals/{id}': {
      patch: {
        ...protectedOperation(
          'Administration',
          'Review an appeal and optionally unban the matching ban',
        ),
        parameters: [uuidPath('id')],
        requestBody: body({
          type: 'object',
          additionalProperties: false,
          required: ['decision', 'response'],
          properties: {
            decision: { type: 'string', enum: ['APPROVED', 'REJECTED'] },
            response: { type: 'string', minLength: 1, maxLength: 1000 },
          },
        }),
        description:
          'Newer bans are never removed by an older appeal; stale requests are closed as STALE. Reviewed requests return 409 on a second decision.',
      },
    },

    '/api/v1/library/saved': {
      get: {
        ...protectedOperation('Library', 'List your saved posts that remain visible'),
        parameters: libraryPagination(),
      },
    },
    '/api/v1/library/saved/{id}': {
      put: {
        ...protectedOperation('Library', 'Save a visible post idempotently'),
        parameters: [uuidPath('id')],
      },
      delete: { ...protectedOperation('Library', 'Unsave a post'), parameters: [uuidPath('id')] },
    },
    '/api/v1/library/filters': {
      get: {
        ...protectedOperation('Library', 'List your blocked or muted users'),
        parameters: [
          ...libraryPagination(),
          {
            name: 'kind',
            in: 'query',
            required: true,
            schema: { type: 'string', enum: ['BLOCK', 'MUTE'] },
          },
        ],
      },
    },
    '/api/v1/library/filters/{id}': {
      get: {
        ...protectedOperation('Library', 'Get your block/mute preferences for a user'),
        parameters: [uuidPath('id')],
      },
    },
    '/api/v1/library/filters/{userId}/{kind}': {
      put: {
        ...protectedOperation('Library', 'Block or mute a user; block removes both follows'),
        parameters: filterParameters(),
      },
      delete: {
        ...protectedOperation('Library', 'Unblock or unmute; does not restore follows'),
        parameters: filterParameters(),
      },
    },
    '/api/v1/library/shopping-lists': {
      get: {
        ...protectedOperation('Library', 'List your private shopping lists'),
        parameters: libraryPagination(),
      },
      post: {
        ...protectedOperation('Library', 'Create a private shopping list'),
        requestBody: body(shoppingSchema),
        responses: {
          201: ok('Created list with ordered item IDs'),
          400: { description: 'Invalid list' },
          401: { description: 'Unauthorized' },
        },
      },
    },
    '/api/v1/library/shopping-lists/{id}': {
      get: {
        ...protectedOperation('Library', 'Read your shopping list and checked items'),
        parameters: [uuidPath('id')],
      },
      delete: {
        ...protectedOperation('Library', 'Delete your shopping list'),
        parameters: [uuidPath('id')],
        responses: {
          204: { description: 'Deleted' },
          404: { description: 'List not found or owned by another user' },
        },
      },
    },
    '/api/v1/library/shopping-lists/{id}/items/{itemId}': {
      patch: {
        ...protectedOperation('Library', 'Set checked state on your shopping item'),
        parameters: [uuidPath('id'), uuidPath('itemId')],
        requestBody: body({
          type: 'object',
          additionalProperties: false,
          required: ['checked'],
          properties: { checked: { type: 'boolean' } },
        }),
      },
    },
    '/api/v1/library/push-devices': {
      post: {
        ...protectedOperation('Library', 'Register an Expo push token for the active session'),
        requestBody: body(pushTokenSchema),
        responses: {
          201: ok('Registered device ID'),
          400: { description: 'Invalid token' },
          401: { description: 'Unauthorized' },
        },
      },
      delete: {
        ...protectedOperation('Library', 'Disable this device token for your account'),
        requestBody: body(pushTokenSchema),
        responses: { 204: { description: 'Unregistered' }, 401: { description: 'Unauthorized' } },
      },
    },
    '/api/v1/assistant/shopping-list': {
      post: {
        ...protectedOperation(
          'Assistant',
          'Extract an editable shopping-list draft from a recipe reply',
        ),
        requestBody: body({
          type: 'object',
          additionalProperties: false,
          required: ['source'],
          properties: { source: { type: 'string', minLength: 1, maxLength: 8000 } },
        }),
        responses: {
          200: ok('Draft; nothing saved automatically'),
          422: { description: 'No complete ingredients could be extracted' },
          429: { description: 'Rate limited' },
          503: { description: 'AI not configured' },
        },
      },
    },

    '/api/v1/community/posts/{postId}': {
      patch: {
        ...protectedOperation('Community', 'Edit your own post'),
        parameters: [uuidPath('postId')],
        requestBody: body({
          type: 'object',
          required: ['title', 'content', 'images', 'visibility', 'expectedUpdatedAt'],
          properties: {
            title: { type: 'string', minLength: 3, maxLength: 200 },
            recipe: recipeSchema,
            content: { type: 'string', maxLength: 20000 },
            images: { type: 'array', maxItems: 10, items: { type: 'string', format: 'uri' } },
            visibility: { type: 'string', enum: ['PUBLIC', 'FOLLOWERS', 'PRIVATE'] },
            expectedUpdatedAt: { type: 'string', format: 'date-time' },
          },
        }),
        description:
          'Owner only, optimistic version check. Banned/deleted posts cannot be edited. Changes are moderated; existing review holds remain in effect.',
      },
      delete: {
        ...protectedOperation('Community', 'Delete your own post'),
        parameters: [uuidPath('postId')],
        responses: {
          204: { description: 'Post removed and pending moderation canceled' },
          404: { description: 'Post not found or not owned' },
        },
      },
      get: {
        ...protectedOperation('Community', 'Read a visible post with attributed original'),
        parameters: [uuidPath('postId')],
      },
    },
    '/api/v1/auth/change-password': {
      post: {
        ...protectedOperation('Authentication', 'Change password and revoke all sessions'),
        requestBody: body({
          type: 'object',
          required: ['currentPassword', 'newPassword'],
          additionalProperties: false,
          properties: {
            currentPassword: { type: 'string', maxLength: 128 },
            newPassword: { type: 'string', minLength: 12, maxLength: 128 },
          },
        }),
        responses: {
          204: { description: 'Changed; sign in again on all devices' },
          400: { description: 'Invalid current or new password' },
          401: { description: 'Unauthorized' },
        },
      },
    },
    '/api/v1/community/posts/{postId}/share': {
      post: {
        ...protectedOperation('Community', 'Share a public post to your feed'),
        parameters: [uuidPath('postId')],
        requestBody: body({
          type: 'object',
          properties: {
            content: { type: 'string', maxLength: 2000 },
            visibility: {
              type: 'string',
              enum: ['PUBLIC', 'FOLLOWERS', 'PRIVATE'],
              default: 'PUBLIC',
            },
          },
        }),
        responses: {
          201: ok('New repost id and moderation status'),
          404: { description: 'Source unavailable' },
          409: { description: 'Source cannot be shared' },
        },
      },
    },
    '/api/v1/community/posts/{postId}/likes': {
      get: {
        ...protectedOperation('Community', 'List people who liked a visible post'),
        parameters: [uuidPath('postId'), ...paginationParameters()],
      },
    },
    '/api/v1/assistant/status': {
      get: protectedOperation('Assistant', 'Check whether the server has an AI key'),
    },
    '/api/v1/assistant/chat': {
      post: {
        ...protectedOperation('Assistant', 'Chat with AI Cook using Groq'),
        description:
          'Authenticated; 10 requests per minute per member. Bounded user/assistant history, last message user. Server key only; history not stored by this application.',
        requestBody: body({
          type: 'object',
          required: ['messages'],
          properties: {
            language: { type: 'string', enum: ['en', 'my'] },
            messages: {
              type: 'array',
              minItems: 1,
              maxItems: 13,
              items: {
                type: 'object',
                required: ['role', 'content'],
                properties: {
                  role: { type: 'string', enum: ['user', 'assistant'] },
                  content: { type: 'string', maxLength: 8000 },
                },
              },
            },
          },
        }),
        responses: {
          200: ok('Assistant message'),
          503: { description: 'API key missing' },
          502: { description: 'Provider unavailable' },
          429: { description: 'Rate limited' },
        },
      },
    },
    '/api/v1/community/search/posts': {
      get: {
        ...protectedOperation('Community', 'Search visible posts by keyword'),
        parameters: [
          {
            name: 'q',
            in: 'query',
            required: true,
            schema: { type: 'string', minLength: 1, maxLength: 100 },
          },
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 50 } },
        ],
        description:
          'Case-insensitive title/content search, newest first. Applies the same visibility rules as the feed. Returns paginated post cards including viewer likes and share attribution.',
      },
    },
    '/api/v1/community/users': {
      get: {
        ...protectedOperation('Community', 'Discover active community members'),
        parameters: [
          { name: 'q', in: 'query', schema: { type: 'string', maxLength: 100 } },
          { name: 'suggested', in: 'query', schema: { type: 'string', enum: ['true', 'false'] } },
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 50 } },
        ],
        description:
          'Paginated public profiles with viewer-specific isFollowing and visible-post counts. Excludes the current user and banned accounts. Does not expose email or DOB.',
      },
    },
    '/api/v1/community/users/{userId}': {
      get: {
        ...protectedOperation('Community', 'Get a public profile and relationship'),
        parameters: [
          {
            name: 'userId',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
      },
    },
    '/api/v1/community/users/{userId}/posts': {
      get: {
        ...protectedOperation('Community', 'List a user’s posts visible to the current viewer'),
        parameters: [
          {
            name: 'userId',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 50 } },
        ],
        description:
          'Owners see their private posts; follower-only posts require following; banned/deleted posts are excluded.',
      },
    },
    '/api/v1/community/notifications': {
      get: {
        ...protectedOperation('Community', 'List the current member’s notifications'),
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 50 } },
        ],
      },
    },
    '/api/v1/community/notifications/unread-count': {
      get: protectedOperation('Community', 'Get unread count and latest unread notification'),
    },
    '/api/v1/community/notifications/read-all': {
      patch: protectedOperation('Community', 'Mark the current member’s notifications read'),
    },
    '/api/v1/community/notifications/{id}/read': {
      patch: {
        ...protectedOperation('Community', 'Mark one owned notification read'),
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
      },
    },
    '/api/v1/media/images': {
      post: {
        ...protectedOperation('Media', 'Upload one image to Cloudinary'),
        description:
          'Send one file, up to 10 MiB and 40 megapixels. Requires post:create. Images are decoded, metadata stripped, resized to fit 2048px and stored as WebP.',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['file'],
                properties: { file: { type: 'string', format: 'binary' } },
              },
            },
          },
        },
        responses: {
          201: ok('Uploaded image', {
            type: 'object',
            properties: {
              url: { type: 'string', format: 'uri' },
              publicId: { type: 'string' },
              width: { type: 'integer' },
              height: { type: 'integer' },
            },
          }),
          400: { description: 'Missing or invalid multipart file' },
          401: { description: 'Unauthorized' },
          413: { description: 'Image larger than 10 MiB' },
          415: { description: 'Invalid or unsupported image' },
          429: { description: 'Upload rate limit reached' },
          502: { description: 'Cloudinary upload failed' },
          503: { description: 'Uploads are not configured or busy' },
        },
      },
    },
    '/api/v1/media/registration-images': {
      post: {
        tags: ['Media'],
        summary: 'Upload a profile image before registration',
        description:
          'Public multipart file endpoint: at most 5 uploads per IP per hour and 50 per application instance per day. Legacy upload endpoint; current registration has no photo. Profile photos are updated after signing in. Same image limits as media/images. Requires configured Cloudinary credentials.',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['file'],
                properties: { file: { type: 'string', format: 'binary' } },
              },
            },
          },
        },
        responses: {
          201: ok('Uploaded image URL and metadata'),
          400: { description: 'Invalid upload' },
          413: { description: 'Image too large' },
          415: { description: 'Invalid image' },
          429: { description: 'Rate limited' },
          502: { description: 'Cloudinary failed' },
          503: { description: 'Uploads unavailable' },
        },
      },
    },
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
        summary: 'Send an email verification code; no account is created yet',
        requestBody: body({
          type: 'object',
          required: ['name', 'email', 'password', 'dob'],
          additionalProperties: false,
          properties: {
            name: { type: 'string', minLength: 2, maxLength: 100 },
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 12, maxLength: 128 },
            dob: { type: 'string', format: 'date' },
          },
        }),
        responses: {
          202: ok('Verification email sent: requestId, expiresIn (seconds), resendAfter (seconds)'),
          429: { description: 'Too many verification requests' },
          503: { description: 'Email could not be delivered' },
          400: { description: 'Invalid input' },
          409: { description: 'Email exists' },
        },
      },
    },
    '/api/v1/auth/register/verify': {
      post: {
        tags: ['Authentication'],
        summary: 'Verify a single-use email code and create a member',
        description:
          'Codes expire after 15 minutes and lock after five failed attempts. No session tokens are returned; sign in after verification.',
        requestBody: body({
          type: 'object',
          additionalProperties: false,
          required: ['requestId', 'code'],
          properties: {
            requestId: { type: 'string', format: 'uuid' },
            code: { type: 'string', pattern: '^\\d{6}$' },
          },
        }),
        responses: {
          201: ok('Verified account created'),
          400: { description: 'Invalid, used, locked or expired code' },
          429: { description: 'Rate limited' },
        },
      },
    },
    '/api/v1/auth/register/resend': {
      post: {
        tags: ['Authentication'],
        summary: 'Resend an English email with a new verification code',
        description:
          'Requires the pending request ID. Wait at least 60 seconds; at most three emails per address per 15 minutes. Replaces the old code. Start registration again if the pending request is older than 15 minutes.',
        requestBody: body({
          type: 'object',
          additionalProperties: false,
          required: ['requestId'],
          properties: { requestId: { type: 'string', format: 'uuid' } },
        }),
        responses: {
          200: ok('Code sent: requestId, expiresIn, resendAfter'),
          400: { description: 'Pending request no longer valid' },
          429: { description: 'Wait before resending' },
          503: { description: 'Email could not be delivered' },
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
    '/api/v1/auth/me': {
      get: protectedOperation('Authentication', 'Get current user'),
      patch: {
        ...protectedOperation('Authentication', 'Update your name, private DOB and profile image'),
        requestBody: body({
          type: 'object',
          additionalProperties: false,
          required: ['name', 'dob', 'image'],
          properties: {
            name: { type: 'string', minLength: 2, maxLength: 100 },
            dob: { type: 'string', format: 'date' },
            image: { type: ['string', 'null'], format: 'uri', maxLength: 2048 },
          },
        }),
      },
    },
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
            recipe: recipeSchema,
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

function libraryPagination() {
  return [
    { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
    {
      name: 'limit',
      in: 'query',
      schema: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
    },
  ];
}
function filterParameters() {
  return [
    uuidPath('userId'),
    {
      name: 'kind',
      in: 'path',
      required: true,
      schema: { type: 'string', enum: ['BLOCK', 'MUTE'] },
    },
  ];
}
