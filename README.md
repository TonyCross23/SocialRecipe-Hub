# SocialRecipe Hub

A community recipe platform with an Android/mobile app, a backend API, and an administration portal. Members can share recipes, follow other cooks, save posts, manage shopping lists, and ask AI Cook cooking questions.

This guide explains how to set up the project and use its main features. All commands assume you are in the repository root unless a section says otherwise.

## Project structure

```text
SocialRecipe-Hub/
├── backend/     Express API, TypeScript, Prisma, PostgreSQL, Docker Compose
├── frontend/    React + Vite administration portal
├── mobile/      React Native + Expo app for community members
└── README.md    Setup and usage guide
```

The mobile app uses React Navigation, Zustand, TanStack Query, Zod, and a shared StyleSheet design system. Cloudinary stores uploaded images. The backend calls Groq for AI Cook and sends transactional email through SMTP.

## Requirements

- Node.js 24.3 or newer within the 24.x release line, with npm.
- Docker Engine/Desktop with Docker Compose v2.
- An Android phone with an Expo Go version that supports this project's Expo SDK, or an Android emulator.
- For physical-phone development, the phone and computer must be on the same network.
- Cloudinary credentials for photo uploads and a Groq API key for AI Cook.

The project currently declares Expo SDK **57**. Compare `mobile/package.json` with the SDK version supported by the Expo Go installation on your phone. Docker runs the API, database, admin website, and local email inbox. Expo runs separately on the development computer.

## 1. Start the Docker services

Generate the local Docker environment file:

```sh
node backend/scripts/create-docker-env.mjs
```

This creates `backend/.env.docker` from its example when missing, generates missing JWT/metrics secrets, and preserves existing configured values. Do not overwrite an existing environment file with the example.

Open `backend/.env.docker` in your editor. To allow a physical phone to reach the API, set:

```dotenv
API_BIND_ADDRESS=0.0.0.0
```

Start the services:

```sh
cd backend
docker compose --env-file .env.docker up --build -d
docker compose --env-file .env.docker ps
cd ..
```

Compose starts PostgreSQL, applies migrations, seeds roles/permissions/policies, and starts the API, admin portal, and Mailpit. Seeding can also create an administrator when configured below.

If port `5432` is already occupied, set `POSTGRES_PORT=55432` in `backend/.env.docker`. Docker services still use the internal database port `5432`; local npm commands must use the selected host port in `backend/.env`'s `DATABASE_URL`.

| Service             | Address on the development computer |
| ------------------- | ----------------------------------- |
| Admin portal        | http://localhost:3000               |
| API base URL        | http://localhost:4000/api/v1        |
| API documentation   | http://localhost:4000/api-docs/     |
| API readiness check | http://localhost:4000/health/ready  |
| Mailpit email inbox | http://localhost:8025               |

The admin portal, database, and Mailpit are bound to the computer's loopback interface in the supplied Compose file. Setting `API_BIND_ADDRESS=0.0.0.0` exposes only the API port to the local network; use it on a trusted development network.

## 2. Run the mobile app on Android

Install the mobile dependencies and create its environment file on the first setup:

```sh
cd mobile
npm ci
```

If `mobile/.env` does not exist, copy the example:

```sh
cp .env.example .env
```

Set the API address in `mobile/.env`. Replace the example IP with **your computer's LAN IP**:

```dotenv
EXPO_PUBLIC_API_URL=http://192.168.1.50:4000/api/v1
EXPO_PUBLIC_UPLOAD_PATH=/media/images
```

On Linux, `hostname -I` can help identify the computer's LAN address. Choose the address on the same network as the phone. Do not put `localhost`, `127.0.0.1`, or a Docker service name in a physical phone's API URL.

| Device                             | API base URL                              |
| ---------------------------------- | ----------------------------------------- |
| Physical Android phone             | `http://YOUR_COMPUTER_LAN_IP:4000/api/v1` |
| Standard Android emulator          | `http://10.0.2.2:4000/api/v1`             |
| iOS simulator on the same computer | `http://localhost:4000/api/v1`            |
| Installed app using a deployed API | `https://YOUR_API_HOST/api/v1`            |

Start Expo:

```sh
npm start -- --clear --lan
```

