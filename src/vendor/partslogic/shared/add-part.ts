// Phone compatibility only: the companion app imports this old path from its vendored copy. New code imports
// from '@partslogic/shared'. Delete this file once the companion does too (see packages/shared/AGENTS.md).
export * from './inventory/add-part';
export { brandOptions, type BrandKind, type BrandMatch, type BrandOption } from './catalogue/brands';
