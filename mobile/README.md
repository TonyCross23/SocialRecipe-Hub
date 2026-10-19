# SocialRecipe Hub mobile

Expo managed app for community members, written in strict TypeScript with React Navigation (native stack + five bottom tabs), Zustand, TanStack Query and a shared StyleSheet design system. Requests use the actual contracts in `../backend/src/features`. There are no mock feeds or invented working API routes.

## Start

Use Node.js 22.13+ (22.x), 24.3+ (24.x), or 26+ as required by React Native 0.86.

```sh
cd mobile
npm ci
cp .env.example .env
npm start
```

Start the backend separately using `../backend/README.md`. Set `EXPO_PUBLIC_API_URL` to its `/api/v1` base URL. Android emulator uses `http://10.0.2.2:4000/api/v1`; iOS simulator uses `http://localhost:4000/api/v1`. Physical phones use your development computer's LAN IP on the same network. Use HTTPS for deployed APIs. Public Expo environment values are compiled into the app and must contain no secrets. Restart Metro after changing them. This project uses **Expo SDK 57**, matching the current Android Expo Go release. Install/update Expo Go for SDK 57 from https://expo.dev/go?platform=android&sdkVersion=57&device=true. If Expo Go reports incompatibility, compare the SDK in its error with the `expo` dependency here; its version must match. After changing SDK dependencies, restart Metro with `npm start -- --clear --lan` and scan again. A development build can be used instead of Expo Go.

```sh
npm run typecheck
npm test
npm run format:check
npx expo install --check
npx expo export --platform android --output-dir /tmp/socialrecipe-mobile-export
```

## Feed and global search

Tap the Home tab to scroll to the top and reload the first feed page. Pull-to-refresh also works; there is no separate reload button. Scrolling near the bottom automatically loads the next 20 posts, with a retry footer on failure and an end message after the last page. Refresh cancels any in-flight page load and clears appended pages before requesting the latest first page.

The Home search icon opens global search. Enter a keyword, then select **Posts** (title/content) or **Users** (name). Search is debounced, paginated and uses the backend visibility rules. Results support the same post actions and follow controls as the feed. Empty searches do not request results; keywords are limited to 100 characters. User results omit the current user, banned accounts and private account fields.

Follow notifications include a **Follow back** button. It reads the current relationship from the API and displays **Following** when already followed, including changes made from profiles or search. The button is separate from the notification link so following does not open the profile.

The post **⋯** opens an anchored dropdown with owner Edit/Delete actions or Report for other authors. The menu stays within screen edges, follows the selected theme, and closes on outside taps or Android Back. Delete still requires confirmation.

## Language, recovery and account appeals

Choose **မြန်မာ / English** from the login screen or **Settings → App language**. Selection persists in SecureStore and updates interface labels without resetting navigation or drafts. Burmese is the initial default. User names, posts, recipe ingredients and admin messages remain in their original language; standard notification actions and relative times are localized. AI Cook sends the selected reply language with each question.

**Registration → Verify email** sends a six-digit code after validating name, email, password confirmation and date of birth. No account or session is created until the code is verified. Codes expire in 15 minutes, lock after five wrong attempts, and can be resent after 60 seconds (at most three emails per address in 15 minutes). A resend replaces the previous code. After verification, sign in normally. Pending verification is not persisted on the phone; if the app closes, start registration again. Existing accounts remain usable. Registration and password-reset email subjects and bodies are always **English**, regardless of app language.

**Login → Forgot password?** requests an email with a six-digit code. Enter it with a new 12–128 character password on the Reset password screen. Codes expire after 15 minutes, allow at most five attempts, and are single-use. Reset signs out previous sessions and does not remove a ban. For local Docker use, reset emails arrive at **http://localhost:8025** on the development computer; Mailpit captures them instead of delivering to real inboxes. Configure real SMTP credentials before offering this outside local testing.

