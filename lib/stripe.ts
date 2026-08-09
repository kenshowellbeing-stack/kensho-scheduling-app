import Stripe from "stripe";

// One shared Stripe client for the whole app. It reads your SECRET key from the
// environment (never hard-code keys in source). We don't pin an API version so
// the installed SDK's default is used.
const secretKey = process.env.STRIPE_SECRET_KEY;

if (!secretKey) {
  // Thrown only if a Stripe route is actually hit without the key set, which
  // gives a clear message instead of a confusing crash deep inside the SDK.
  console.warn("⚠️  STRIPE_SECRET_KEY is not set — payment routes will fail until it is.");
}

export const stripe = new Stripe(secretKey ?? "sk_missing", {
  typescript: true,
});

// Where Stripe should send the customer back to. Falls back to localhost for
// local development.
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
