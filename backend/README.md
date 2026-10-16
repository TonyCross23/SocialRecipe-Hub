# SocialRecipe Hub Backend

Production-oriented REST API built with Node.js, TypeScript, Express, PostgreSQL, Prisma, Zod, JWT, and Argon2id.

## Features

- Registration, login, current user, logout, and single-use refresh-token rotation
- Database-backed roles and granular permissions
- Follow/unfollow plus paginated follower and following lists
- Public, follower-only, and private posts
- Text-only posts or up to 10 HTTPS image URLs
- Feed, comments, replies, post/comment likes, and share counting
- User reports and moderator review
- Admin-managed moderation settings and banned keywords
- Durable moderation jobs with an optional OpenAI background worker
- OpenAPI 3.1 and interactive Swagger UI

## Project layout

```text
src/
  app.ts                         Express app and global middleware
  server.ts                      Process startup and graceful shutdown
  container.ts                   Dependency wiring
  config.ts                      Environment validation
  database.ts                    Prisma connection
  errors.ts                      Shared application errors
  openapi.ts                     Swagger/OpenAPI document
  routes/                        Root, health, and documentation routers
  features/
    auth/
      controllers/               HTTP input/output
      dto/                       Strict Zod schemas
      infrastructure/            Prisma repository
      services/                  Password and JWT implementations
      use-cases/                 Authentication business rules
      auth.middleware.ts         Authentication and permission guards
      auth.routes.ts             Auth router
      auth.types.ts              Feature ports and types
    social/                      Follow APIs with the same feature layers
    posts/                       Posts, feed, comments, likes, and shares
    moderation/                  Reports, policies, AI jobs, and worker
prisma/
  schema.prisma                  Database models
  migrations/                    Versioned PostgreSQL changes
  seed.ts                        Default roles, permissions, and policies
tests/                           Unit and PostgreSQL integration tests
```

Each feature owns its controller, DTO, service, use case, infrastructure, router, and types. `src/app.ts` assembles HTTP middleware and top-level routers. `src/container.ts` creates concrete dependencies.

## Run everything with Docker

From the `backend` directory:

```sh
cp .env.docker.example .env.docker
npm run docker:env
docker compose --env-file .env.docker up --build -d
docker compose --env-file .env.docker ps
```

`npm run docker:env` generates two different secure JWT secrets. This fixes the `Generate a random JWT secret` startup error caused by example placeholder values.

Compose starts PostgreSQL, runs migrations, seeds roles and policies, and starts the API. Open:

