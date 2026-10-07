# PartsLogic Companion

The phone app for PartsLogic, Eclipse Auto Parts' parts and stock system. Staff scan barcodes on their
own iPhones and Android phones to look parts up, receive deliveries, put stock away and count bins, and it
keeps working with no signal.

Built with Expo (SDK 57), Expo Router, TypeScript and NativeWind. It talks to the same Supabase project as
the PartsLogic back office and calls the same database functions; it never reimplements stock rules.

| Path | What it is |
|---|---|
| `docs/MOBILE_PLAN.md` | The approved build plan: decisions, screens and workflows, phases |
| `docs/DEPLOY.md` | Building and sharing the app: Android APK link, iPhone TestFlight |
| `eas.json` | EAS Build profiles (`preview`, `production`) |
| `src/app/` | Screens (Expo Router: every file is a route). `(tabs)/` holds the job tabs |
| `src/session/` | Who is signed in, their role, the working location, which tabs they see |
| `src/features/` | Pieces of screens shared between routes |
| `src/ui/` | The palette (PartsLogic's colours, light and dark), icons and shared components |
| `src/lib/` | Supabase client and device preferences |
| `src/scan/` | Scanning helpers |
| `src/vendor/partslogic/` | A copy of PartsLogic's shared code and database types. **Never edit it** |
| `scripts/sync-partslogic.mjs` | Refreshes that copy from a PartsLogic commit |

## Getting started

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in the Supabase URL and publishable key.
3. `npx expo start`, then scan the QR code with Expo Go.

## Checks

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # expo lint
npm test            # jest
npx expo-doctor     # dependency and config health
```

Add packages with `npx expo install <package>` so versions match the Expo SDK.

## Deploying

See [`docs/DEPLOY.md`](docs/DEPLOY.md). In short, after `npx eas-cli@latest login`, `init` and storing the
two Supabase values with `env:set`:

```bash
npx eas-cli@latest build --platform android --profile preview   # APK, shared by link
npx eas-cli@latest build --platform ios --profile production    # then: eas submit --platform ios --latest
```

## Updating the PartsLogic code

The database wrappers (`packages/shared`) and generated types (`packages/db-types`) live in PartsLogic.
After they change there:

```bash
npm run sync:partslogic -- --from ../PartsLogic --ref main
```

`src/vendor/partslogic/SOURCE.json` records the commit the copy came from.
