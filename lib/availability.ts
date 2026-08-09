import { DateTime } from "luxon";
import { prisma } from "./db";
import { getGoogleBusyIntervals } from "./googleCalendar";

// ---------------------------------------------------------------------------
// Types returned to the UI.
// ---------------------------------------------------------------------------
export type Slot = {
  startISO: string; // absolute start time, in UTC ISO form (e.g. 2026-08-11T13:00:00.000Z)
  label: string; // human label in the provider's timezone (e.g. "14:00")
};

export type DayWithSlots = {
  date: string; // "yyyy-MM-dd" in the provider's timezone
  weekdayLabel: string; // e.g. "Tue"
  dateLabel: string; // e.g. "12 Aug"
  slots: Slot[];
};

// Do two time intervals [aStart, aEnd) and [bStart, bEnd) overlap?
// All arguments are epoch milliseconds.
function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && bStart < aEnd;
}

// Bookings that actually occupy time: confirmed ones, plus pending ones whose
// 15-minute payment hold hasn't expired. (Once Stripe is added, pending holds
// matter; for now everything is confirmed.)
function occupiesTime(now: Date) {
  return {
    OR: [
      { status: "confirmed" },
      { status: "pending", holdExpiresAt: { gt: now } },
    ],
  };
}

// ---------------------------------------------------------------------------
// Load the config we need to compute availability.
// ---------------------------------------------------------------------------
async function loadContext() {
  const settings =
    (await prisma.settings.findUnique({ where: { id: 1 } })) ??
    // Fall back to sane defaults if the settings row is somehow missing.
    { id: 1, timezone: "Europe/London", bufferMinutes: 15, minNoticeHours: 12 };

  const rules = await prisma.availabilityRule.findMany();
  const rulesByWeekday = new Map<number, (typeof rules)[number]>();
  for (const r of rules) rulesByWeekday.set(r.weekday, r);

  return { settings, rulesByWeekday };
}

// ---------------------------------------------------------------------------
// Main entry point: list available slots for a service over the next N days.
// ---------------------------------------------------------------------------
export async function getAvailableSlots(
  serviceId: number,
  daysAhead = 21
): Promise<{ service: { id: number; name: string; durationMinutes: number; priceCents: number }; days: DayWithSlots[] }> {
  const service = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!service || !service.active) {
    throw new Error("Service not found");
  }

  const { settings, rulesByWeekday } = await loadContext();
  const zone = settings.timezone;
  const duration = service.durationMinutes;
  const buffer = settings.bufferMinutes;

  const now = new Date();
  const earliestStartMs = now.getTime() + settings.minNoticeHours * 60 * 60 * 1000;

  // Window we search: from the start of today (in the provider's zone) to the
  // end of the last day. We fetch existing bookings/blackouts once for the
  // whole window, then filter per candidate slot in memory.
  const windowStart = DateTime.now().setZone(zone).startOf("day");
  const windowEnd = windowStart.plus({ days: daysAhead }).endOf("day");

  const [bookings, blackouts, googleBusy] = await Promise.all([
    prisma.booking.findMany({
      where: {
        AND: [
          occupiesTime(now),
          { startsAt: { lt: windowEnd.toJSDate() } },
          { endsAt: { gt: windowStart.toJSDate() } },
        ],
      },
      select: { startsAt: true, endsAt: true },
    }),
    prisma.blackoutDate.findMany({
      where: {
        startsAt: { lt: windowEnd.toJSDate() },
        endsAt: { gt: windowStart.toJSDate() },
      },
      select: { startsAt: true, endsAt: true },
    }),
    getGoogleBusyIntervals(windowStart.toJSDate(), windowEnd.toJSDate()),
  ]);

  // Pre-expand bookings by the buffer on both sides (buffer = gap between appts).
  const busy = bookings.map((b) => ({
    start: b.startsAt.getTime() - buffer * 60 * 1000,
    end: b.endsAt.getTime() + buffer * 60 * 1000,
  }));
  // Blackouts and events from your other calendars are hard blocks (no buffer).
  const blocked = [
    ...blackouts.map((b) => ({ start: b.startsAt.getTime(), end: b.endsAt.getTime() })),
    ...googleBusy,
  ];

  const days: DayWithSlots[] = [];

  for (let i = 0; i <= daysAhead; i++) {
    const day = windowStart.plus({ days: i });
    // Luxon weekday: 1=Mon..7=Sun. Our schema: 0=Sun..6=Sat. This maps cleanly.
    const schemaWeekday = day.weekday % 7;
    const rule = rulesByWeekday.get(schemaWeekday);
    if (!rule || !rule.enabled) continue;

    const workStart = day.plus({ minutes: rule.startMinute });
    const workEnd = day.plus({ minutes: rule.endMinute });

    const slots: Slot[] = [];
    // Step across the working window in increments of the service duration, so
    // slots are back-to-back (9:00, 10:00, ... for a 60-min service).
    let candidate = workStart;
    const workEndMs = workEnd.toMillis();
    while (candidate.plus({ minutes: duration }).toMillis() <= workEndMs) {
      const candStart = candidate.toMillis();
      const candEnd = candidate.plus({ minutes: duration }).toMillis();

      const tooSoon = candStart < earliestStartMs;
      const hitsBooking = busy.some((b) => overlaps(candStart, candEnd, b.start, b.end));
      const hitsBlackout = blocked.some((b) => overlaps(candStart, candEnd, b.start, b.end));

      if (!tooSoon && !hitsBooking && !hitsBlackout) {
        slots.push({
          startISO: candidate.toUTC().toISO()!,
          label: candidate.toFormat("HH:mm"),
        });
      }

      candidate = candidate.plus({ minutes: duration });
    }

    if (slots.length > 0) {
      days.push({
        date: day.toFormat("yyyy-MM-dd"),
        weekdayLabel: day.toFormat("ccc"),
        dateLabel: day.toFormat("d LLL"),
        slots,
      });
    }
  }

  return {
    service: {
      id: service.id,
      name: service.name,
      durationMinutes: service.durationMinutes,
      priceCents: service.priceCents,
    },
    days,
  };
}

