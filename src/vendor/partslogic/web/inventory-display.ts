import type { ClaimState, MovementReason, PriceTierName } from "@partslogic/shared"

// EANs arrive already in display form (public.inventory_rows trims GTIN-14 padding).

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
    }).format(amount)
  } catch {
    return `${amount.toFixed(2)} ${currency}`
  }
}

export function formatQty(qty: number): string {
  return new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: 3,
  }).format(qty)
}

export function formatPercent(ratio: number): string {
  return new Intl.NumberFormat("en-GB", { style: "percent", maximumFractionDigits: 1 }).format(ratio)
}

// "3 Oct 2026"; dates without a time ("2026-10-03") are read as that calendar day.
export function formatDate(value: string | null | undefined): string {
  if (!value) return "—"
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(date)
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

// Today as a calendar day (YYYY-MM-DD) in the browser's time zone.
export function todayIso(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

// Margin on the sell price: (sell - cost) / sell.
export function marginRatio(sell: number | null | undefined, cost: number | null | undefined): number | null {
  if (sell == null || cost == null || sell <= 0) return null
  return (sell - cost) / sell
}

export const PART_KIND_LABELS = {
  oe: "OE",
  aftermarket: "Aftermarket",
  oe_placeholder: "OE not confirmed",
} as const

// How settled a claim is, in the words the screens use.
export const CLAIM_LABELS: Record<ClaimState, string> = {
  verified: "Confirmed",
  asserted: "Stated",
  inferred: "Lead",
  conflict: "Conflict",
  rejected: "Rejected",
}

export const CLAIM_HINTS: Record<ClaimState, string> = {
  verified: "A person confirmed this.",
  asserted: "A source states this directly.",
  inferred: "Worked out, not stated by a source. Treat it as a lead until someone confirms it.",
  conflict: "Sources disagree. It needs a decision.",
  rejected: "Someone rejected this. It is kept for the record.",
}

export const RELATION_LABELS: Record<string, string> = {
  same_oe: "Same OE number",
  same_group: "Same group",
  cross_reference: "Cross-reference",
  replaces: "This part replaces it",
  superseded_by: "Replaced by",
  kit_containing: "Kits that contain this part",
}

export const REASON_LABELS: Record<MovementReason, string> = {
  opening: "Opening stock",
  receipt: "Received",
  sale: "Sold",
  adjustment: "Adjustment",
  stocktake: "Stock take",
  transfer_in: "Moved in",
  transfer_out: "Moved out",
  customer_return: "Customer return",
  supplier_return: "Returned to supplier",
}

export const TIER_LABELS: Record<PriceTierName, string> = {
  retail: "Retail",
  trade: "Trade",
}

const FIELD_LABELS: Record<string, string> = {
  description: "Description",
  commodity_code: "Commodity code",
  country_of_origin: "Country of origin",
  weight_kg: "Weight (kg)",
  supplier_rank: "Supplier rank",
  example_vehicle: "Example vehicle",
  source_category: "Source category",
  generic_name: "Product type",
  market_price: "Autodoc shop price",
  market_currency: "Autodoc currency",
  autodoc_url: "Autodoc page",
  autodoc_product_id: "Autodoc product id",
  autodoc_generic_id: "Autodoc product type id",
  autodoc_brand_no: "Autodoc brand id",
  compatibility_summary: "Fits (Autodoc summary)",
  compatibility_hints: "Fits (shop wording)",
  oe_unattributed: "OE numbers without a make",
  restricted_code: "Restricted barcode",
}

// spec_thread_size → "Thread size"; known fields get their own wording.
export function fieldLabel(field: string): string {
  const known = FIELD_LABELS[field]
  if (known) return known
  const words = field.replace(/^spec_/, "").replace(/_(\d+)$/, " $1").replace(/_/g, " ").trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue | undefined }

// A fact's value as one line of text.
export function factText(value: JsonValue | undefined): string {
  if (value == null) return "—"
  if (typeof value === "string") return value
  if (typeof value === "number") return formatQty(value)
  if (typeof value === "boolean") return value ? "Yes" : "No"
  if (Array.isArray(value)) return value.map((item) => factText(item)).join(", ")
  return Object.entries(value)
    .map(([key, item]) => `${fieldLabel(key)}: ${factText(item)}`)
    .join(" · ")
}

// "(oe_part_number(s))" style keys from Autodoc summaries, made readable.
export function summaryLabel(key: string): string {
  return fieldLabel(key.replace(/\(s\)/g, "s").replace(/[()]/g, " ").replace(/\s+/g, "_"))
}
