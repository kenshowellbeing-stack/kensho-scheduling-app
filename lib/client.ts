import { prisma } from "./db";

// Client records track the people who book with you, deduplicated by email.
// They're created/updated automatically when a booking is confirmed — you never
// enter them by hand. Like the calendar push and emails, this is best-effort:
// if it errors we log and move on, so it can never stop a real booking.

type BookingForClient = {
  id: number;
  customerName: string;
  customerEmail: string;
  startsAt: Date; // the session's start time (UTC)
};

// Create or update the Client behind a confirmed booking, and link the booking
// row to that client. Returns the client id (or null if something went wrong).
//
// On a repeat booking we intentionally re-arm the follow-up and nudge (clear
// followUpSentAt / nudgeSentAt): each fresh session earns its own thank-you,
// and booking again ends any "gone quiet" period so a future lull can nudge
// once more.
export async function upsertClientForBooking(
  booking: BookingForClient
): Promise<number | null> {
  try {
    const email = booking.customerEmail.trim().toLowerCase();
    const name = booking.customerName.trim();
    const now = new Date();

    // Keep lastSessionAt pointed at the *latest* session, so a small near-term
    // booking can't drag it back behind a session already further out.
    const existing = await prisma.client.findUnique({
      where: { email },
      select: { lastSessionAt: true },
    });
    const lastSessionAt =
      existing?.lastSessionAt && existing.lastSessionAt > booking.startsAt
        ? existing.lastSessionAt
        : booking.startsAt;

    const client = await prisma.client.upsert({
      where: { email },
      update: {
        name,
        status: "booked",
        lastSessionAt,
        lastContactAt: now,
        followUpSentAt: null,
        nudgeSentAt: null,
      },
      create: {
        name,
        email,
        status: "booked",
        lastSessionAt: booking.startsAt,
        lastContactAt: now,
      },
      select: { id: true },
    });

    // Link the booking back to the client (nullable relation, so harmless if
    // the update misses for any reason).
    await prisma.booking.update({
      where: { id: booking.id },
      data: { clientId: client.id },
    });

    return client.id;
  } catch (err) {
    console.error(`upsertClientForBooking failed for booking ${booking.id}:`, err);
    return null;
  }
}
