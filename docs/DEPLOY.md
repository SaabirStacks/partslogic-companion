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
| `npm run check:env` (`scripts/check-public-env.mjs`) | On EAS before every build (the `eas-build-post-install` script), and before every update (`.eas/workflows/update-phones.yml`) | The build or update fails with a message naming the missing value |
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

### First build (once, from a computer)

The first iPhone build has to run from a computer, because it signs in to your Apple account to make the
app's signing certificate. You can use a Mac, Windows or Linux computer, with Node.js 20 or later and Git.
After this build, iPhone builds start from expo.dev or the Expo connector, and nobody needs a computer.

```bash
git clone https://github.com/SaabirStacks/partslogic-companion.git
cd partslogic-companion
npm ci
npx eas-cli@latest login
npx eas-cli@latest build --platform ios --profile production --auto-submit
```

It asks a few questions on the way. The wording varies between versions:

| When it asks about | Answer |
|---|---|
| Logging in to your Apple account | Yes. At `Apple ID:` type the **email address** of the developer account (not the app's number), then enter the code Apple sends to your devices |
| A distribution certificate | Make a new one, or reuse one you already have |
| A provisioning profile | Make a new one |
| Push notifications | No. The app doesn't send any |
| An App Store Connect API key | Yes, make one, with the **Admin** role. Later builds use it to reach TestFlight, and to renew the app's signing, without your Apple login |
| The app's name, only if "PartsLogic" is taken in the App Store | Something like "PartsLogic Eclipse". Only you and your testers see it |

The build itself runs on Expo's servers and takes about 20 minutes. EAS then uploads it to App Store
Connect, and Apple processes it, which usually takes 5 to 15 minutes. You can close the terminal once the
build has started: the build and the upload carry on without it, and the build page on expo.dev shows how
they're doing.

If Apple says the password is wrong when it isn't:

1. Delete the tool's saved Apple sign-in, which can go stale: `rm -rf ~/.app-store` on a Mac, or
   `Remove-Item -Recurse -Force $HOME\.app-store` in Windows PowerShell.
2. Sign in at developer.apple.com and appstoreconnect.apple.com in a browser, and accept any agreement
   they ask you to.
3. Type the password by hand, because pasting into the hidden prompt often doesn't work.

This was done on 29 October 2026. The app is in App Store Connect as **PartsLogic**, and its App Store
Connect ID (`ascAppId`, `6828475146`, also shown as "Apple ID" under **App Information**) is in
`eas.json`, so later builds reach TestFlight on their own. EAS keeps the signing certificate, the
provisioning profile and an Admin App Store Connect API key.

### Add staff

TestFlight testers must be users on your App Store Connect team.

1. In App Store Connect, open **Users and Access** and add each person. Give them the **Marketing** role,
   which can't change builds or users, with access to PartsLogic only.
2. Open the app and go to **TestFlight**. The first build made an internal group called **Team (Expo)**
   and added the account holder to it. Open it and add the staff with **Invite Testers**.
3. Each person installs the **TestFlight** app from the App Store and opens the invite email on their
   iPhone. They tap **View in TestFlight**, then **Install**. Turning on **Automatic Updates** in
   TestFlight installs new builds as they arrive.

Up to 100 people can be internal testers. For more than that, use an external group (anyone with an email
address or a public link). The first build for an external group needs Apple's Beta App Review, which
asks for a sign-in the reviewer can use.

### Later builds

The workflow `.eas/workflows/testflight.yml` builds the iPhone app and sends it to TestFlight in one go.
Start it from the project's **Workflows** page on expo.dev, with
`npx eas-cli@latest workflow:run .eas/workflows/testflight.yml`, or through the Expo connector.

**TestFlight builds stop opening 90 days after they're uploaded.** Over-the-air updates keep the code
current but don't reset that clock; only a new build does. Run the workflow at least every 80 days, or
whenever a change needs a new build (see below).

`app.json` sets `ios.config.usesNonExemptEncryption: false`. The app only uses standard HTTPS and
on-device encryption, so App Store Connect won't ask the export-compliance question for each build.

### If the iPhone app closes as it opens

You don't need Xcode. When a TestFlight build crashes, the iPhone asks to send a report to Apple; tap
**Share**. Reports appear in App Store Connect under **TestFlight → Crashes**, and Claude can read them
through the Expo connector (`testflight_crashes` with the bundle ID).

Build 4 (29 October 2026) closed at launch on iOS 27 with `NoSceneLifecycleAdoption` in the report.
Apps built with the iOS 27 SDK (Xcode 27) must use UIKit's scene life cycle. Expo SDK 57 apps had to opt in
with `ios.enableSceneSupport` (through the `expo-build-properties` plugin); SDK 58 has scene support built
in, so the app no longer sets it and the `expo-build-properties` dependency was removed
([Expo's guide](https://github.com/expo/fyi/blob/main/ios-scene-lifecycle.md)).

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
profile listens on its own channel: the Android APKs on `preview`, the iPhones on `production`. The workflow
`.eas/workflows/update-phones.yml` publishes to both at once (see
[From GitHub or the Expo connector](#from-github-or-the-expo-connector)). By hand:

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

For those, raise `version` in `app.json` (for example `1.0.0` to `1.1.0`), then build again for both: an
APK to share, and the TestFlight workflow for the iPhones.
`runtimeVersion` follows `version`, so an update published for `1.1.0` never reaches a `1.0.0` build it
might break.

If an update causes problems, `npx eas-cli@latest update:rollback` puts the previous one back.

## From GitHub or the Expo connector

Because the repo is linked to the Expo project, nobody needs to run commands on a computer:

| To | Do |
|---|---|
| Build an APK | On expo.dev, open the project's **Builds** page, choose **Build from GitHub**, then pick `main`, Android and `preview`. Claude can start the same build through the Expo connector. |
| Send a fix to every phone | Run the workflow `.eas/workflows/update-phones.yml` on `main`: from the project's **Workflows** page, with `npx eas-cli@latest workflow:run .eas/workflows/update-phones.yml`, or through the Expo connector. It sends the Android APKs and the iPhones the same code. |
| Build for iPhone | Run the workflow `.eas/workflows/testflight.yml` on `main` the same way. It builds and sends the build to TestFlight. |

Builds from GitHub need `"image": "latest"` in each profile, which `eas.json` sets. They also make the
Android signing key themselves the first time. iPhone builds can't make their signing certificate this way,
which is why the first one runs from a computer.

## Versions

`eas.json` uses `appVersionSource: remote`, so EAS keeps the build numbers (Android `versionCode`, iOS
`buildNumber`), and `production` raises them on every build. The version people see comes from `version`
in `app.json`. It also decides which builds an update can reach (see above).

| Version | What needed the new build | Phones on the version before |
|---|---|---|
| `1.0.0` | The first builds (Expo SDK 57) | — |
| `1.1.0` | Expo SDK 58, and sounds (`expo-audio`) | Keep working, but get no more updates. Install the `1.1.0` build: a new APK on Android, the new TestFlight build on iPhone |

## Later: the stores

When the app is ready to go beyond staff testing:

- **iPhone:** use the same TestFlight build. In App Store Connect, fill in the listing and submit it for
  review. Apple also offers unlisted distribution for business apps that shouldn't be public.
- **Android:** build an App Bundle with `npx eas-cli@latest build --platform android --profile
  production`, then `npx eas-cli@latest submit --platform android --latest`. Google Play needs the very
  first upload done by hand in the Play Console, plus a service-account key for EAS. Start on Play's
  internal testing track.
