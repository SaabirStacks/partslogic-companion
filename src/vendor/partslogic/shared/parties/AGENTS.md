# parties (shared core)

Contacts and addresses for any party: suppliers now, customers later. It lives in `public`, not a module
schema, because several modules use it.

## Files here
- `parties.ts`: `PartyContact`, `PartyAddress`, `PartySite`, `savePartyContact`, `removePartyContact`,
  `savePartyAddress`, `removePartyAddress`, `savePartySite`, `removePartySite`, and the readers `readContacts` /
  `readAddresses` (used by purchasing) / `readSites` (used by company).

## Elsewhere
- Components: `components/shadcn-studio/blocks/parties/` (`party-contacts.tsx`, `party-addresses.tsx`, `party-bits.tsx`), shown on the
  supplier page.
- Server actions: `saveSupplierContact`, `removeSupplierContact`, `saveSupplierAddress`,
  `removeSupplierAddress` in `app/suppliers/actions.ts`; input readers in `lib/api/party-input.ts`.
- Database: `parties`, `party_contacts`, `party_addresses`; `save_party_contact`, `remove_party_contact`,
  `save_party_address`, `remove_party_address`, `remove_party_site`; internal `party_update`, `party_contact_list`,
  `party_address_list`, `require_party_role`. SQL tests: `supabase/tests/107_party_contacts_addresses.sql`,
  `118_company_details.sql`.
- Tests: `tests/shared/parties.test.ts`.
- Docs: `docs/SUPPLIERS_AND_PURCHASING.md` section 0 (shared pieces); `docs/PURCHASING_PROGRESS.md` step 2c.

## Rules
- The database tidies and checks every field; the wrappers only shape what is sent and read back.
- Sites: a party address of kind `site`, any number per party, each with a name (once per party). The company's
  sites are where its locations' deliveries go.
- The company is a party too (`workspace.party_id`): its main address, contacts and identity need the owner
  (`require_party_role`); its sites need an editor.
