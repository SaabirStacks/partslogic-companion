# people

Who can sign in and what they may do: members, roles (viewer < counter < editor < admin < owner < developer),
names, set-up codes and the people page.

## Files here
- `members.ts`: `AppRole`, `APP_ROLES`, `roleAtLeast`, `getCurrentMember`, `listMemberLabels`.
- `people.ts`: the people page (`listPeople`, `setPersonRole`, `setPersonName`, `removePersonAccess`,
  `addPerson`, `newSetupCode`, `changePersonEmail`, `finishSetup`) and the role wording.

## Elsewhere
- Screens: Settings › People (`components/shadcn-studio/blocks/organisation-settings/people-section.tsx`); sign-in at `app/login/`
  (`components/shadcn-studio/blocks/login-page-01/`, `app/login/actions.ts` `signIn`, `app/actions.ts` `signOut`); `proxy.ts` guards routes.
- Server actions: `saveRole` in `app/settings/actions.ts`; `loadMemberLabels` in `app/inventory/actions.ts`.
- API: `app/api/v1/me/route.ts`.
- Edge Function: `supabase/functions/people/` with `supabase/functions/_shared/people.ts` (adding a person,
  set-up codes and sign-in emails need the service key).
- Database: `members` table, `people`, `member_labels`, `set_person_role`, `set_person_name`,
  `remove_person_access`, `finish_setup`, `require_role`, `require_can_manage`, `people_rule_problem`.
  SQL tests: `supabase/tests/108_people.sql`.
- Tests: `tests/people/people.test.ts`. Docs: `docs/PEOPLE.md`.

## Rules
- Admins and above manage people; they never change themselves, never someone above their role, and never
  give a role above their own (`public.people_rule_problem`). The Edge Function checks the same rules first.
- Every page checks the member's role on the server (`getCurrentMember`); screens follow the role.
