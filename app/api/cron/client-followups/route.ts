import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendClientFollowUp, sendClientNudge } from "@/lib/email";

export const runtime = "nodejs";

// Daily client lifecycle emails (see vercel.json). Two passes, both idempotent
// via a "sent" stamp so running more than once a day is harmless:
//
//   1. Thank-you + rebook — clients whose last session was 1–2 days ago and who
//      haven't had a follow-up for it yet. Moves them to "active".
//   2. Check-in nudge — clients who've gone quiet (>2 weeks since last session),
//      still booked/active, not yet nudged. Sent once, then moved to "past".
//
// Protected by CRON_SECRET exactly like /api/cron/reminders: Vercel Cron sends
// `Authorization: Bearer <CRON_SECRET>`; we also accept `?secret=` for manual
// testing.
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
  const oneDayAgo = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  // --- 1. Thank-you + rebook, for sessions that finished 1–2 days ago --------
  const followUpDue = await prisma.client.findMany({
    where: {
      followUpSentAt: null,
      status: { in: ["booked", "active"] },
      lastSessionAt: { gte: twoDaysAgo, lte: oneDayAgo },
    },
  });

  let followUpsSent = 0;
  for (const client of followUpDue) {
    await sendClientFollowUp(client);
    await prisma.client.update({
      where: { id: client.id },
      data: { followUpSentAt: new Date(), status: "active" },
    });
    followUpsSent++;
  }

  // --- 2. Check-in nudge, for clients quiet for more than 2 weeks ------------
  const nudgeDue = await prisma.client.findMany({
    where: {
      nudgeSentAt: null,
      status: { in: ["booked", "active"] },
      lastSessionAt: { lt: twoWeeksAgo },
    },
  });

  let nudgesSent = 0;
  for (const client of nudgeDue) {
    await sendClientNudge(client);
    await prisma.client.update({
      where: { id: client.id },
      data: { nudgeSentAt: new Date(), status: "past" },
    });
    nudgesSent++;
  }

  return NextResponse.json({ ok: true, followUpsSent, nudgesSent });
}