**Login → Account banned? Submit an appeal** verifies the banned member's email/password independently of normal sessions. The member can submit a message and later use **Check appeal status** to read an administrator's response. The admin web **Account appeals** page supports permission-protected approve/reject decisions. Approval unbans only the same ban that was appealed; it does not revive previously revoked sessions or override a newer ban. Sign in again after approval.

Create post now uses a safe-area header with a compact Post action, readable caption area, horizontal removable photo previews, and a Photo/Camera/Recipe toolbar. Recipe details open only when requested; normal text/photo posts stay simple.

## Profile and settings

Profile uses a compact identity header, equal-width connection counts and Posts/Saved/About tabs for your own account. Public profiles show posts and a compact follow control; mute/block live in the profile options dropdown. The private About tab contains email, birthday and join date. Settings uses grouped icon rows with direct switches for appearance and push, plus dedicated Edit profile and Change password screens.

Edit profile updates name, birthday and a Cloudinary photo through authenticated `PATCH /auth/me`. Email and permissions cannot be changed through this form. Camera/gallery selection can replace the draft photo, and removal submits `image:null`. Successful saves update the local user and invalidate author/profile caches. Change password retains server verification and revokes existing sessions on success.

## Recipe library, safety and groceries

- Post **⋯ → Save post** saves it privately to your account. Open **Profile → Saved recipes** to revisit it. Deleted, blocked and newly private posts are filtered out when fetched; unsaving is idempotent.
- **Create/Edit → Add recipe details** accepts servings, prep/cook time, ingredient amounts/units and one cooking step per line. A caption or photo is still required. Open **View recipe** on a structured recipe, adjust servings, and add the scaled ingredients to an editable shopping-list draft. Optional amounts stay unspecified rather than being invented. Existing text-only posts remain supported.
- **AI Cook → Make shopping list** extracts ingredients with Groq and opens a reviewable draft. Edit names/amounts before saving. This action shares the chat rate limit and may fail for answers without ingredients. Extracted drafts are not saved automatically.
- **Profile → Shopping lists** stores private lists on the server; checking items persists across sessions/devices. You can create a manual list and delete lists you own.
- Other authors' **⋯ → Mute author / Block author** and profile controls manage visibility. Mute hides authored feed posts and notifications while keeping direct profile access. Block hides both users' profiles/posts/interactions and removes both follow links. **Settings → Blocked & muted users** reverses these preferences; unblocking does not restore follows.
- **Settings → Push notifications** connects an installed app to Expo Push. Expo Go retains its in-app inbox. See [PUSH_SETUP.md](PUSH_SETUP.md) for the required Expo/Firebase configuration and physical-device verification; remote push is not configured yet.

## Installable Android app (APK)

`eas.json` includes a `preview` profile producing an installable APK and a `production` profile producing a Play Store AAB. The cloud build requires an Expo account; Java/Android SDK are not required on this computer. The APK bundles its JavaScript and does not need Metro running.

```sh
cd mobile
npx eas-cli login
npx eas-cli init
```

Configure the API URL in the EAS **preview** environment. Local `.env` files are excluded from the build upload so a developer's emulator address is not accidentally shipped. For example, replace the example host with your real backend:

```sh
npx eas-cli env:create --environment preview --name EXPO_PUBLIC_API_URL --value https://YOUR_BACKEND_HOST/api/v1 --visibility plaintext
npm run build:apk
```

For a same-network test APK, an HTTP LAN URL such as `http://192.168.1.50:4000/api/v1` is supported by the preview manifest configuration. The phone must remain on that network. Production requires HTTPS. Cloud builds reject missing API URLs, emulator addresses, and localhost. Configure upload paths in the same EAS environment if those backend services exist.

