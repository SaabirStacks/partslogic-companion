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

The app needs two values, kept in the committed **`.env`** file:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

EAS builds and over-the-air updates both read `.env` when they bundle the app. That's why the values live
there rather than in `eas.json`, which only builds read. Both values are public by design: they end up
inside the app either way, and row-level security protects the data. On your own computer, a git-ignored
`.env.local` with the same names overrides `.env`.

Two checks stop an app without these values from reaching anyone. The values used to go missing this
way, and the app then closed as soon as it opened.

| Check | When it runs | What happens |
|---|---|---|
| `npm run check:env` (`scripts/check-public-env.mjs`) | On EAS before every build (the `eas-build-post-install` script), and before every update (`.eas/workflows/update-preview.yml`) | The build or update fails with a message naming the missing value |
| `checkPublicConfig` (`src/lib/config.ts`) | When the app starts | The app shows "PartsLogic isn't set up on this phone" instead of closing |

**Never add a secret key, a service-role key or any third-party API key to `.env`, to an `EXPO_PUBLIC_`
variable, or to `eas.json` or `app.json`.** Anything in the app can be read by whoever installs it.

## One-time setup (done)

The Expo project is **`@prodz/partslogic-mobile`**. `app.json` holds the following, which is what
`eas init` and `eas update:configure` would write:

| Field | Value |
|---|---|
| `owner` | `prodz` |
| `slug` | `partslogic-mobile` |
| `extra.eas.projectId` | the project ID |
| `updates.url` | the address phones check for fixes |

The slug must match the project's slug on expo.dev; the name people see is still **PartsLogic**. On a new
computer you only need `npx eas-cli@latest login`.

The GitHub repo is linked to the project, so builds and updates can also start from GitHub (see
[From GitHub or the Expo connector](#from-github-or-the-expo-connector)).

To point builds at a different Supabase project without changing `.env`, set the same names as EAS
environment variables, on expo.dev under the project's **Environment variables** page or with
`npx eas-cli@latest env:set`. Variables set there override `.env`.

## Android: internal APK

```bash
npx eas-cli@latest build --platform android --profile preview
```

1. The first build asks to generate an Android keystore. Say yes; EAS stores it for you.
2. When the build finishes, the terminal and the build page on expo.dev show an install link and QR code.
3. Send the link to staff. On each phone, open it, download the APK and allow installs from that source
   when Android asks.

### If Play Protect warns

Google Play Protect warns about apps that come from a link rather than the Play Store, because it hasn't
seen this developer before. That's expected for an internal app and nothing is wrong with it. Each phone
only needs to get past it once:

1. On the warning, tap **More details**, then **Install anyway**.
2. If it offers **Scan app**, run the scan, then tap **Install**.
3. If it only offers **OK** or **Uninstall**:
   1. Open the **Play Store**, tap your profile picture, then **Play Protect**, then ⚙️.
   2. Turn off **Scan apps with Play Protect**.
   3. Install the APK.
   4. Turn scanning back on straight away.

Fixes sent with EAS Update arrive inside the app, so they don't trigger the warning again. Google's
developer verification for apps installed from a link goes global in 2027. Before then, either verify the
developer account or move staff to Google Play's internal testing track (see
[Later: the stores](#later-the-stores)).

Most later changes reach phones on their own (see
[Shipping fixes without a new build](#shipping-fixes-without-a-new-build)). When a new build is needed,
run the same command and share the new link. Installing over the top keeps the phone's data, including
anything waiting in the Outbox, because the signing key stays the same.

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

## Shipping fixes without a new build

The app includes EAS Update, so most changes reach phones without anyone reinstalling. Each build
profile listens on its own channel:

```bash
npx eas-cli@latest update --channel preview --environment preview --message "Fix the count total"         # Android APK builds
npx eas-cli@latest update --channel production --environment production --message "Fix the count total"   # TestFlight builds
```

`--environment` picks which EAS environment's variables go into the update. The Supabase values come from
`.env` unless that environment overrides them. Without the flag, the CLI asks you which environment to use.

A phone downloads the fix in the background when the app opens and uses it the next time the app starts.
Work waiting in the Outbox is kept, because it's stored on the phone, not in the app code.

An update can only change the app's JavaScript code and its images. **Some changes need a new build
instead:**

- adding or removing a native package
- upgrading the Expo SDK
- changing `app.json` (icon, name, permissions, plugins)

For those, raise `version` in `app.json` (for example `1.0.0` to `1.1.0`), then build and share again.
`runtimeVersion` follows `version`, so an update published for `1.1.0` never reaches a `1.0.0` build it
might break.

If an update causes problems, `npx eas-cli@latest update:rollback` puts the previous one back.

## From GitHub or the Expo connector

Because the repo is linked to the Expo project, nobody needs to run commands on a computer:

| To | Do |
|---|---|
| Build an APK | On expo.dev, open the project's **Builds** page, choose **Build from GitHub**, then pick `main`, Android and `preview`. Claude can start the same build through the Expo connector. |
| Send a fix to the APKs | Run the workflow `.eas/workflows/update-preview.yml` on `main`: from the project's **Workflows** page, with `npx eas-cli@latest workflow:run .eas/workflows/update-preview.yml`, or through the Expo connector. |

Builds from GitHub need `"image": "latest"` in each profile, which `eas.json` sets. They also make the
Android signing key themselves the first time.

## Versions

`eas.json` uses `appVersionSource: remote`, so EAS keeps the build numbers (Android `versionCode`, iOS
`buildNumber`), and `production` raises them on every build. The version people see, `1.0.0`, comes from
`version` in `app.json`. It also decides which builds an update can reach (see above).

## Later: the stores

When the app is ready to go beyond staff testing:

- **iPhone:** use the same TestFlight build. In App Store Connect, fill in the listing and submit it for
  review. Apple also offers unlisted distribution for business apps that shouldn't be public.
- **Android:** build an App Bundle with `npx eas-cli@latest build --platform android --profile
  production`, then `npx eas-cli@latest submit --platform android --latest`. Google Play needs the very
  first upload done by hand in the Play Console, plus a service-account key for EAS. Start on Play's
  internal testing track.
