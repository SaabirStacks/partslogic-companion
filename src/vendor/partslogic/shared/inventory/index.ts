// Inventory: the parts you hold, stock levels and movements, min/max, stock costs and adding parts.
// The public names; apps import them from '@partslogic/shared'.
export {
  addInventoryPart,
  findPartsToAdd,
  skuAvailable,
  type AddInventoryInput,
  type AddInventoryResult,
  type PartToAdd,
  type SkuCheck,
} from './add-part';
export {
  INVENTORY_PAGE_SIZES,
  INVENTORY_SORTS,
  inventoryFilterOptions,
  inventoryPageSize,
  isInventorySort,
  listInventory,
  readInventoryRow,
  UNCATEGORISED,
  updateInventoryItem,
  type FilterOption,
  type InventoryFilterOptions,
  type InventoryItemChanges,
  type InventoryPageSize,
  type InventoryQuery,
  type InventoryRow,
  type InventorySort,
  type ItemPricing,
  type PartKind,
  type StockLine,
} from './items';
export {
  listLocationLevels,
  setLocationLevel,
  type LocationLevel,
} from './levels';
export {
  getStockCosts,
  removeStockCostLot,
  saveStockCostLot,
  type StockCostLot,
  type StockCostLotInput,
  type StockCosts,
} from './stock-costs';
export {
  adjustStock,
  listMovements,
  setStockCount,
  transferStock,
  type MovementFilter,
  type MovementReason,
  type StockAdjustment,
  type StockMovement,
  type StockTransfer,
} from './stock';
export {
  removeSupplierCode,
  setSupplierCode,
} from './supplier-codes';
// Phone compatibility: the companion imports these from shared/inventory. They belong to locations.
export { listLocations, type Location } from '../locations/locations';
