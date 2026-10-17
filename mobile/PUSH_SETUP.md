# Android push notification setup

Push registration, permission controls, background delivery and notification taps are implemented. Android remote push is unavailable in Expo Go; use an installed APK or development build. Firebase/Expo credentials have not been supplied, so the server defaults to `PUSH_ENABLED=false`. The in-app notification inbox continues to work.

## Configure Expo and Firebase

1. In `mobile/`, run `npx eas-cli login`, then `npx eas-cli init` to link an Expo project. Preserve the generated `extra.eas.projectId` in `app.json`, or set `EXPO_PUBLIC_EAS_PROJECT_ID` to that project's UUID.
2. Create a Firebase project and register an Android app with package **com.socialrecipe.hub**. Download its `google-services.json` to a private local location. In EAS, create a **file environment variable** named `GOOGLE_SERVICES_JSON` for the `preview` environment, with this file's contents. The app config uses the file path supplied by EAS. For local native builds, set this environment variable to the absolute file path. The downloaded file is ignored by Git.
3. Configure Firebase Cloud Messaging v1 credentials with `npx eas-cli credentials --platform android`. Upload the FCM service account key through the EAS credentials flow. Keep that private service account file outside the repository. It is different from the client `google-services.json` file and is never included in the app.
4. Set `EXPO_PUBLIC_API_URL` in the EAS `preview` environment to the phone-accessible API URL ending in `/api/v1`. A local Docker test can use the computer's LAN IP, on the same Wi-Fi. A deployed API must use HTTPS for the production profile.
5. Run `npm run build:apk`. Install the resulting APK. Adding a notification config plugin requires a new native build; an Expo Go reload alone cannot add remote push.
6. Set `PUSH_ENABLED=true` in the server's ignored `.env.docker`, then recreate the API using `docker compose --env-file .env.docker up -d --no-deps --wait api`. The API image must already include the recipe-library migration/code. No Firebase service account belongs in the API or mobile public environment: Expo stores the FCM credentials.
7. In the installed app, open **Settings → Push notifications** and grant Android notification permission. Sign in to a second account/device and follow or like the first account's post. Background the first app and check its notification. Tap the push to open its post or inbox. Check the inbox/read state independently.

Optional: enable enhanced push security in the Expo project and set the corresponding server-only `EXPO_PUSH_ACCESS_TOKEN`. Never put this token in `EXPO_PUBLIC_*` variables.

## Delivery behavior

The API worker creates per-device deliveries from persisted notifications, claims jobs, retries temporary errors with backoff, and checks Expo receipts after 15 minutes. Invalid device tokens are removed. Existing notifications are marked queued by the migration so deployment does not push old history. Only devices registered before an event receive it. Notifications from blocked/muted users, already-read events, unavailable posts, banned recipients and revoked/expired sessions are skipped. Up to ten device registrations are allowed per account.

Push delivery is at least once: a process crash after sending but before saving its ticket can cause a duplicate. Provider acceptance does not prove a phone displayed it. API logs contain delivery IDs and error codes, not tokens. Inspect `PushDelivery.status`/`lastError` for setup or delivery failures. Test the complete physical-device flow after supplying credentials; mocked server tests do not replace that check.

References: [Expo setup](https://docs.expo.dev/push-notifications/push-notifications-setup/), [FCM credentials](https://docs.expo.dev/push-notifications/fcm-credentials/), [sending and receipts](https://docs.expo.dev/push-notifications/sending-notifications/), [Expo Go limitation](https://docs.expo.dev/push-notifications/faq/).
