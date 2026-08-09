import crypto from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateSlot } from "@/lib/availability";
import { stripe, APP_URL } from "@/lib/stripe";
import { expireStaleHolds } from "@/lib/booking";
import { CURRENCY } from "@/lib/format";
import { pushBookingToGoogleCalendar } from "@/lib/googleCalendar";
import { sendBookingConfirmation, sendOwnerBookingNotification } from "@/lib/email";
import { upsertClientForBooking } from "@/lib/client";

// A secret, unguessable token that lets the customer manage (cancel/reschedule)
// their own booking without needing an account.
function newManageToken() {
  return crypto.randomBytes(24).toString("hex");
}

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HOLD_MINUTES = 15;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { serviceId, startISO, name, email } = (body ?? {}) as {
    serviceId?: unknown;
    startISO?: unknown;
    name?: unknown;
    email?: unknown;
  };

  // --- Basic input validation ---------------------------------------------
  const id = Number(serviceId);
  if (!Number.isInteger(id))
    return NextResponse.json({ error: "Please choose a service." }, { status: 400 });
  if (typeof startISO !== "string" || !startISO)
    return NextResponse.json({ error: "Please choose a time." }, { status: 400 });
  if (typeof name !== "string" || name.trim().length === 0)
    return NextResponse.json({ error: "Please enter your name." }, { status: 400 });
  if (typeof email !== "string" || !EMAIL_RE.test(email.trim()))
    return NextResponse.json({ error: "Please enter a valid email." }, { status: 400 });

  // Tidy up any holds that have lapsed since we last looked.
  await expireStaleHolds();

  const service = await prisma.service.findUnique({ where: { id } });
  if (!service || !service.active)
    return NextResponse.json({ error: "Service not found." }, { status: 404 });

  // --- Re-check the slot on the server -------------------------------------
  let startsAt: Date;
  let endsAt: Date;
  try {
    ({ startsAt, endsAt } = await validateSlot(id, startISO));
  } catch (err) {
    const message = err instanceof Error ? err.message : "That time isn't available.";
    const status = message.includes("no longer available") ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }

  // --- Free service: no payment needed, confirm immediately ----------------
  if (service.priceCents === 0) {
    const booking = await prisma.booking.create({
      data: {
        serviceId: id,
        customerName: name.trim(),
        customerEmail: email.trim(),
        startsAt,
        endsAt,
        status: "confirmed",
        manageToken: newManageToken(),
      },
      select: { id: true, manageToken: true },
    });

    try {
      const eventId = await pushBookingToGoogleCalendar({
        id: booking.id,
        customerName: name.trim(),
        customerEmail: email.trim(),
        startsAt,
        endsAt,
        service: { name: service.name },
      });
      if (eventId) {
        await prisma.booking.update({ where: { id: booking.id }, data: { googleEventId: eventId } });
      }
    } catch (err) {
      console.error(`Google Calendar sync failed for booking ${booking.id}:`, err);
    }

    // Best-effort: record/refresh the Client behind this booking (for follow-up
    // and nudge emails later).
    await upsertClientForBooking({
      id: booking.id,
      customerName: name.trim(),
      customerEmail: email.trim(),
      startsAt,
    });

    // Best-effort: email the customer their confirmation (with manage link),
    // and notify the owner of the new booking.
    const emailPayload = {
      customerName: name.trim(),
      customerEmail: email.trim(),
      startsAt,
      manageToken: booking.manageToken,
      service: {
        name: service.name,
        priceCents: service.priceCents,
        durationMinutes: service.durationMinutes,
      },
    };
    await sendBookingConfirmation(emailPayload);
    await sendOwnerBookingNotification(emailPayload);

    return NextResponse.json({
      url: `${APP_URL}/book/success?booking_id=${booking.id}`,
    });
  }

  // --- Paid service: create a pending hold, then a Stripe Checkout session --
  const holdExpiresAt = new Date(Date.now() + HOLD_MINUTES * 60 * 1000);
  const booking = await prisma.booking.create({
    data: {
      serviceId: id,
      customerName: name.trim(),
      customerEmail: email.trim(),
      startsAt,
      endsAt,
      status: "pending",
      holdExpiresAt,
      manageToken: newManageToken(),
    },
    select: { id: true },
  });

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: email.trim(),
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: CURRENCY.toLowerCase(),
            unit_amount: service.priceCents,
            product_data: {
              name: service.name,
              description: service.description || undefined,
            },
          },
        },
      ],
      // We attach our booking id so the webhook and success page can find it.
      metadata: { bookingId: String(booking.id) },
      success_url: `${APP_URL}/book/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${APP_URL}/book/${id}?canceled=1`,
    });

    if (!session.url) throw new Error("Stripe did not return a checkout URL");
    return NextResponse.json({ url: session.url });
  } catch (err) {
    // If we couldn't start payment, don't leave a dangling hold on the slot.
    await prisma.booking.delete({ where: { id: booking.id } }).catch(() => {});
    console.error("Stripe checkout error:", err);
    return NextResponse.json(
      { error: "Could not start payment. Please try again." },
      { status: 500 }
    );
  }
}