// ---------------------------------------------------------------------------
// Re-check a single slot at booking time. Never trust the browser: even if the
// UI offered a slot, we recompute here before saving to prevent double-booking
// or tampering. Returns the validated start/end (as UTC Dates) or throws.
// ---------------------------------------------------------------------------
export async function validateSlot(
  serviceId: number,
  startISO: string
): Promise<{ startsAt: Date; endsAt: Date }> {
  const service = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!service || !service.active) throw new Error("Service not found");

  const { settings, rulesByWeekday } = await loadContext();
  const zone = settings.timezone;
  const duration = service.durationMinutes;
  const buffer = settings.bufferMinutes;

  const start = DateTime.fromISO(startISO, { zone: "utc" }).setZone(zone);
  if (!start.isValid) throw new Error("Invalid start time");

  const end = start.plus({ minutes: duration });

  // 1. Must fall on a working day within working hours.
  const schemaWeekday = start.weekday % 7;
  const rule = rulesByWeekday.get(schemaWeekday);
  if (!rule || !rule.enabled) throw new Error("Outside working days");

  const day = start.startOf("day");
  const workStart = day.plus({ minutes: rule.startMinute });
  const workEnd = day.plus({ minutes: rule.endMinute });
  if (start.toMillis() < workStart.toMillis() || end.toMillis() > workEnd.toMillis())
    throw new Error("Outside working hours");

  // 2. Must respect minimum notice.
  const now = new Date();
  const earliestStartMs = now.getTime() + settings.minNoticeHours * 60 * 60 * 1000;
  if (start.toMillis() < earliestStartMs) throw new Error("Too soon to book");

  const candStart = start.toMillis();
  const candEnd = end.toMillis();

  // 3. Must not collide with an existing booking (+buffer), a blackout, or an
  //    event on one of your other connected calendars.
  const [bookings, blackouts, googleBusy] = await Promise.all([
    prisma.booking.findMany({
      where: {
        AND: [
          occupiesTime(now),
          { startsAt: { lt: end.toJSDate() } },
          { endsAt: { gt: start.toJSDate() } },
        ],
      },
      select: { startsAt: true, endsAt: true },
    }),
    prisma.blackoutDate.findMany({
      where: { startsAt: { lt: end.toJSDate() }, endsAt: { gt: start.toJSDate() } },
      select: { startsAt: true, endsAt: true },
    }),
    getGoogleBusyIntervals(start.toJSDate(), end.toJSDate()),
  ]);

  const hitsBooking = bookings.some((b) =>
    overlaps(
      candStart,
      candEnd,
      b.startsAt.getTime() - buffer * 60 * 1000,
      b.endsAt.getTime() + buffer * 60 * 1000
    )
  );
  const hitsBlackout = blackouts.some((b) =>
    overlaps(candStart, candEnd, b.startsAt.getTime(), b.endsAt.getTime())
  );
  const hitsGoogleBusy = googleBusy.some((b) => overlaps(candStart, candEnd, b.start, b.end));
  if (hitsBooking || hitsBlackout || hitsGoogleBusy)
    throw new Error("That slot is no longer available");

  return { startsAt: start.toUTC().toJSDate(), endsAt: end.toUTC().toJSDate() };
}
