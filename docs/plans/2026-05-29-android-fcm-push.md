# Android FCM Push Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use `- [ ]` checkboxes.
>
> **Testing note:** Push delivery is verified on a **physical Android device** + the Expo Push API; there is no unit-testable surface. The only code change is one config line; the rest are Firebase/EAS console actions only the developer can perform.

**Goal:** Fix the runtime error `Default FirebaseApp is not initialized in this process com.trezo.wallet` so `getExpoPushTokenAsync({ projectId })` returns a token and OS push notifications are delivered on Android.

**Architecture:** `expo-notifications` (no `@react-native-firebase`) + a `google-services.json` baked into the native build (via `android.googleServicesFile`) so the native `FirebaseApp` initializes on-device, **plus** an FCM **V1 service account key** uploaded to EAS so the Expo Push API can authenticate delivery to FCM. A new native build is required.

**Tech Stack:** Expo SDK **54** (`expo ~54.0.33`), `expo-notifications ~0.32.12`, EAS Build, Firebase Cloud Messaging HTTP **v1** (legacy server key is deprecated since 2024-06-20). Package `com.trezo.wallet`, EAS projectId `95fc18a7-8bfb-45e5-a51d-bc853f9ca1e0`.

**Root cause (verified):** No `google-services.json`, no `android.googleServicesFile` in `app.config.ts`, and no FCM V1 service account key in EAS. Two independent gaps: the device can't mint a token (missing `google-services.json` in the build) **and** the Expo Push server can't deliver (missing FCM V1 key). Both must be fixed + a rebuild.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `google-services.json` (at `apps/mobile/`) | Firebase Android config — initializes `FirebaseApp` natively | Add (developer download) |
| `apps/mobile/app.config.ts:32-41` | Register `android.googleServicesFile` | Modify |
| `apps/mobile/.gitignore` | Ignore the service-account private key (NOT google-services.json) | Modify |
| `apps/mobile/src/features/notifications/services/PushNotificationsService.ts:66-72` | (Optional) surface token-failure telemetry beyond `__DEV__` | Modify (optional) |

---

## Task 1: Create Firebase project + download google-services.json (ops)

- [ ] **Step 1:** [Firebase Console](https://console.firebase.google.com) → create/select a project for Trezo.
- [ ] **Step 2:** Add an **Android app** with package name **exactly** `com.trezo.wallet` (must match `app.config.ts` `android.package`; a mismatch causes `MismatchSenderId` at send time).
- [ ] **Step 3:** Download **`google-services.json`**, place it at `apps/mobile/google-services.json`.

No commit yet.

---

## Task 2: Register google-services.json in app.config.ts

**Files:**
- Modify: `apps/mobile/app.config.ts` (the `android` block, lines 32-41)

- [ ] **Step 1:** Add `googleServicesFile` to the `android` block:

```typescript
  android: {
    adaptiveIcon: {
      backgroundColor: "#050505",
      foregroundImage: "./assets/images/icon.png",
    },
    icon: "./assets/images/icon.png",
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    package: "com.trezo.wallet",
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? "./google-services.json",
  },
```

(Using `process.env.GOOGLE_SERVICES_JSON ?? "./google-services.json"` lets EAS inject the file from a secret in CI while falling back to the local path.)

- [ ] **Step 2:** `google-services.json` contains only public identifiers and **may be committed**. Keep it. Do NOT commit the service-account private key (Task 3). Add to `apps/mobile/.gitignore`:

```
# FCM V1 service account private key — never commit
google-service-account*.json
```

- [ ] **Step 3: Verify config resolves**

Run: `cd apps/mobile && npx expo config --type public > /dev/null && echo OK`
Expected: `OK` (config evaluates without error).

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app.config.ts apps/mobile/.gitignore apps/mobile/google-services.json
git commit -m "feat(mobile): wire Firebase google-services.json for Android push"
```

---

## Task 3: Upload FCM V1 service account key to EAS (ops — the most-missed step)

- [ ] **Step 1:** Firebase Console → **Project settings → Service accounts → Generate new private key** → download the JSON (save OUTSIDE the repo, or at a gitignored path).
- [ ] **Step 2:** Run `eas credentials` and select, in order:
  - `Android`
  - `development` (your dev-client profile sends pushes during testing) — repeat later for `production`
  - `Google Service Account`
  - `Manage your Google Service Account Key for Push Notifications (FCM V1)`
  - `Set up a Google Service Account Key for Push Notifications (FCM V1)`
  - `Upload a new service account key` → point to the JSON.
- [ ] **Step 3:** Confirm in the Expo dashboard → Project → Credentials → Android `com.trezo.wallet` → **FCM V1 service account key** shows as set.

No repo change. No commit.

---

## Task 4: Rebuild the dev client (native change — OTA will NOT apply it)

- [ ] **Step 1:** `eas build --profile development --platform android`
- [ ] **Step 2:** Install the resulting build on a **physical Android device with Google Play services** (emulators without Play services cannot mint an FCM token).
- [ ] **Step 3:** Later, for release: `eas build --profile production --platform android` (and upload the FCM V1 key for the `production` profile per Task 3 Step 2).

---

## Task 5: Verify token acquisition + delivery

- [ ] **Step 1:** Launch the new build, grant the notification permission prompt (Android 13+ `POST_NOTIFICATIONS` — the prompt appears because `ensureAndroidChannel()` already creates a channel before requesting permission in `PushNotificationsService.bootstrap`).
- [ ] **Step 2:** Confirm `getExpoPushTokenAsync({ projectId })` no longer throws and a token is upserted into Supabase `device_push_tokens` (check the table for a row with `platform: 'android'`, `enabled: true`).
- [ ] **Step 3:** Trigger an incoming transfer (Plan 1, Task 12) or call the Expo Push API directly:
```bash
curl -H "Content-Type: application/json" -X POST https://exp.host/--/api/v2/push/send \
  -d '{"to":"<ExpoPushToken>","title":"Test","body":"hello"}'
```
Expected: notification arrives on the device (foreground banner via the existing `setNotificationHandler` with `shouldShowBanner: true`; background = system tray).

---

## Task 6 (optional): Stop swallowing token failures silently in production

**Files:**
- Modify: `apps/mobile/src/features/notifications/services/PushNotificationsService.ts:66-72`

The current catch only logs under `__DEV__`, so production token failures are invisible. Optionally route to your telemetry:

- [ ] **Step 1:** Replace the `__DEV__`-only warn with a call to your existing logger/telemetry (keep it non-fatal — still `return null`).
- [ ] **Step 2:** `cd apps/mobile && npx tsc --noEmit && npx expo lint` → no new errors.
- [ ] **Step 3:** `git commit -m "chore(mobile): report push-token acquisition failures in production"`

---

## iOS (separate, optional — not the current problem)

iOS push needs an **APNs key** via a paid Apple Developer account; EAS manages it during `eas credentials`/`eas build`. No `google-services.json` on iOS. Push does not work on the iOS Simulator. Scope as a distinct follow-up.

---

## Self-Review

- **Spec coverage:** the Firebase-not-initialized error (Tasks 1–2,4), undeliverable push (Task 3), rebuild requirement (Task 4), verification (Task 5). ✔
- **Dependency:** in-app notifications + activity do NOT need this (they come from Plan 1's Supabase rows); only OS/remote push needs Tasks 1–4.
- **Most common failure:** doing `google-services.json` but skipping the FCM V1 key upload (Task 3), or not rebuilding (Task 4). Both are called out.
