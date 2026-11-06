// People: who can sign in, their roles, and the people page.
// The public names; apps import them from '@partslogic/shared'.
export {
  APP_ROLES,
  getCurrentMember,
  listMemberLabels,
  roleAtLeast,
  type AppRole,
  type CurrentMember,
  type MemberLabel,
} from './members';
export {
  addPerson,
  aRole,
  canChangePerson,
  changePersonEmail,
  finishSetup,
  listPeople,
  newSetupCode,
  personLabel,
  removePersonAccess,
  ROLE_HINTS,
  roleName,
  rolesYouCanGive,
  setPersonName,
  setPersonRole,
  tidySetupCode,
  type Person,
  type SetupCode,
} from './people';
