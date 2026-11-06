// Company: the workspace settings (name, currency, VAT, price rounding) and who the company is on documents.
// The public names; apps import them from '@partslogic/shared'.
export {
  getWorkspace,
  isPriceRounding,
  PRICE_ROUNDINGS,
  updateWorkspace,
  type PriceRounding,
  type Workspace,
  type WorkspaceChanges,
} from './workspace';
export {
  companyLogoUrl,
  getCompanyDetails,
  isRegisteredIn,
  LOGO_BUCKET,
  LOGO_MAX_BYTES,
  LOGO_TYPES,
  logoPathFor,
  readCompanyDetails,
  REGISTERED_IN,
  removeCompanyLogo,
  replaceCompanyLogo,
  saveCompanyDetails,
  type CompanyAddress,
  type CompanyContact,
  type CompanyDetails,
  type CompanyDetailsChanges,
  type CompanySite,
  type RegisteredIn,
} from './details';