- API: [http://localhost:4000/api/v1](http://localhost:4000/api/v1)
- Swagger: [http://localhost:4000/api-docs/](http://localhost:4000/api-docs/)
- Admin web: [http://localhost:3000](http://localhost:3000)
- OpenAPI JSON: [http://localhost:4000/api-docs/openapi.json](http://localhost:4000/api-docs/openapi.json)
- Health: [http://localhost:4000/health/ready](http://localhost:4000/health/ready)

Useful commands:

```sh
docker compose --env-file .env.docker logs -f api
docker compose --env-file .env.docker down
```

The normal `down` command preserves PostgreSQL data. Add `--volumes` only when you intentionally want to erase the local database.

### Create an administrator

Register a normal account first, then promote it using its email:

```sh
docker compose --env-file .env.docker run --rm seed \
  npm run admin:promote -- admin@example.com
```

Log in at [http://localhost:3000](http://localhost:3000). No default admin password is created or stored in the repository.

## Run locally

Requirements: Node.js 22.12 or newer and PostgreSQL.

```sh
npm ci
cp .env.example .env
```

Generate two different secrets and place them in `.env`:

```sh
openssl rand -hex 48
openssl rand -hex 48
```

Prepare the database and start the API:

```sh
npm run db:generate
npm run db:deploy
npm run db:seed
npm run dev
```

Production build:

```sh
npm run build
npm start
```

## API routes

All feature routes require `Authorization: Bearer ACCESS_TOKEN`, except registration, login, and refresh.

| Method     | Route                                             | Purpose                          |
| ---------- | ------------------------------------------------- | -------------------------------- |
| POST       | `/api/v1/auth/register`                           | Register a member                |
| POST       | `/api/v1/auth/login`                              | Log in                           |
| POST       | `/api/v1/auth/refresh`                            | Rotate access and refresh tokens |
| GET        | `/api/v1/auth/me`                                 | Get the current user             |
| POST       | `/api/v1/auth/logout`                             | Revoke the current session       |
| PUT/DELETE | `/api/v1/social/users/:userId/follow`             | Follow or unfollow               |
| GET        | `/api/v1/social/users/:userId/followers`          | Paginated followers              |
| GET        | `/api/v1/social/users/:userId/following`          | Paginated following              |
| POST       | `/api/v1/posts`                                   | Create a post                    |
| GET        | `/api/v1/posts/feed`                              | Get the permitted feed           |
| PUT/DELETE | `/api/v1/posts/:postId/likes`                     | Like or unlike a post            |
| GET/POST   | `/api/v1/posts/:postId/comments`                  | List or create comments          |
| PUT/DELETE | `/api/v1/posts/:postId/comments/:commentId/likes` | Like/unlike a comment            |
| POST       | `/api/v1/posts/:postId/share`                     | Increment shares                 |
| POST       | `/api/v1/reports`                                 | Report one post or comment       |
| GET/PATCH  | `/api/v1/moderation/reports...`                   | Moderator report review          |
| POST       | `/api/v1/moderation/reports/:reportId/action`     | Ban reported content or dismiss  |
| GET/PUT    | `/api/v1/moderation/policies...`                  | Admin policy management          |
| GET        | `/api/v1/admin/dashboard`                         | Admin business metrics           |
| GET        | `/api/v1/admin/users`                             | Paginated user directory         |
| PATCH/DELETE | `/api/v1/admin/users/:userId/ban`               | Ban or restore a user account    |
| GET/PATCH  | `/api/v1/admin/notifications...`                  | Admin notification inbox         |
| GET        | `/api/v1/admin/monitoring`                        | Visual monitoring data           |
| GET/POST   | `/api/v1/admin/audit-logs...`                     | AI decisions and overrides       |
| GET        | `/metrics`                                        | Protected Prometheus metrics     |

Swagger contains request schemas and lets you call protected endpoints with the **Authorize** button.

### Postman

Import `postman/SocialRecipe-Hub.postman_collection.json` into Postman. Run **Register** and then **Login** first. The collection automatically stores access tokens, refresh tokens, and IDs created by post, comment, and report requests.

### Create a post

```json
{
  "title": "Easy noodle recipe",
  "content": "Boil noodles and add the sauce.",
  "images": ["https://cdn.example.com/noodles.jpg"],
  "visibility": "PUBLIC"
}
```

`content` may be empty when at least one image is supplied. `images` may be empty for a text-only post. This API stores image URLs; binary files belong in an object-storage upload flow.

## Moderation

The seed creates these settings:

- `moderation.enabled`: enables creation of AI moderation jobs
- `moderation.bannedKeywords`: immediately flags matching content, case-insensitively
- `moderation.policy`: stores the platform's human-readable moderation policy

Set `OPENAI_API_KEY` to process pending jobs with the OpenAI moderation endpoint. Without a key, the API still applies banned keywords and continues running; pending AI jobs remain durable in PostgreSQL. The worker retries temporary failures and marks content `FLAGGED` when the provider flags it. The default is `omni-moderation-latest`, based on the official [OpenAI moderation model documentation](https://platform.openai.com/docs/models/omni-moderation-latest).

Moderation is seeded as disabled. An admin can enable it through the policy endpoint after configuring the API key.

## Authentication and security

- Passwords use Argon2id and are never returned by the API.
- Public registration always creates a `member`; role fields are rejected.
- Access and refresh JWTs use different secrets.
- Refresh tokens are hashed in PostgreSQL and rotate after every refresh.
- Reusing a consumed refresh token revokes its login session.
- Permissions are read from PostgreSQL on every request, so role changes apply immediately.
- Zod rejects unknown DTO fields and malformed path/query values.
- SQL constraints protect self-follows, invalid likes/reports/jobs, cross-post replies, and negative counters.

## Verify the code

```sh
npm run format
npm run check
```

Unit tests run without a database. PostgreSQL integration tests run when `TEST_DATABASE_URL` targets a database whose name ends in `/socialrecipe_test`:

```sh
docker run --rm -d --name socialrecipe-test-db \
  -e POSTGRES_USER=recipe_test \
  -e POSTGRES_PASSWORD=local_test_only \
  -e POSTGRES_DB=socialrecipe_test \
  -p 127.0.0.1:55439:5432 postgres:17-alpine

DATABASE_URL=postgresql://recipe_test:local_test_only@localhost:55439/socialrecipe_test npm run db:deploy
DATABASE_URL=postgresql://recipe_test:local_test_only@localhost:55439/socialrecipe_test npm run db:seed
TEST_DATABASE_URL=postgresql://recipe_test:local_test_only@localhost:55439/socialrecipe_test npm test
docker stop socialrecipe-test-db
```

For production, provide secrets through a secret manager, terminate HTTPS at a trusted proxy, use a shared rate-limit store for multiple API instances, and run migrations as a deployment job.

## Monitoring

`GET /metrics` exposes Prometheus text metrics for request totals, latency, active requests, memory, CPU, event-loop behavior, and Node.js runtime health. It uses the separate `METRICS_TOKEN` as a Bearer token:

```sh
curl http://localhost:4000/metrics \
  -H 'Authorization: Bearer YOUR_METRICS_TOKEN'
```

The Docker environment helper generates this token in `.env.docker`. The React admin portal uses the authenticated `/api/v1/admin/monitoring` endpoint for visual cards and request charts, so the Prometheus token is never exposed to browser code. Business totals such as users, posts, comments, reports, role distribution, and moderation queue status are returned by `/api/v1/admin/dashboard`.

Report actions and account actions are separate. `BAN_CONTENT` changes a reported post to `BANNED` so it disappears from feeds while its author remains active. Account bans are only performed through `/api/v1/admin/users/:userId/ban` and revoke that user's active sessions.
