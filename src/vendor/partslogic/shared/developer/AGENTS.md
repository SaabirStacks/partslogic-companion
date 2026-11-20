# developer

Tools for setting a company up and for steering development: the overview of the company's data, area resets
(developers only), the What's new roadmap (owners and developers) and staff feedback (everyone sends, the developer
reads). Design: `docs/DEVELOPER_TOOLS.md`.

## Files here
- `resets.ts`: `RESET_AREAS`, `RESET_AREA_LABELS`, `previewReset`, `getBackupPage`, `startReset`, `runResetStep`,
  `resetProgress` and their readers.
- `overview.ts`: `getDeveloperOverview`, `readDeveloperOverview`.
- `parts.ts`: the Parts tab (developers): `listDeveloperParts` (the stock list by origin), `removeDeveloperParts`
  (stock list only or completely, each part all or nothing), `listPartRemovals`, `getPartRemovalBackup` and readers.
- `feedback.ts`: `sendFeedback`, `listFeedback`, `setFeedbackStatus`, `uploadFeedbackScreenshot`,
  `feedbackScreenshotUrls`, `feedbackScreenshotPath`, the bucket and its limits.

## Elsewhere
- Page: `app/developer/page.tsx` (`/developer`, tabs Overview, Resets, Feedback). Actions: `app/developer/actions.ts`
  (`loadResetPreview`, `beginReset`, `continueReset`, `loadFeedback`, `markFeedback`, `sendFeedbackForm`).
  Backup download: `app/developer/backup/[area]/route.ts` (streams the JSON file).
- Components: `components/shadcn-studio/blocks/developer/` (`developer-page`, `developer-overview`, `reset-panel`,
  `feedback-inbox`, `feedback-dialog`, `highlight-editor`, `whats-new-dialog`). The side menu's footer
  (`application-shell-19/application-shell-view.tsx`) shows Developer to developers only, What's new to owners and developers and Send
  feedback to everyone (`SidebarRoleFooter`); `role-footer.tsx` reads the role (`lib/current-member.ts`) and the shared
  layout streams it into the frame.
- Web helpers: `lib/roadmap.ts` (the roadmap and release notes; update it with every pull request that changes what
  the app does), `lib/screen-capture.ts` (snap the screen with modern-screenshot, shrink, burn in highlights),
  `lib/reset-backup.ts` (download, fingerprint and save a backup). A release is a title, one summary sentence and at most six highlights of 90 characters,
  each under its area (`RELEASE_AREAS`); `releasesFor`, `releaseAreas` and `releasesByMonth` feed the Updates tab.
- Database: migration `20261112150000_developer_tools`. Schema `developer` (`reset_runs`, `feedback`; the plan in
  `developer.pieces`, `developer.included`, `developer.targets`; deleting in `developer.clear_piece`). Entry points
  `developer_reset_preview`, `developer_backup_page`, `developer_start_reset`, `developer_reset_step`,
  `developer_overview`, `send_feedback`, `feedback_list`, `set_feedback_status`. Storage bucket `feedback`.
  SQL tests: `supabase/tests/138_developer_tools.sql`.
- Tests: `tests/developer/developer.test.ts`, `tests/developer/roadmap.test.ts`, fixtures `tests/support/developer-*.json`.

## Rules
- A reset is the one sanctioned exception to "never delete" (docs/PLAN.md §3). The database decides what goes, in
  what order and with what (an area takes what hangs on it); never delete business rows from TypeScript.
- A Purchasing reset clears only Purchasing's own documents (orders, deliveries, returns, credit notes, bills,
  payments, delivery reversals) and what hangs on them; a sales order's history is never touched (S4b).
- The parts catalogue is never reset. A supplier whose price sheets are the catalogue's evidence, or whose opening
  stock costs name it, is kept.
- No reset starts without a backup holding exactly the rows there now and the area's name typed back.
- The developer module may reach into every other module (to clear an area); nothing refers to it. Suite 138 checks it.
