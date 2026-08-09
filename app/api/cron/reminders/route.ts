import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendBookingReminder } from "@/lib/email";

export const runtime = "nodejs";

// Sends a one-time "see you tomorrow" reminder for every confirmed booking
// starting within the next 24 hours that hasn't been reminded yet. Designed
// to be hit on a schedule (see vercel.json). Idempotent per booking via the
// reminderSentAt stamp, so running it more than once a day is harmless.
//
// Protected by CRON_SECRET: Vercel Cron automatically sends
// `Authorization: Bearer <CRON_SECRET>` when that env var is set. We also
// accept `?secret=` for easy manual testing.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    const querySecret = new URL(request.url).searchParams.get("secret");
    if (auth !== `Bearer ${secret}` && querySecret !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const due = await prisma.booking.findMany({
    where: {
      status: "confirmed",
      reminderSentAt: null,
      startsAt: { gt: now, lte: in24h },
    },
    include: { service: true },
  });

  let sent = 0;
  for (const booking of due) {
    await sendBookingReminder(booking);
    await prisma.booking.update({
      where: { id: booking.id },
      data: { reminderSentAt: new Date() },
    });
    sent++;
  }

  return NextResponse.json({ ok: true, sent });
}