1. Connect the phone and computer to the same Wi-Fi network.
2. Open Expo Go on the phone and scan the QR code printed by Expo.
3. Keep Expo and Docker running while testing the app.
4. Reload Expo Go after application changes. Restart Expo after editing `.env`.

To check connectivity, open `http://YOUR_COMPUTER_LAN_IP:4000/health/ready` in the phone's browser. It must respond successfully before login, registration, and posts can work. If it fails, check the API bind address, computer firewall, Wi-Fi client isolation, and the IP address.

If a previously configured Expo process is already using port 8081, use that process or stop it before starting another one. The API URL and QR code must belong to the same running project.

## 3. Register and verify your email

1. Open **Create account** in the mobile app.
2. Enter **Name, Email, Password, Confirm password, and Date of birth**.
3. Use a password with 12–128 characters and enter the same value in both password fields.
4. Submit the form. The app opens **Verify email**; no account has been created yet.
5. Find the six-digit verification code in the email and enter it in the app.
6. After verification succeeds, sign in with the email and password.

Registration does not ask for a photo. After signing in, use **Profile → Edit profile** to add or change a profile photo.

Verification codes expire after **15 minutes** and allow at most **five incorrect attempts**. **Resend code** becomes available after **60 seconds** and replaces the previous code. Email requests are limited per address and IP. If the original pending request is older than 15 minutes, or the app was closed, return to registration and start again.

### Where to find emails during local development

The default Docker setup uses **Mailpit**. Open http://localhost:8025 on the development computer, select the email addressed to your registration email, and copy its code into the phone.

Mailpit captures messages locally. It does **not** deliver them to Gmail, Outlook, or another real mailbox. A code received only through Mailpit is a development test, not proof of ownership of an external mailbox. Configure a real SMTP service to verify real users' email addresses.

All verification and password-reset email subjects and bodies are **English**, even when the app interface is set to Burmese.

## 4. Use the mobile app

| Area             | How to use it                                                                                                                       |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Home             | Browse posts. Tap the Home tab again to return to the top and reload the feed; scroll down to load more posts.                      |
| Search           | Open the Home search icon, enter a keyword, and select **Posts** or **Users**.                                                      |
| Friends          | Find cooks, open their profiles, and follow or unfollow them.                                                                       |
| Create post      | Write a caption, optionally add photos from the camera/gallery, choose visibility, and tap **Post**. Text-only posts are supported. |
| Recipe details   | Add optional ingredients, quantities, servings, cooking times, and steps while creating/editing a recipe post.                      |
| Like and comment | Use the actions below a post. Open comments to read and write replies.                                                              |
| Share            | Use the post's share action to share it within the community feed.                                                                  |
| Post menu        | Tap **⋯** to save/report a post or manage its author. Owners can edit or delete their own posts.                                    |
| Notifications    | Read activity and use **Follow back** when someone follows you.                                                                     |
| Profile          | View your posts, saved content, account details, follower count, and following count. Tap the connection counts to open the lists.  |
| Shopping lists   | Open your profile's shopping lists; create lists, check off items, and delete lists you own.                                        |
| Settings         | Edit your profile, change your password, switch dark mode, select the app language, and manage blocked/muted users.                 |

Photo uploads require configured Cloudinary credentials. A text-only post can be used to check post creation independently of photo uploads. If posting fails, read the error and keep the draft until the issue is resolved.

### AI Cook

Open AI Cook from the Home header or its composer shortcut. Ask a question using ingredients you have or the name of a dish, then ask follow-up questions in the same conversation. Where available, **Make shopping list** opens an editable ingredient draft; review it before saving.

AI Cook requires a server-side Groq API key. The app sends its selected English/Burmese reply language with the question. Starting a new chat or leaving the screen clears the current conversation; it is not stored as permanent chat history.

### Language and appearance

Choose **English** or **Burmese** from the login language control or **Settings → App language**. The choice is saved on the device. To use the app in English, select **English**; a new installation initially defaults to Burmese.

The language setting translates interface labels and standard activity messages. User posts, names, and administrator-written messages retain their original text. Email messages remain English.

Use the **Dark mode** switch in Settings to change appearance. Before a saved preference exists, appearance follows the device theme.

## 5. Password recovery and banned accounts

### Forgot password

