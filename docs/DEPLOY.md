# Deploying PartsLogic Companion

Builds run on Expo's servers (EAS Build), so you don't need Android Studio or Xcode. Run every command
below from the repo root on your own computer.

| | Android | iPhone |
|---|---|---|
| How staff get it | A download link or QR code from EAS (an `.apk`) | TestFlight |
| Build profile | `preview` (internal distribution, APK) | `production` (store build) |
| Accounts needed | Expo | Expo, plus an Apple Developer Program membership |
| App ID | `com.eclipseautoparts.partslogic` | `com.eclipseautoparts.partslogic` |

The profiles live in `eas.json`:

| Profile | What it makes | EAS environment |
|---|---|---|
| `preview` | An Android APK you can install straight from a link (`distribution: internal`) | `preview` |
| `production` | Store builds: an Android App Bundle for Google Play and an iOS build for TestFlight or the App Store. The build number goes up automatically | `production` |

## Keys in the build

`.env.local` is git-ignored, so EAS never receives it, and this repo doesn't hold the values either. The
app needs two values, which are stored as **EAS environment variables** (set once, below):

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Both are public by design. They end up inside the app either way, and row-level security protects the
data. A build made without them opens to an error saying which one is missing.

**Never add a secret key, a service-role key or any third-party API key as an `EXPO_PUBLIC_` variable, or
to `eas.json` or `app.json`.** Anything in the app can be read by whoever installs it.

## One-time setup

```bash
npx eas-cli@latest login
npx eas-cli@latest init
```

`init` creates the project on expo.dev and adds `extra.eas.projectId` and `owner` to `app.json`. Commit
that change.

Then store the two values for both environments. Copy them from your `.env.local`:

```bash
npx eas-cli@latest env:set --name EXPO_PUBLIC_SUPABASE_URL --value <url> --environment preview --visibility plaintext
npx eas-cli@latest env:set --name EXPO_PUBLIC_SUPABASE_URL --value <url> --environment production --visibility plaintext
npx eas-cli@latest env:set --name EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY --value <key> --environment preview --visibility plaintext
npx eas-cli@latest env:set --name EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY --value <key> --environment production --visibility plaintext
npx eas-cli@latest env:list --environment preview
```

You can also add them on expo.dev, under the project's **Environment variables** page.

## Android: internal APK

```bash
npx eas-cli@latest build --platform android --profile preview
```

1. The first build asks to generate an Android keystore. Say yes; EAS stores it for you.
2. When the build finishes, the terminal and the build page on expo.dev show an install link and QR code.
3. Send the link to staff. On each phone, open it, download the APK and allow installs from that source
   when Android asks.

To update the app, run the same command again and share the new link. Installing over the top keeps the
phone's data, including anything waiting in the Outbox, because the signing key stays the same.

## iPhone: TestFlight

You need an [Apple Developer Program](https://developer.apple.com/programs/) membership first.

```bash
npx eas-cli@latest build --platform ios --profile production
npx eas-cli@latest submit --platform ios --latest
```

1. The build asks you to sign in to your Apple account, then creates the certificate and provisioning
   profile for you.
2. `submit` creates the app in App Store Connect if it doesn't exist yet and uploads the build. Apple
   then processes it, which usually takes 5 to 15 minutes.
3. In App Store Connect, open the app, go to **TestFlight** and add staff as internal testers (people on
   your App Store Connect team) or create an external group (anyone with an email address; the first
   external build needs a short Beta App Review).
4. Testers install the **TestFlight** app from the App Store and accept the invite.

`app.json` sets `ios.config.usesNonExemptEncryption: false`. The app only uses standard HTTPS and
on-device encryption, so App Store Connect won't ask the export-compliance question for each build.

## Before each release

```bash
npm run typecheck
npm run lint
npm test
npx expo-doctor
```

Then, on a phone with the new build, check the following:

1. Sign in.
2. Pick a location.
3. Scan a barcode in Look up.
4. Receive and count with the signal off.
5. Turn the signal back on and check the Outbox empties.

## Versions

`eas.json` uses `appVersionSource: remote`, so EAS keeps the build numbers (Android `versionCode`, iOS
`buildNumber`), and `production` raises them on every build. The version people see, `1.0.0`, comes from
`version` in `app.json`. Change it there when you want a new visible version.

## Later: the stores

When the app is ready to go beyond staff testing:

- **iPhone:** use the same TestFlight build. In App Store Connect, fill in the listing and submit it for
  review. Apple also offers unlisted distribution for business apps that shouldn't be public.
- **Android:** build an App Bundle with `npx eas-cli@latest build --platform android --profile
  production`, then `npx eas-cli@latest submit --platform android --latest`. Google Play needs the very
  first upload done by hand in the Play Console, plus a service-account key for EAS. Start on Play's
  internal testing track.