On the first build, EAS prompts to generate an Android signing keystore. Preserve that keystore for future updates. When the build completes, EAS returns the APK download URL; open it on the Android phone to install. No store submission is performed by these scripts. See [Expo's APK build instructions](https://docs.expo.dev/build-reference/apk/).

The repository contains build configuration, **not a generated APK**. Creating the APK still requires the build tool download, Expo login/project setup, a reachable backend URL, and a successful cloud build.

## CI/CD: APK delivery to Telegram

`.github/workflows/ci-cd.yml` runs backend checks, the frontend build, and mobile TypeScript/tests/Android JavaScript bundling on pull requests and `master`. After all three jobs succeed on a **push to `master`**, it builds the signed APK using the existing EAS `preview` profile, downloads that build's APK, saves it in GitHub Actions artifacts for 14 days, and sends it to your Telegram chat. The APK script checks that the EAS result belongs to the same Git commit. No APK is built or sent for pull requests. AWS deployment is not in the workflow.

You can also use **Actions → CI and Android APK → Run workflow** on `master`. Leave `build_apk` checked to distribute an APK, or uncheck it to run checks only. EAS queue/build time is included in the job's 180-minute timeout. EAS build usage is charged against your Expo account's quota/plan. Canceling a GitHub run may leave its cloud build running; check the Expo build dashboard before retrying.

### 1. Prepare Expo once

The app is configured with Expo project `@tonycross23/social-recipe` and EAS project ID `ad826fc2-6d2e-41e8-8138-3f35ce315689` in `app.json`. Use the Expo account that owns or can access this project. This repository already contains the mobile app; run EAS commands from `mobile/` without creating another Expo app.

Complete the [installable APK setup](#installable-android-app-apk) above and finish one successful interactive preview build before enabling CI distribution. Expo needs an existing project and Android signing keystore for non-interactive builds. Keep the signing credentials so later APKs can update the installed app.

The workflow uses EAS CLI `25.2.0`. From `mobile`, initialize with:

```sh
npx eas-cli@25.2.0 login
npx eas-cli@25.2.0 init --id ad826fc2-6d2e-41e8-8138-3f35ce315689
npx eas-cli@25.2.0 env:create --environment preview --name EXPO_PUBLIC_API_URL --value https://YOUR_BACKEND_HOST/api/v1 --visibility plaintext
npm run build:apk
```

Use a real phone-accessible API URL in the EAS **preview** environment. The placeholder URL in the mobile CI job only checks bundling; it is not used for the installable APK. Local `.env` files are excluded from cloud uploads.

If `eas init` saves `extra.eas.projectId` into app configuration, commit that project ID. If it asks you to configure the dynamic config manually, this app already supports `EXPO_PUBLIC_EAS_PROJECT_ID`: set the UUID locally, add the same public value in EAS's `preview` environment, and add it as a GitHub Actions **repository variable** named `EXPO_PUBLIC_EAS_PROJECT_ID`.

Create an Expo personal access token in **Expo dashboard → Account settings → Access tokens**. Add it to GitHub as `EXPO_TOKEN`. See [Expo CI setup](https://docs.expo.dev/build/building-on-ci/) and [Expo access tokens](https://docs.expo.dev/accounts/programmatic-access/).

### 2. Create a Telegram bot and find your chat ID

1. In Telegram, open the official [@BotFather](https://t.me/BotFather).
2. Send `/newbot`, choose a display name, and choose an available username ending in `bot`, such as `SocialRecipeBuildsBot`.
3. BotFather gives you a token. Save it as the GitHub secret `TELEGRAM_BOT_TOKEN`; do not commit it or put it in an Expo public variable.
4. Open your new bot's chat and press **Start**, then send a message such as `hello`. The bot needs that first message to contact your private chat.
5. Open the following URL privately, replacing the placeholder with your own bot token:

   ```text
   https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates
   ```

6. Find your message under `result` and copy **`message.chat.id`** into the GitHub secret `TELEGRAM_CHAT_ID`. If `result` is empty, send another message to your bot and refresh. The chat ID is the destination chat, not the bot's own ID. For a group, add the bot, send a command mentioning it, and use that group's `message.chat.id` (including its minus sign).

This workflow only sends build files/messages, so you do not need to host a bot server or configure a webhook. Use a new bot for builds if an existing bot already has a webhook/poller; `getUpdates` does not work while a webhook is active. See the [official bot creation tutorial](https://core.telegram.org/bots/tutorial#obtain-your-bot-token) and [getUpdates API](https://core.telegram.org/bots/api#getupdates).

### 3. Add GitHub secrets and run

In **GitHub repository → Settings → Secrets and variables → Actions → Secrets**, add these three **repository secrets**:

- `EXPO_TOKEN`: your Expo access token.
- `TELEGRAM_BOT_TOKEN`: the token from BotFather.
- `TELEGRAM_CHAT_ID`: the destination private/group chat ID.

Push the workflow and app changes to `master` after Expo/signing setup is complete. All checks must pass before the APK job starts. Missing secrets stop that job before starting a cloud build. Distribution secrets are supplied only to the steps that need them.

Telegram's hosted Bot API accepts document uploads up to **50 MB**. The workflow sends `SocialRecipe-Hub.apk` directly when it fits. For larger APKs (or a Telegram size rejection), it sends the exact EAS APK download link instead; the APK remains available in the run's GitHub artifacts too. APK links are shared with everyone in the selected chat and follow Expo's artifact availability/access settings. A failed Telegram request fails the job instead of reporting successful delivery. See [Telegram sendDocument limits](https://core.telegram.org/bots/api#senddocument).

## Structure

```text
App.tsx                         Session restoration, providers, splash/retry
src/
  api/
    client.ts                   HTTP, errors, timeout, one concurrent refresh
    types.ts                    Existing backend response contracts
    recipes.ts                  Auth, posts, comments, follows, reports
    media.ts                    Backend Cloudinary upload + native JPEG conversion
    assistant.ts                Validated conversational Groq adapter
  store/session.ts              Zustand + SecureStore refresh token
  lib/                          Query defaults, Zod form schemas
  hooks/                        Paginated users, camera/gallery selection
  navigation/                   Typed native stack and bottom tabs
  components/                   Design system, post cards, follow/report/media
  screens/
    AuthScreen.tsx              Login/register, password confirmation, native DOB picker
    FeedScreen.tsx              Pagination, carousel, likes, feed sharing
    ProfileScreen.tsx           Own posts, details, counts, public profiles
    PeopleScreen.tsx            Search, discover, followers and following
    NotificationsScreen.tsx     Activity inbox, unread state, mark read
    SettingsScreen.tsx          Dark mode switch, change password, sign out
    ConnectionsScreen.tsx       Followers/following lists, follow/unfollow
    CreatePostScreen.tsx        Text-only or up to ten photos, visibility
    CommentsScreen.tsx          Paginated comments, creation, reports
    AssistantScreen.tsx         Groq chat, follow-up questions, new chat
tests/                          Validation and authenticated request tests
```

## Profile and social API

Own details come from `GET /auth/me`. Counts come from the `pagination.total` of `GET /social/users/:id/followers` and `/following`, never the number of loaded rows. Lists support pagination, pull to refresh, empty/error/loading states, public profile navigation, and follow/unfollow with `PUT`/`DELETE /social/users/:id/follow`. Mutations refresh connection caches.

Public profile metadata comes from `GET /community/users/:userId`, including viewer-specific `isFollowing` and visible post/follower/following counts. Email and DOB are available only from the signed-in session. My Profile lists real paginated posts through `GET /community/users/:userId/posts`; private posts are included for their owner, and follower-only posts require a follow relationship.

## Social app navigation and appearance

The five tabs are Home, Friends, Create, Notifications and Profile. The AI kitchen opens from the Home header or composer shortcut. Home includes a post composer, community suggestions, image carousels and familiar like/comment/share actions. Friends supports searching members, discovering people, and viewing followers/following with real follow/unfollow controls.

Settings is available from the header or the profile gear. A single Dark mode switch applies to all screens, inputs, cards, modals, navigation and the status bar. On first launch the app follows the device until the switch is used. The preference is stored in SecureStore and restored on launch.

Follow, post-like and published-comment activity creates database-backed notifications for the recipient (self activity is excluded). The Notifications tab supports unread badges, an inbox, individual read and mark-all-read. While the app is active, it checks for activity every 15 seconds and displays a dismissible in-app banner for new activity. This is an **in-app** notification system; it does not implement OS push notifications when the app is closed/backgrounded.

## Post creation and image uploads

`POST /posts` accepts JSON `{ title, content, images, visibility }`. The backend requires a 3–200 character title; the composer derives a title from the first content line (or “Kitchen update” for photo/short updates), text is limited to 20,000 characters, photos to ten HTTPS URLs, and either text or photos must be present. Visibility is `PUBLIC`, `FOLLOWERS`, or `PRIVATE`. The mobile form supports camera/gallery permissions, multi-selection, removal, image previews, a 10 MB per-photo selection limit when size is known, upload progress and retry, and moderation-aware success messaging. It retains the draft after failure and reuses successfully uploaded URLs when retrying in the same mounted screen. Drafts do not survive app termination. Publish stays tappable while the form is incomplete and explains missing fields in an alert/inline error; server/upload failures also display an alert. Valid Burmese/non-ASCII posts are supported by the backend’s 256 KiB post-creation JSON limit.

The backend now provides Cloudinary uploads. Configure `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET` in `backend/.env.docker` (or `backend/.env` for a non-Docker server). Restart/recreate the API after changing them. These values stay on the server; the app contains no Cloudinary secret. Without credentials, the API still runs and upload requests return a recoverable unavailable response.

The mobile environment uses these backend-relative paths:

```dotenv
EXPO_PUBLIC_UPLOAD_PATH=/media/images
EXPO_PUBLIC_REGISTRATION_UPLOAD_PATH=/media/registration-images
```

`POST /media/images` receives authenticated multipart `file` and returns `{ url, publicId, width, height }`. Native image manipulation converts camera/library photos (including HEIC) to JPEG and fits them within 2048 pixels before uploading. The server verifies actual decoded pixels, enforces 10 MiB/40 megapixel limits, removes metadata, and stores optimized WebP images in Cloudinary. The app submits the returned HTTPS URLs to `/posts`, never local `file://` URIs.

Registration asks only for name, email, password, password confirmation and date of birth. It never requests photo access or uploads images. Add or change your photo after signing in through Profile → Edit profile. The legacy public registration upload endpoint remains available for older clients.

Uploads completed before a failed/canceled post or profile edit can become orphaned; automatic storage cleanup is not implemented. The backend lacks post idempotency keys: after a connection timeout, check the feed before retrying to avoid duplicate posts. Automatic mutation retries are disabled.

## AI Cook

The authenticated `/assistant/chat` endpoint uses Groq Chat Completions with server-only `GROQ_API_KEY` and configurable `GROQ_CHAT_MODEL` (default `openai/gpt-oss-120b`). It accepts alternating user/assistant messages and returns `{ "message": "..." }`. The mobile chat retains bounded conversation context for follow-up questions, validates text responses with Zod, and shows provider-unavailable errors without discarding the question. There is no persistent chat storage; New chat or leaving the screen clears context. Configure the key in `backend/.env.docker` and recreate the API. See the backend README for request limits and setup.

## Session and operational behavior

Only the refresh token is persisted in Expo SecureStore; the access token and user are held in memory. A single shared refresh promise prevents concurrent requests from reusing a rotating refresh token. Requests retry once after a successful refresh; network and server failures do not automatically replay writes. Invalid refresh credentials clear the session. Temporary restoration failures retain the token and show retry/sign-in options. Sign-out revokes the server session before clearing local state. Query caches are cleared when the session ends.

Reports accept exactly one post/comment ID and a 10–2,000 character reason. Native device sharing increments the backend share counter after the platform reports a share action; some platforms cannot confirm final delivery.

Before release, verify on physical Android/iOS devices: denied camera/photo permissions, multi-photo selection and upload, date picker, keyboard handling, share composer cancellation, follow changes across both lists, slow/offline session restore, token expiry, flagged posts, and pagination failures. Unit/type/bundle checks do not replace device testing. Live photo upload requires valid Cloudinary credentials. AI chat requires a configured Groq key.

Expo references: [ImagePicker](https://docs.expo.dev/versions/latest/sdk/imagepicker/), [SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/).

### Dependency audit

The installation audit on 2026-10-17 reports 23 transitive findings (7 moderate, 16 high), including Expo/Metro tooling chains through `braces`, `node-forge`, and `uuid`. Compatible `npm audit fix` was applied; those findings remain. The proposed forced fix downgrades Expo to SDK 44, so it was not applied. Recheck the audit and upstream patches before production release.

## Social interactions and chat

Share now opens an in-app composer with an optional caption, audience and an attributed original-post card. It publishes to your feed/profile; it no longer launches the device share sheet. Only public, published originals can be shared. If original access changes, a placeholder replaces its content for affected viewers. Tapping like counts opens a paginated list of people who liked the post. Comments open in a responsive overlay with a capped width for tablets, bounded height, safe-area spacing, keyboard-aware input, an explicit close action and backdrop dismissal. The scrollable list requests newest comments first; the write/send composer remains separate from the list.

Create Post uses a single header Post action, audience selector below your name, a borderless status editor and a photo/camera toolbar. Recipe title is derived from the text rather than requested as a separate field. Multiple images appear in a removable preview grid. Uploads use SDK 57 `expo-file-system` File objects with readable bytes: Expo fetch does not support legacy `{ uri, name, type }` FormData parts. Cloudinary credentials are still required on the backend.

AI Cook is a conversational chat with suggestions, follow-up questions, thinking/error/retry states and New chat. It calls the real authenticated `/assistant/chat` API. `EXPO_PUBLIC_ASSISTANT_PATH` is no longer required. Chat history is in screen memory and clears when the screen unmounts. Questions are sent to Groq; the key stays on the server. The send action is unavailable if the status endpoint reports a missing key.

Settings includes a validated Change password form. A successful change revokes all sessions, clears the local session/cache, and asks the user to sign in again. Password fields are masked; failure retains the form for correction.

Post headers, original-post previews, comments, notifications and the list of people who liked a post display relative time (Just now, 1 min ago, 2 hours ago). A shared clock refreshes labels every 30 seconds while mounted; screen readers receive the full local timestamp. The likes endpoint supplies the actual likedAt timestamp rather than using account creation time.

## Editing and deleting your posts

Your own post menu shows Edit post and Delete post when your role permits those actions. Other posts retain Report. Edit opens a composer for text, photos and audience, reuses uploaded photos on retry, and retains the draft if validation or the request fails. The API checks ownership, permission and the original updatedAt version; stale edits return 409. Share captions can be edited without changing their original attribution. Banned posts cannot be edited, and review-held posts remain held after editing. Delete asks for confirmation and removes the post from feed/profile/detail caches; source content in shares becomes unavailable. Cloudinary image assets are not automatically deleted.

The Like action uses an outlined/filled heart with a count. Zero likes display 0 without a promotional prompt. AI Cook includes Check connection so a newly configured server key can be detected without restarting the app.

AI Cook reads `replyLanguage` from `/assistant/status`. The current server is configured for Burmese answers with Groq Qwen and reviewed cooking vocabulary/examples; the header says “မြန်မာလို မေးမြန်းနိုင်ပါတယ်”. English is no longer forced. Start a New chat after changing the server language to clear older English conversation context. Output quality still depends on the model; uncommon ingredient names may remain in English. Rate-limit and shortened-answer notices are localized for Burmese.