1. On the login screen, tap **Forgot password?**.
2. Enter the registered email address.
3. Read the six-digit code in Mailpit, or in the real inbox when SMTP delivery is configured.
4. Enter the code, a new 12–128 character password, and its confirmation.
5. Sign in again with the new password.

Reset codes expire after 15 minutes, allow five incorrect attempts, and can be used only once. A successful reset signs out previous sessions. Resetting a password does not remove an account ban.

### Ban appeal

On the login screen, open **Account banned? Submit an appeal**. Enter the banned account's email and password, describe the appeal, and submit it. Use **Check appeal status** to read the decision and administrator response.

An administrator reviews requests under **Account appeals** in the web portal. Approval restores access for the matching ban; the member must sign in again afterward. A newer ban is not automatically removed by an older appeal.

## 6. Create and use an administrator account

To create an administrator directly through the seeder, set these values in the ignored `backend/.env.docker` file before starting Docker:

```dotenv
SEED_ADMIN_EMAIL=YOUR_ADMIN_EMAIL
SEED_ADMIN_PASSWORD=YOUR_ADMIN_PASSWORD
SEED_ADMIN_NAME=Administrator
SEED_ADMIN_DOB=2000-01-01
```

Use a 12–128 character password. Replace the placeholder birthday with the correct date. Run from `backend/`:

```sh
docker compose --env-file .env.docker up --build -d
```

The seeder creates the account with a hashed password and the admin role, ready to sign in without mobile registration or an email code. Repeated runs keep one account, ensure its admin role, and preserve its existing password, profile, and ban status. Leaving both email and password empty seeds only roles, permissions, and policies. For a non-Docker backend, put the same settings in `backend/.env` and run `npm run db:seed` from `backend/`.

Alternatively, register and verify a normal account using the mobile app, then promote it from `backend/`:

```sh
docker compose --env-file .env.docker run --rm --no-deps seed \
  npm run admin:promote -- YOUR_REGISTERED_EMAIL
```

Open http://localhost:3000 and sign in with that account's email and password. Promotion changes its role; it does not set or change its password. There is no shared default admin password.

The portal contains the dashboard, users, content reports, account appeals, AI audit logs, policies, and monitoring. Access and available actions depend on account permissions. Review an appeal and provide a response before approving an unban or rejecting the request.

## 7. Configure external services

Keep provider credentials in **`backend/.env.docker` only**. Values prefixed with `EXPO_PUBLIC_` are bundled into the mobile app and must never contain provider secrets.

### Cloudinary image uploads

Set the credentials for your Cloudinary account:

```dotenv
CLOUDINARY_CLOUD_NAME=YOUR_CLOUD_NAME
CLOUDINARY_API_KEY=YOUR_API_KEY
CLOUDINARY_API_SECRET=YOUR_API_SECRET
```

The app sends photos to the authenticated backend upload route. The backend uploads them to Cloudinary and returns HTTPS image URLs for posts and profile photos. Cloudinary is an external hosted service; it does not run inside this Docker stack.

### Groq AI Cook

Set:

```dotenv
GROQ_API_KEY=YOUR_GROQ_API_KEY
GROQ_CHAT_MODEL=YOUR_ENABLED_CHAT_MODEL
```

Use a chat model available to your Groq account. The repository's default model is defined in `backend/.env.docker.example`. The Groq key is used by the API, never by the mobile client directly. AI moderation has separate configuration; see the backend guide.

### Real email delivery through SMTP

Replace the Mailpit SMTP settings with values supplied by your email provider. For a provider using STARTTLS on port 587, the configuration shape is:

```dotenv
SMTP_HOST=YOUR_PROVIDER_SMTP_HOST
SMTP_PORT=587
SMTP_SECURE=false
SMTP_REQUIRE_TLS=true
SMTP_FROM=SocialRecipe <YOUR_VERIFIED_SENDER_EMAIL>
SMTP_USER=YOUR_SMTP_USERNAME
SMTP_PASSWORD=YOUR_SMTP_PASSWORD
```

Follow the provider's required port and sender-verification settings. For implicit TLS, use its supported port and `SMTP_SECURE=true`. The sample sender address is a placeholder; replace it before use.

After changing backend environment values, recreate the API from `backend/`:

```sh
docker compose --env-file .env.docker up -d --no-deps --wait api
```

Real SMTP delivery sends email to the recipient's real inbox instead of capturing it in local Mailpit. Test both registration verification and password reset after switching.

