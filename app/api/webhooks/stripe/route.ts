import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/db";
import { confirmBooking } from "@/lib/booking";

// Stripe needs the raw request body to verify the signature, and the Node
// runtime (not Edge) to run its crypto.
export const runtime = "nodejs";

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET is not set.");
    return NextResponse.json({ error: "Webhook not configured." }, { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  }

  // IMPORTANT: read the raw body as text; do not JSON.parse it first.
  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    // Signature didn't verify — could be a bad secret or a forged request.
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const bookingId = Number(session.metadata?.bookingId);

      if (session.payment_status === "paid" && Number.isInteger(bookingId)) {
        const paymentId =
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id;
        const result = await confirmBooking(bookingId, paymentId);
        if (!result.ok) {
          // We still return 200 so Stripe doesn't retry forever; the conflict/
          // not-found case is logged for you to handle (e.g. issue a refund).
          console.error(`Could not confirm booking ${bookingId}:`, result.reason);
        }
      }
      break;
    }

    case "checkout.session.expired": {
      // The customer abandoned payment and the Checkout session timed out.
      // Release the hold if it's still pending.
      const session = event.data.object as Stripe.Checkout.Session;
      const bookingId = Number(session.metadata?.bookingId);
      if (Number.isInteger(bookingId)) {
        await prisma.booking.updateMany({
          where: { id: bookingId, status: "pending" },
          data: { status: "expired" },
        });
      }
      break;
    }

    default:
      // Ignore other event types for now.
      break;
  }

  return NextResponse.json({ received: true });
}
