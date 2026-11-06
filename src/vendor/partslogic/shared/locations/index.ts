// Locations: locations and bins.
// The public names; apps import them from '@partslogic/shared'.
export {
  createBin,
  createBins,
  deleteBin,
  listLocationBins,
  listLocationBinTree,
  updateBin,
  type BinsCreated,
  type BinSummary,
  type BinTreeEntry,
} from './bins';
export {
  createLocation,
  deleteLocation,
  listLocationOptions,
  listLocations,
  listLocationSummaries,
  updateLocation,
  type Location,
  type LocationOption,
  type LocationSummary,
} from './locations';