## 8. Stop, restart, and update

Run these commands from `backend/`.

View service status or follow API logs:

```sh
docker compose --env-file .env.docker ps
docker compose --env-file .env.docker logs -f --tail=100 api
```

Stop the Docker stack while preserving database data:

```sh
docker compose --env-file .env.docker down
```

Start it again:

```sh
docker compose --env-file .env.docker up -d
```

After backend or admin frontend code changes, rebuild and start the stack so migrations run before the API:

```sh
docker compose --env-file .env.docker up --build -d
```

PostgreSQL data is stored in the `recipe_data` Docker volume. Removing volumes erases that data. Avoid `down --volumes` unless you deliberately intend to reset the database.

Stop a foreground Expo session with **Ctrl+C** in its terminal.

## 9. Checks for developers

GitHub Actions runs backend checks and the frontend build on pull requests and `master`. AWS deployment can run after successful checks once its repository/environment settings are configured. Vercel handles the frontend through its Git integration. Follow [CI/CD setup](backend/README.md#cicd-with-github-actions) for the SSH settings, deployment directory, and production setup.

From the repository root, install backend development dependencies and generate the Prisma client first. Mobile dependencies should already be installed from the mobile setup above.

```sh
npm --prefix backend ci
npm --prefix backend run db:generate
npm --prefix frontend ci
```

These checks do not require a running phone:

```sh
npm --prefix mobile run typecheck
npm --prefix mobile test
npm --prefix backend run typecheck
npm --prefix backend run lint
npm --prefix frontend run build
```

Backend PostgreSQL integration tests require an **isolated database named `socialrecipe_test`**. Do not point tests at the application's database. See [backend/README.md](backend/README.md) for test database setup and commands.

## 10. Android APK and push notifications

Expo Go is suitable for interactive development. An installable Android APK requires an Expo/EAS account, a linked project, Android signing credentials, and a phone-accessible API URL. Build profiles are included, but an APK is not supplied by this README.

Follow [mobile/README.md](mobile/README.md#installable-android-app-apk) for the EAS build commands. Production builds require an HTTPS backend URL. An APK bundles its JavaScript and does not require Expo/Metro to stay running.

The in-app notification inbox works in Expo Go. Android remote push requires an installed build plus Expo/Firebase configuration; it is disabled by default on the backend. Follow [mobile/PUSH_SETUP.md](mobile/PUSH_SETUP.md) before enabling it.

## Troubleshooting

| Problem                                          | What to check                                                                                                                                                                               |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Expo Go says the project is incompatible         | Match Expo Go's supported SDK with the `expo` dependency in `mobile/package.json`, then restart Expo with `--clear`.                                                                        |
| Login or post requests fail only on the phone    | Check `EXPO_PUBLIC_API_URL`, `API_BIND_ADDRESS`, the computer's LAN IP, same-network connectivity, firewall, and the phone browser readiness check. Restart Expo after environment changes. |
| Verification email is not in a real inbox        | The default setup captures it in Mailpit at http://localhost:8025. Configure real SMTP for external delivery.                                                                               |
| The app says it cannot send a verification email | Check Mailpit/SMTP availability and the API logs. No account is created on email delivery failure.                                                                                          |
| A verification code is rejected                  | Use the latest code for the current registration request. Check expiry and failed-attempt limits; restart registration when necessary.                                                      |
| Photo uploads fail                               | Check the three backend Cloudinary settings and recreate the API. Test a text-only post separately.                                                                                         |
| AI Cook is unavailable                           | Check the backend Groq key, enabled chat model, provider quota, and API logs.                                                                                                               |
| Admin login is forbidden                         | Verify the account first, promote it, and sign in again. Registration alone grants the member role.                                                                                         |
| Push does not arrive in Expo Go                  | Use the in-app inbox, or configure Expo/Firebase and install a native build for remote push.                                                                                                |
| Docker API startup fails                         | Inspect `docker compose --env-file .env.docker ps` and API/migration logs from `backend/`. Generate missing secrets using the environment script.                                           |

## Further documentation

- [Backend setup, API contracts, and tests](backend/README.md)
- [Mobile architecture, features, and Android builds](mobile/README.md)
- [Admin frontend development](frontend/README.md)
- [Android remote push setup](mobile/PUSH_SETUP.md)
