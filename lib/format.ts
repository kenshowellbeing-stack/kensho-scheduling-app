// Small display helpers, kept in one place so formatting stays consistent.

// Change this if you don't bill in pounds. It must be a valid ISO currency
// code (e.g. "USD", "EUR"). Stripe will use the same currency later.
export const CURRENCY = "GBP";

// 5000 (cents) -> "£50.00"; 0 -> "Free".
export function formatPrice(priceCents: number): string {
  if (priceCents === 0) return "Free";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: CURRENCY,
  }).format(priceCents / 100);
}

// 90 -> "1 hr 30 min"; 60 -> "1 hr"; 30 -> "30 min".
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const parts: string[] = [];
  if (h > 0) parts.push(`${h} hr`);
  if (m > 0) parts.push(`${m} min`);
  return parts.join(" ") || "0 min";
}
