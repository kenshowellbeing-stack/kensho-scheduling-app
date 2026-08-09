import { google } from "googleapis";
import { prisma } from "./db";

// One-way sync: when a booking is confirmed, we push it to your Google
// Calendar so it shows up alongside the rest of your life without you having
// to re-type it anywhere. This never reads from Google — only writes.

function getOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REDIRECT_URI in .env"
    );
  }
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

// Step 1 of connecting: build the URL you visit to grant this app access to
// your calendar. access_type=offline + prompt=consent are what make Google
// hand back a refresh_token we can reuse forever (not just a short-lived one).
export function getGoogleAuthUrl(): string {
  const client = getOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    // Full calendar scope, not just .events: we also need to list every
    // calendar visible to this account (including ones shared into it from
    // your other accounts) and read free/busy across all of them.
    scope: ["https://www.googleapis.com/auth/calendar"],
  });
}

// Step 2 of connecting: exchange the one-time code Google sent back for a
// refresh token, and save it so future bookings can be pushed automatically.
export async function saveGoogleTokensFromCode(code: string): Promise<void> {
  const client = getOAuthClient();
  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error(
      "Google didn't return a refresh token. This usually means the account " +
        "was already connected once before — go to https://myaccount.google.com/permissions, " +
        "remove this app's access, and try connecting again."
    );
  }
  await prisma.settings.update({
    where: { id: 1 },
    data: { googleRefreshToken: tokens.refresh_token },
  });
}

type BookingForCalendar = {
  id: number;
  customerName: string;
  customerEmail: string;
  startsAt: Date;
  endsAt: Date;
  service: { name: string };
};

// Push a confirmed booking to Google Calendar. Returns quietly (does nothing)
// if the calendar isn't connected yet — calendar sync is a nice-to-have and
// must never block a real booking from succeeding.
export async function pushBookingToGoogleCalendar(
  booking: BookingForCalendar
): Promise<string | null> {
  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  if (!settings?.googleRefreshToken) return null;

  const client = getOAuthClient();
  client.setCredentials({ refresh_token: settings.googleRefreshToken });
  const calendar = google.calendar({ version: "v3", auth: client });

  const res = await calendar.events.insert({
    calendarId: settings.googleCalendarId,
    requestBody: {
      summary: `${booking.service.name} — ${booking.customerName}`,
      description: `Booked via Kenshō booking site.\nCustomer: ${booking.customerName}\nEmail: ${booking.customerEmail}\nBooking ID: ${booking.id}`,
      start: { dateTime: booking.startsAt.toISOString() },
      end: { dateTime: booking.endsAt.toISOString() },
    },
  });
  return res.data.id ?? null; // caller persists this so the event can be moved/deleted later
}

// Move an existing calendar event to a new time (for reschedules).
export async function updateCalendarEvent(
  eventId: string,
  startsAt: Date,
  endsAt: Date
): Promise<void> {
  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  if (!settings?.googleRefreshToken) return;

  const client = getOAuthClient();
  client.setCredentials({ refresh_token: settings.googleRefreshToken });
  const calendar = google.calendar({ version: "v3", auth: client });

  await calendar.events.patch({
    calendarId: settings.googleCalendarId,
    eventId,
    requestBody: {
      start: { dateTime: startsAt.toISOString() },
      end: { dateTime: endsAt.toISOString() },
    },
  });
}

// Delete a calendar event (for cancellations).
export async function deleteCalendarEvent(eventId: string): Promise<void> {
  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  if (!settings?.googleRefreshToken) return;

  const client = getOAuthClient();
  client.setCredentials({ refresh_token: settings.googleRefreshToken });
  const calendar = google.calendar({ version: "v3", auth: client });

  await calendar.events.delete({
    calendarId: settings.googleCalendarId,
    eventId,
  });
}

// Read busy time across every calendar visible to the connected account
// (your own calendars plus any shared/subscribed into it — e.g. work and
// personal calendars shared in, or a Hotmail calendar added via iCal URL).
// Used so the booking page won't offer a slot you're already busy for
// somewhere else. Fails open (returns []) if not connected or if Google is
// having issues — a calendar hiccup should never take the whole booking site
// down, it just means this extra layer of protection is skipped for a moment.
export async function getGoogleBusyIntervals(
  rangeStart: Date,
  rangeEnd: Date
): Promise<{ start: number; end: number }[]> {
  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  if (!settings?.googleRefreshToken) return [];

  try {
    const client = getOAuthClient();
    client.setCredentials({ refresh_token: settings.googleRefreshToken });
    const calendar = google.calendar({ version: "v3", auth: client });

    const calendarList = await calendar.calendarList.list();
    const calendarIds = (calendarList.data.items ?? [])
      .map((c) => c.id)
      .filter((id): id is string => !!id);
    if (calendarIds.length === 0) return [];

    const freeBusy = await calendar.freebusy.query({
      requestBody: {
        timeMin: rangeStart.toISOString(),
        timeMax: rangeEnd.toISOString(),
        items: calendarIds.map((id) => ({ id })),
      },
    });

    const intervals: { start: number; end: number }[] = [];
    for (const cal of Object.values(freeBusy.data.calendars ?? {})) {
      for (const busy of cal.busy ?? []) {
        if (busy.start && busy.end) {
          intervals.push({
            start: new Date(busy.start).getTime(),
            end: new Date(busy.end).getTime(),
          });
        }
      }
    }
    return intervals;
  } catch (err) {
    console.error("Failed to read Google Calendar busy times:", err);
    return [];
  }
}
