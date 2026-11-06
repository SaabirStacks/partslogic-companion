// Parties (shared core): contacts and addresses for suppliers now, customers later.
// The public names; apps import them from '@partslogic/shared'.
export {
  CONTACT_INPUT_KEYS,
  isPartyAddressKind,
  PARTY_ADDRESS_KINDS,
  readSites,
  removePartyAddress,
  removePartyContact,
  removePartySite,
  savePartyAddress,
  savePartyContact,
  savePartySite,
  type ContactInput,
  type PartyAddress,
  type PartyAddressKind,
  type PartyContact,
  type PartySite,
  type PartySiteInput,
} from './parties';
