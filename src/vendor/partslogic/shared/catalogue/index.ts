// Catalogue: parts, their references, fitments, kits, barcodes, brands and search.
// The public names; apps import them from '@partslogic/shared'.
export {
  barcodeProblem,
  displayGtin,
  gtin14,
  isRestrictedGtin,
  looksLikeBarcode,
} from './barcodes';
export {
  aliasBrandName,
  brandOptions,
  checkBrands,
  createBrand,
  type BrandCheck,
  type BrandKind,
  type BrandMatch,
  type BrandOption,
  type BrandSuggestion,
} from './brands';
export {
  listEngineSettings,
  type EngineSetting,
} from './engine-settings';
export {
  addKitComponent,
  getPartKit,
  removeKitComponent,
  type KitLine,
  type PartKit,
} from './kits';
export {
  getPartDetail,
  type Barcode,
  type ClaimState,
  type EnrichmentState,
  type EnrichmentStatus,
  type OeNumber,
  type PartCounts,
  type PartDetail,
  type PartGaps,
  type PartImage,
  type SupplierPrice,
} from './part-detail';
export {
  getClaimSources,
  getPartAlternatives,
  getPartFitments,
  getPartSpecs,
  getPartVehicleTexts,
  type ClaimKind,
  type ClaimSource,
  type PartAlternative,
  type PartFact,
  type PartFitment,
  type VehicleText,
} from './part-tabs';
export {
  getPartReferences,
  reviewLink,
  type CrossReference,
  type LinkedPart,
  type OeReference,
  type PartReferences,
} from './references';
export {
  searchParts,
  type PartSearchResult,
} from './search';
