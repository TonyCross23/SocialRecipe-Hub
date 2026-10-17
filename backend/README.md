# SocialRecipe Hub Backend

Production-oriented REST API built with Node.js, TypeScript, Express, PostgreSQL, Prisma, Zod, JWT, and Argon2id.

## Features

- Registration, login, current user, logout, and single-use refresh-token rotation
- Database-backed roles and granular permissions
- Follow/unfollow plus paginated follower and following lists
- Public, follower-only, and private posts
- Text-only posts or up to 10 HTTPS image URLs
- Cloudinary photo uploads from camera/gallery, including pre-registration profile photos
- Feed, comments, replies, post/comment likes, and share counting
- Paginated keyword search: `GET /api/v1/community/search/posts?q=...&page=1&limit=20` searches visible title/content; `GET /api/v1/community/users?q=...` searches active member names
- User reports and moderator review
- Admin-managed moderation settings and banned keywords
- Durable moderation jobs with an optional OpenAI background worker
- OpenAPI 3.1 and interactive Swagger UI

Authenticated `PATCH /api/v1/auth/me` updates the current member's `{name,dob,image}` only. It validates the same name, real birthday and nullable HTTPS-image rules as registration, and rejects extra fields such as user ID, role, password and email. Email/DOB remain excluded from public profiles and post author summaries. No database migration is needed for profile editing.

## Password recovery and ban appeals

Migration `20261017180000_email_verification` adds pending registrations and nullable `User.emailVerifiedAt`. **New registration requires email verification**: `POST /auth/register` accepts only `{name,email,password,dob}`, returns HTTP 202 `{requestId,expiresIn:900,resendAfter:60}`, and creates no user/session. `POST /auth/register/verify` with `{requestId,code}` returns HTTP 201 `{user}` only after a correct code; sign in afterward. `POST /auth/register/resend` accepts `{requestId}` and returns a new code challenge with the same ID. Codes expire after 15 minutes, allow five wrong guesses, have a 60-second resend cooldown, and permit at most three outgoing emails per email address per 15-minute issuance window. Resend is available while the original pending request is under 15 minutes old; otherwise restart registration. SMTP failure returns 503 and disables the pending request. Mail subjects and bodies are always **English**, including when the app uses Burmese.

Pending passwords use Argon2; codes use purpose-separated HMAC digests and are never returned in API responses or logged. An email advisory lock serializes issuance and account creation; only one account can be created from concurrent challenges, and successful verification consumes every pending request for that address and clears pending password/code hashes. Old pending profiles are pruned after 24 hours on the next registration request. Existing users/admin accounts are grandfathered without forcing verification; new self-registered members receive a verification timestamp. Email verification confirms mailbox control only when delivered by a real SMTP service; Mailpit is a local development inbox.

Migration `20261017160000_account_recovery` adds hashed one-use reset challenges and account appeals. `POST /auth/forgot-password` accepts `{email,language?:en|my}` and returns the same generic message plus a random `requestId`, including for unknown emails. The reset code is never returned by the API or stored in clear text. Codes are HMAC-protected, valid for 15 minutes, limited to five guesses, and issuance is bounded per account and IP. `POST /auth/reset-password` accepts `{requestId,code,newPassword}`; a successful transaction consumes active reset challenges and revokes all sessions while preserving ban status. Normal login checks the password before reporting a ban.

