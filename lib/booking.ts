import { prisma } from "./db";
import {
  pushBookingToGoogleCalendar,
  deleteCalendarEvent,
  updateCalendarEvent,
} from "./googleCalendar";
import {
  sendBookingConfirmation,
  sendBookingCancellation,
  sendBookingReschedule,
  sendOwnerBookingNotification,
} from "./email";
import { stripe } from "./stripe";
import { validateSlot } from "./availability";

export type ConfirmResult =
  | { ok: true; alreadyConfirmed: boolean; booking: { id: number } }
  | { ok: false; reason: "not_found" | "conflict" };

// Turn a pending booking into a confirmed one. Safe to call multiple times:
// the webhook and the success page may both call it. If the booking is already
// confirmed we just return success without touching anything.
export async function confirmBooking(
  bookingId: number,
  stripePaymentId?: string
): Promise<ConfirmResult> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { service: true },
  });
  if (!booking) return { ok: false, reason: "not_found" };

  if (booking.status === "confirmed") {
    return { ok: true, alreadyConfirmed: true, booking: { id: booking.id } };
  }

  // Guard against the (rare) case where this hold lapsed and another CONFIRMED
  // booking took the slot before payment completed. We never want two confirmed
  // bookings on the same time.
  const clash = await prisma.booking.findFirst({
    where: {
      id: { not: booking.id },
      status: "confirmed",
      startsAt: { lt: booking.endsAt },
      endsAt: { gt: booking.startsAt },
    },
    select: { id: true },
  });
  if (clash) {
    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: "conflict", stripePaymentId: stripePaymentId ?? null },
    });
    return { ok: false, reason: "conflict" };
  }

  await prisma.booking.update({
    where: { id: booking.id },
    data: {
      status: "confirmed",
      stripePaymentId: stripePaymentId ?? booking.stripePaymentId,
      holdExpiresAt: null, // no longer a hold
    },
  });

  // Best-effort: push to Google Calendar if it's connected. Never let a
  // calendar hiccup stop a real, paid booking from confirming.
  try {
    const eventId = await pushBookingToGoogleCalendar(booking);
    if (eventId) {
      await prisma.booking.update({ where: { id: booking.id }, data: { googleEventId: eventId } });
    }
  } catch (err) {
    console.error(`Google Calendar sync failed for booking ${booking.id}:`, err);
  }

  // Best-effort: email the customer their confirmation (with manage link),
  // and notify the owner of the new booking.
  await sendBookingConfirmation(booking);
  await sendOwnerBookingNotification(booking);

  return { ok: true, alreadyConfirmed: false, booking: { id: booking.id } };
}

// Mark expired holds so the database stays tidy. NOTE: availability already
// ignores lapsed holds automatically (it only counts pending bookings whose
// holdExpiresAt is still in the future), so the slot is freed the moment the
// hold passes — this just cleans up the row's status. A scheduled job can call
// this periodically (added with the cron work in a later step).
export async function expireStaleHolds(): Promise<number> {
  const { count } = await prisma.booking.updateMany({
    where: { status: "pending", holdExpiresAt: { lt: new Date() } },
    data: { status: "expired" },
  });
  return count;
}

// Is a booking still inside the self-service change window? (cancelCutoffHours
// before the start time.) Used to show/hide the cancel & reschedule controls.
export async function isWithinChangeWindow(startsAt: Date): Promise<boolean> {
  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  const cutoffH = settings?.cancelCutoffHours ?? 24;
  return Date.now() <= startsAt.getTime() - cutoffH * 60 * 60 * 1000;
}

export type CancelResult =
  | { ok: true; refunded: boolean }
  | { ok: false; reason: "not_found" | "too_late" | "already_cancelled" };

// Cancel a booking: refund the card if it was paid, remove the calendar event,
// and email the customer. `enforceWindow` applies the 24h cutoff for customer
// self-service; the admin passes false to override.
export async function cancelBookingWithRefund(
  bookingId: number,
  opts: { enforceWindow: boolean }
): Promise<CancelResult> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { service: true },
  });
  if (!booking) return { ok: false, reason: "not_found" };
  if (booking.status === "cancelled") return { ok: false, reason: "already_cancelled" };

  if (opts.enforceWindow && !(await isWithinChangeWindow(booking.startsAt))) {
    return { ok: false, reason: "too_late" };
  }

  // Refund if there's a captured payment. Continue cancelling even if the
  // refund errors — it's logged so you can refund manually in Stripe.
  let refunded = false;
  if (booking.stripePaymentId) {
    try {
      await stripe.refunds.create({ payment_intent: booking.stripePaymentId });
      refunded = true;
    } catch (err) {
      console.error(`Refund failed for booking ${booking.id}:`, err);
    }
  }

  await prisma.booking.update({
    where: { id: booking.id },
    data: { status: "cancelled" },
  });

  if (booking.googleEventId) {
    try {
      await deleteCalendarEvent(booking.googleEventId);
    } catch (err) {
      console.error(`Calendar delete failed for booking ${booking.id}:`, err);
    }
  }

  await sendBookingCancellation(booking, refunded);
  return { ok: true, refunded };
}

export type RescheduleResult =
  | { ok: true }
  | { ok: false; reason: "not_found" | "too_late" | "not_confirmed" | "slot_unavailable" };

// Move a confirmed booking to a new time. Re-validates the new slot server-side
// (never trust the browser), moves the calendar event, and emails the customer.
export async function rescheduleBooking(
  bookingId: number,
  newStartISO: string,
  opts: { enforceWindow: boolean }
): Promise<RescheduleResult> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { service: true },
  });
  if (!booking) return { ok: false, reason: "not_found" };
  if (booking.status !== "confirmed") return { ok: false, reason: "not_confirmed" };

  if (opts.enforceWindow && !(await isWithinChangeWindow(booking.startsAt))) {
    return { ok: false, reason: "too_late" };
  }

  const previousStartsAt = booking.startsAt;

  let startsAt: Date;
  let endsAt: Date;
  try {
    ({ startsAt, endsAt } = await validateSlot(booking.serviceId, newStartISO));
  } catch {
    return { ok: false, reason: "slot_unavailable" };
  }

  await prisma.booking.update({
    where: { id: booking.id },
    data: { startsAt, endsAt },
  });

  if (booking.googleEventId) {
    try {
      await updateCalendarEvent(booking.googleEventId, startsAt, endsAt);
    } catch (err) {
      console.error(`Calendar update failed for booking ${booking.id}:`, err);
    }
  }

  await sendBookingReschedule({ ...booking, startsAt }, previousStartsAt);
  return { ok: true };
}