Docker includes Mailpit (`axllent/mailpit:v1.27`) with its inbox bound only to **127.0.0.1:8025**. SMTP stays on the internal Docker network at `mailpit:1025`; these emails are captured locally, not delivered to recipients. For internet delivery configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`, `SMTP_USER`, `SMTP_PASSWORD`, and TLS settings (`SMTP_SECURE=true` for implicit TLS, or `SMTP_REQUIRE_TLS=true` for STARTTLS). Keep SMTP credentials in ignored environment files. Do not publish the Mailpit inbox publicly. See [Mailpit Docker documentation](https://mailpit.axllent.org/docs/install/docker/) and [Nodemailer SMTP](https://nodemailer.com/smtp).

`POST /auth/appeals` accepts `{email,password,message}` even when normal sessions are revoked by a ban. Ownership is verified; only banned accounts can submit, pending submissions are deduplicated, and issuance is bounded. `POST /auth/appeals/status` with `{email,password}` returns only that member's current status and latest appeal/admin response. Messages are stored for the admin portal, not sent as external email. Administrators with both `admin:read` and `user:ban` use `GET /admin/appeals?status=PENDING&page=1&limit=20` and `PATCH /admin/appeals/:id` with `{decision:APPROVED|REJECTED,response}`. Review is atomic; a newer ban makes an older appeal STALE instead of unbanning it. All routes are in OpenAPI.

## Recipe library and push

The additive `20261017140000_recipe_library` migration adds private saves, block/mute preferences, private shopping lists, push device registrations/delivery jobs, notification actors and nullable JSON recipe details. Apply it before starting this API version. Existing posts and notifications are preserved.

Authenticated `/api/v1/library` endpoints: `GET /saved`, `PUT|DELETE /saved/:id`; `GET /filters?kind=BLOCK|MUTE`, `GET /filters/:id`, `PUT|DELETE /filters/:userId/:kind`; `GET|POST /shopping-lists`, `GET|DELETE /shopping-lists/:id`, `PATCH /shopping-lists/:id/items/:itemId` with `{checked}`; `POST|DELETE /push-devices` with `{token}`. List endpoints use `page` and `limit` (max50). All resources derive ownership from the authenticated session.

Post create/edit optionally accepts `recipe: {servings, prepMinutes, cookMinutes, ingredients:[{name,quantity:number|null,unit}], steps:string[]}`. Edit `recipe:null` removes it; omission preserves old details. Metadata participates in moderation. Post responses include `recipe` and `savedByCurrentUser`. Saved-list reads recheck visibility. `POST /assistant/shopping-list` with `{source}` returns a validated editable `{draft:{title,items:[{name,quantity}]}}` via Groq JSON mode; it does not write a list. Chat/extraction share a ten-request/minute limit.

Mute suppresses authored feed content and notifications; block restricts both directions, including search, direct profile/post access, likes/comments/shares and relationship lists. Block removes both follows. Preferences can be managed even when the target's profile is hidden.

`PUSH_ENABLED=false` is the default. Enable only after configuring Expo/Firebase credentials and an installed app; optional `EXPO_PUSH_ACCESS_TOKEN` remains server-only. The worker uses a durable per-device outbox, temporary-error backoff, session/visibility checks and receipt polling. It never sends historical notifications on deployment. See `../mobile/PUSH_SETUP.md` for configuration, limitations and actual-device verification. Expo Go cannot receive Android remote pushes.

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

| Method       | Route                                             | Purpose                             |
| ------------ | ------------------------------------------------- | ----------------------------------- |
| POST         | `/api/v1/auth/register`                           | Start email verification (202)      |
| POST         | `/api/v1/auth/register/verify`                    | Verify code and create account      |
| POST         | `/api/v1/auth/register/resend`                    | Resend verification email           |
| POST         | `/api/v1/auth/login`                              | Log in                              |
| POST         | `/api/v1/auth/refresh`                            | Rotate access and refresh tokens    |
| GET          | `/api/v1/auth/me`                                 | Get the current user                |
| POST         | `/api/v1/auth/logout`                             | Revoke the current session          |
| PUT/DELETE   | `/api/v1/social/users/:userId/follow`             | Follow or unfollow                  |
| GET          | `/api/v1/social/users/:userId/followers`          | Paginated followers                 |
| GET          | `/api/v1/social/users/:userId/following`          | Paginated following                 |
| POST         | `/api/v1/posts`                                   | Create a post                       |
| POST         | `/api/v1/media/images`                            | Upload an image to Cloudinary       |
| POST         | `/api/v1/media/registration-images`               | Public, rate-limited profile upload |
| GET          | `/api/v1/posts/feed`                              | Get the permitted feed              |
| PUT/DELETE   | `/api/v1/posts/:postId/likes`                     | Like or unlike a post               |
| GET/POST     | `/api/v1/posts/:postId/comments`                  | List or create comments             |
| PUT/DELETE   | `/api/v1/posts/:postId/comments/:commentId/likes` | Like/unlike a comment               |
| POST         | `/api/v1/posts/:postId/share`                     | Increment shares                    |
| POST         | `/api/v1/reports`                                 | Report one post or comment          |
| GET/PATCH    | `/api/v1/moderation/reports...`                   | Moderator report review             |
| POST         | `/api/v1/moderation/reports/:reportId/action`     | Ban reported content or dismiss     |
| GET/PUT      | `/api/v1/moderation/policies...`                  | Admin policy management             |
| GET          | `/api/v1/admin/dashboard`                         | Admin business metrics              |
| GET          | `/api/v1/admin/users`                             | Paginated user directory            |
| PATCH/DELETE | `/api/v1/admin/users/:userId/ban`                 | Ban or restore a user account       |
| GET/PATCH    | `/api/v1/admin/notifications...`                  | Admin notification inbox            |
| GET          | `/api/v1/admin/monitoring`                        | Visual monitoring data              |
| GET/POST     | `/api/v1/admin/audit-logs...`                     | AI decisions and overrides          |
| GET          | `/metrics`                                        | Protected Prometheus metrics        |

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

`content` may be empty when at least one image is supplied. `images` may be empty for a text-only post. Upload binary images through the Cloudinary flow below, then pass the returned HTTPS URLs here.

### Cloudinary uploads with Docker

Cloudinary is a hosted service: the Dockerized API uploads to your Cloudinary account over HTTPS. No Cloudinary container or unsigned upload preset is required. Put these values from your Cloudinary Console into the ignored `backend/.env.docker` file (for local execution, use `backend/.env`):

```dotenv
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

Keep these credentials on the backend; do not put them in frontend/mobile environment variables. Set all three together. Leaving all three empty keeps the API operational and makes upload routes return `503 UPLOAD_NOT_CONFIGURED`.

Apply changed credentials without deleting the database:

```sh
docker compose --env-file .env.docker up -d api
```

Send authenticated `POST /api/v1/media/images` requests with multipart form field **file**. The response is `{ url, publicId, width, height }`; use `url` in a post's `images` array. Each request uploads one image; the mobile app uploads selected photos sequentially and creates the post after all URLs are available. The endpoint requires `post:create` and permits 30 uploads per user per 15 minutes.

`POST /api/v1/media/registration-images` accepts the same field without authentication so a profile image can be uploaded before registration. Supply its returned `url` as the registration `image`. It permits five requests per IP per hour and 50 per application instance per day. Registered-user assets are stored under `socialrecipe/<user-id>/`; registration assets use `socialrecipe/registration/` and the `registration-upload` tag. These limits are in-memory; use a shared limiter store when running multiple API replicas. Remove the public route if your registration flow does not need images.

Uploads are capped at 10 MiB and four simultaneous requests. The server decodes pixels with Sharp, rejects invalid content and images over 40 megapixels, removes metadata, fits images within 2048×2048, and re-encodes WebP before the signed Cloudinary upload. Raw file paths and client-supplied MIME labels are not trusted. JPEG, PNG, WebP and AVIF are supported; the mobile app converts iPhone HEIC/camera photos to JPEG before uploading. Cloudinary failures return a generic `502` without provider credentials or error details. The Nginx proxy allows multipart requests up to 11 MiB.

Uploads are separate from post/account creation. Files from abandoned registrations or failed posts can remain in Cloudinary; account owners should periodically remove unreferenced assets using `publicId`/registration tags. No automated asset cleanup or deletion endpoint is implemented yet. A live Cloudinary upload requires your own valid credentials; automated tests use an injected storage adapter and real image decoding.

See [Cloudinary's Node upload documentation](https://cloudinary.com/documentation/node_image_and_video_upload).

### Physical-phone development

Set `API_BIND_ADDRESS=0.0.0.0` in `.env.docker` and recreate the API with the Compose command above to make port 4000 reachable on your trusted LAN. The default `127.0.0.1` restricts it to this computer. PostgreSQL and the admin frontend remain bound to localhost. In `mobile/.env`, point `EXPO_PUBLIC_API_URL` to `http://<computer-LAN-IP>:4000/api/v1`, then start the app with `npm start -- --lan`. Connect the phone to the same network and scan the Expo QR in Expo Go. The API URL changes if your computer's LAN IP changes.

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

## Member community APIs

Authenticated members can discover/search active users at `GET /api/v1/community/users?q=&suggested=true&page=1&limit=20`. Results exclude the viewer and banned accounts and contain public name/image, viewer-aware `isFollowing`, and connection/visible-post counts. `GET /community/users/:userId` returns the same public profile; email and DOB are not exposed.

`GET /api/v1/community/users/:userId/posts` returns a paginated profile timeline. The same visibility rules apply as the feed: owners can see private posts, followers can see follower-only posts, and other members see public posts. Banned/deleted posts are excluded.

Member notification endpoints (all scoped to the authenticated user):

- `GET /api/v1/community/notifications?page=1&limit=20`
- `GET /api/v1/community/notifications/unread-count` (count plus latest unread item)
- `PATCH /api/v1/community/notifications/:id/read`
- `PATCH /api/v1/community/notifications/read-all`

Follow and post-like notifications are created transactionally only when a new relationship/like is inserted, so repeated idempotent PUT requests do not create duplicate notifications. Published comments notify the post owner. Self interactions do not notify the actor. The existing Notification table is reused; no schema migration is required. Mobile clients poll every 15 seconds while active; there is no push-delivery service yet.

Post creation accepts up to 256 KiB of JSON so valid 20,000-character Unicode/Burmese text and image URLs do not fail the previous 32 KiB limit. Other JSON routes retain their 32 KiB limit, and post field validation still applies.

## Feed sharing, likes and AI Cook

`POST /api/v1/community/posts/:postId/share` creates a real post owned by the sharing member, accepting optional `content` (up to 2,000 characters) and `visibility`. It references the original public post instead of copying text/images. Re-sharing a share references the original. Original content is hydrated only when visible to each requesting viewer; removed, banned, or inaccessible originals become an unavailable placeholder. Private/follower-only originals cannot be shared. The share caption follows the existing keyword/AI moderation policy. Likes and comments belong to the new post independently. `GET /community/posts/:postId/likes?page=1&limit=20` lists public member information for users who liked a visible post. The legacy `/posts/:postId/share` endpoint remains an external-share counter for older clients.

`POST /api/v1/auth/change-password` requires an authenticated session and `{ currentPassword, newPassword }`. The new password must contain 12–128 characters and differ from the old one. The existing hash must match atomically before update; all sessions are revoked in the same transaction, requiring a new login on every device. Rate limited to five requests per 15 minutes per member.

AI Cook uses `GET /api/v1/assistant/status` and `POST /api/v1/assistant/chat` with `{ messages: [{ role: "user" | "assistant", content: "..." }] }`. History must alternate and finish with a user question (2,000 characters max); at most 13 messages and 18,000 characters total. The app sends bounded history for follow-up questions and does not persist chats. Groq Chat Completions receives the system cooking instructions and bounded user/assistant history; no secrets, model reasoning or provider diagnostics are returned to the phone. Chat is not persisted by this application. Requests are limited to ten per minute per member and 25 seconds. Set `GROQ_API_KEY` and optionally `GROQ_CHAT_MODEL` (default `openai/gpt-oss-120b`) in `.env.docker`, then recreate the API:

```sh
docker compose --env-file .env.docker up -d --no-deps api
```

Never put this key in an `EXPO_PUBLIC_*` variable or a chat message. A missing key returns `503 AI_NOT_CONFIGURED`; the app shows a clear waiting-to-connect state. Real provider output requires a valid Groq key/account with access to the selected model. AI Cook is independent of the optional OpenAI moderation worker.

## Owner post management

`PATCH /api/v1/community/posts/:postId` requires `post:update:own`, ownership and the full `{ title, content, images, visibility, expectedUpdatedAt }` DTO. Use `updatedAt` from the fetched post as the expected version. Stale writes return 409; another user's post returns 404. This route permits 256 KiB JSON for valid Burmese content. Normal posts still require text or photos; share captions allow empty text but cannot add photos or change original attribution. Edits re-run policy moderation; an existing review hold stays in place, and banned/deleted posts cannot be edited.

`DELETE /api/v1/community/posts/:postId` requires `post:delete:own` and ownership. It marks the post DELETED and cancels pending/processing moderation jobs atomically. Repeating deletion of the same owned post returns 204. Old moderation results cannot change edited/deleted content: completion and retries only apply to still-processing jobs, and content/job lock order matches owner mutations. Stored Cloudinary assets remain available for separate retention cleanup.

Comment reads/writes/likes now check the viewer's access to the post. `GET /posts/:postId/comments?sort=newest` returns newest first; the existing default remains oldest first. Pagination remains page/limit with stable createdAt/id ordering.

Groq integration follows the official [Chat Completions reference](https://console.groq.com/docs/api-reference) and [supported model catalog](https://console.groq.com/docs/models). The GPT-OSS model uses low reasoning effort with reasoning omitted from the response. Answers are bounded to 8,000 characters; truncated replies include a continuation hint. Provider/model changes require only backend configuration, not a mobile secret.

The current deployment explicitly uses `GROQ_CHAT_MODEL=qwen/qwen3.8-27b` and `AI_CHAT_LANGUAGE=burmese`. The Groq-hosted Qwen model uses medium reasoning with internal reasoning omitted. Reviewed Burmese cooking vocabulary and complete recipe examples improve wording; unfamiliar ingredient names stay in English instead of invented translations. Follow-up requests reuse conversation history and omit repeated examples to reduce tokens. Their output allowance is 1,200 tokens; new recipe requests allow 2,000. `/assistant/status` reports `replyLanguage: "burmese"` and the app labels the chat accordingly. English and automatic language modes remain configurable. Qwen is a preview model in the [Groq model catalog](https://console.groq.com/docs/model/qwen/qwen3.8-27b); pin/re-evaluate the model for release. Prompt grounding improves the tested cases but does not guarantee every generated recipe or translation is correct. Provider rate limits return a clear Burmese retry message.

Manual Burmese evaluation cases are saved in `tests/fixtures/assistant-burmese-cases.json`. Review meaning, ingredient identity, quantities/units and follow-up continuity; the presence of Myanmar characters alone is not a pass. The deployed LAN API was checked with an unseen tofu/tomato recipe and a two-to-four-person scaling follow-up. Transient Groq limits were observed during repeated probes and are reported explicitly rather than silently switching languages.
