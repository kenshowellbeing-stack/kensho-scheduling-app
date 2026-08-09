# Booking App — project context & handoff

This file is auto-loaded by Claude Code. It exists so a fresh Claude Code
session (e.g. on a newly set-up machine) has full context. **The user is not a
developer — explain steps in plain English, and give zero-prior-knowledge
instructions when they need to install a tool, sign up for a service, or paste
an API key. Ask for credentials when needed rather than assuming.**

## What this is
A personal, **single-provider** appointment-booking web app to replace an Acuity
Scheduling subscription, for the user's own business (Kenshō). No multi-tenancy.

## Stack
Next.js 14 (App Router) + TypeScript · Prisma **v6** (pin the CLI to
`6.19.3` — see Prisma note below) + SQLite · Tailwind · Stripe Checkout ·
Google Calendar API (googleapis) · (later) Resend emails.

## Build order (the user's spec)
1. Data model + admin config ✅ DONE
2. Public booking page ✅ DONE
3. Stripe Checkout + webhook + 15-min unpaid-hold release ✅ DONE (fully tested)
4. Google Calendar sync (two-way: pushes bookings out, checks busy time in)
   ✅ DONE (verified end-to-end: real test booking appeared on Kenshō's
   Google Calendar; test data cleaned up afterward)
5. Email confirmations + 24h reminder cron ⬜ CODE DONE + Resend API key set;
   domain (kenshowellbeing.co.uk) verification pending DNS propagation, then
   a real send test (see below)
6. Password-protected admin view (upcoming bookings, block dates, edit services)
   ✅ CODE DONE, verified in browser (login guard, bookings, blackout add/remove,
   services render). ADMIN_PASSWORD still the placeholder — user to change it.

## What's built (steps 1–3)
- **Data model** — `prisma/schema.prisma`: `Service`, `AvailabilityRule`
  (one row per weekday, times as minutes-since-midnight), `BlackoutDate`,
  `Booking` (status: pending/confirmed/cancelled/expired/conflict; stripePaymentId;
  holdExpiresAt), `Settings` (single row id=1: timezone, bufferMinutes,
  minNoticeHours). Seed in `prisma/seed.ts` (`npx prisma db seed`): 3 example
  services, Mon–Fri 9–5, 15-min buffer, 12-hour min notice, tz Europe/London.
- **Availability engine** — `lib/availability.ts`. `getAvailableSlots()` lists
  slots respecting working hours, buffer (expands existing bookings ±buffer),
  blackouts, min-notice, and timezone (Luxon). Slots step by the service's
  duration. `validateSlot()` re-checks a single slot server-side at booking time
  (never trust the browser).
- **Public UI** — `app/page.tsx` (service list), `app/book/[serviceId]/page.tsx`
  (server-loads slots) → `components/BookingFlow.tsx` (client: pick slot → name/
  email → pay). `app/book/success/page.tsx` (confirmation + fallback confirm).
- **Payments** — `app/api/checkout/route.ts`: validates slot, creates a
  **pending** booking with a 15-min hold, then a Stripe Checkout session
  (free £0 services skip Stripe and confirm directly). `lib/booking.ts`:
  idempotent `confirmBooking()` (with conflict guard) + `expireStaleHolds()`.
  `app/api/webhooks/stripe/route.ts`: verifies signature, confirms on
  `checkout.session.completed`, releases hold on `checkout.session.expired`.

## What's built (step 4 — Google Calendar sync, two-way)
User has calendars across personal Gmail, Kenshō Gmail, work Gmail, and
Hotmail. Deliberately **not** syncing Hotmail — a Microsoft Graph
integration was built and then removed (see git history / prior discussion)
because it doubled the setup work (separate Azure app registration, a
client secret that expires and needs manual renewal) for one calendar the
user has decided to stop using for scheduling instead. Only Google is
integrated: user shares personal + work calendars into the Kenshō account,
and the app connects only to that one account. Full `calendar` OAuth scope
(not just `.events`) so the app can also list calendars and query free/busy,
not just create events.
**If Hotmail sync is ever wanted later**, rebuilding it is straightforward:
mirror `lib/googleCalendar.ts`'s pattern against Microsoft Graph's
`/me/calendarView` endpoint (OAuth via `https://login.microsoftonline.com`,
tenant `common`) — this was already prototyped once.
- **`lib/googleCalendar.ts`**: `getGoogleAuthUrl()` builds the consent-screen
  URL; `saveGoogleTokensFromCode()` exchanges the OAuth code for a refresh
  token and saves it to `Settings.googleRefreshToken`;
  `pushBookingToGoogleCalendar()` creates one event (best-effort — returns
  quietly if not connected yet, never throws into the booking flow).
  `getGoogleBusyIntervals(rangeStart, rangeEnd)` lists every calendar visible
  to the connected account (own + shared + subscribed) and queries
  free/busy across all of them — fails open (returns `[]`) if not connected
  or if Google errors, so a Google hiccup never takes down the booking page.
- Wired into `lib/availability.ts`: both `getAvailableSlots()` and
  `validateSlot()` now also exclude times busy on any connected calendar,
  same as blackout dates (hard block, no buffer expansion).
- **`app/api/google/connect/route.ts`**: visit to start the one-time consent
  flow. **`app/api/google/callback/route.ts`**: Google redirects here after
  the user clicks Allow; saves the refresh token to the DB.
- Wired into every booking-confirm path: `confirmBooking()` in
  `lib/booking.ts` (paid bookings, called from both the webhook and the
  success-page fallback — safe since it's idempotent) and the free-service
  branch of `app/api/checkout/route.ts` (bypasses `confirmBooking()` entirely,
  so it has its own push call).
- New `.env` vars: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
  `GOOGLE_REDIRECT_URI` (must exactly match the redirect URI registered in
  Google Cloud Console). Refresh token itself lives in the DB, not `.env`.
- Needs `Settings.googleRefreshToken` / `googleCalendarId` — added via
  migration `add_google_calendar_fields`.

## What's built (step 5 — emails + reminders)
- **`lib/email.ts`** (Resend): `sendBookingConfirmation()` and
  `sendBookingReminder()`. Best-effort/non-blocking like the calendar push —
  return quietly if `RESEND_API_KEY` is unset, catch + log on error, never
  throw into the booking flow. `EMAIL_FROM` sets the sender; defaults to
  `Kenshō <onboarding@resend.dev>` (Resend's test domain) until a real domain
  is verified.
- Confirmation wired into the same two confirm paths as the calendar push:
  `confirmBooking()` (paid) and the free-service branch of the checkout route.
- **`app/api/cron/reminders/route.ts`**: sends a one-time reminder for every
  confirmed booking starting within the next 24h with `reminderSentAt == null`,
  then stamps `reminderSentAt` (idempotent — safe to run repeatedly). Guarded
  by `CRON_SECRET` (accepts `Authorization: Bearer <secret>` — what Vercel Cron
  sends automatically — or `?secret=` for manual testing).
- **`vercel.json`**: daily cron at 08:00 UTC hitting that route. Daily is the
  Vercel Hobby-plan limit; on a paid plan, change to hourly (`0 * * * *`) for
  tighter ~24h-before timing (no code change needed). Reminders only fire once
  the app is deployed — a local dev server won't run the cron.
- New `.env` vars: `RESEND_API_KEY`, `EMAIL_FROM`, `CRON_SECRET`.
- `Booking.reminderSentAt` added via migration `add_reminder_sent_at`.

## What's built (step 6 — admin panel)
- **Auth**: single admin password in `ADMIN_PASSWORD`. `lib/adminAuth.ts` —
  login sets an httpOnly cookie holding `sha256(password)`; `requireAdmin()`
  re-checks it (constant-time). No DB sessions.
- **Routing**: `app/admin/login` is unguarded; the protected pages live under
  the `app/admin/(dashboard)` route group whose `layout.tsx` calls
  `requireAdmin()` (so the group, not a top-level `/admin` layout, is the guard
  — avoids a redirect loop with the login page). Pages: `/admin` (upcoming
  bookings + cancel), `/admin/blackouts` (add/remove, times entered in the
  provider timezone and stored UTC via Luxon), `/admin/services` (add/edit,
  price entered in £ and stored as cents, activate/deactivate).
- **Mutations** are server actions in `app/admin/actions.ts` (+ `login` in
  `app/admin/login/actions.ts`), each calling `requireAdmin()` first and
  `revalidatePath()` after; service edits also revalidate `/` so the public
  list updates.
- New `.env` var: `ADMIN_PASSWORD` (currently the placeholder
  `kensho-admin-change-me` — must be changed).

## Deployed to production
Live at **book.kenshowellbeing.co.uk** (Vercel project `kensho-booking`).
DB is **Neon Postgres** (not SQLite anymore) — `schema.prisma` provider is
`postgresql` with `url`=pooled + `directUrl`=unpooled; local dev points at the
same Neon DB. Prod env vars set in Vercel (Stripe is **live** keys +
production webhook; local `.env` stays on test keys). Build runs
`prisma generate && next build`. Schema changes are applied to Neon with
`npx prisma db push` (Vercel does not run migrations on deploy). Favicon is the
logo via `app/icon.png` / `app/apple-icon.png` (default favicon.ico removed).

## What's built (step 7 — self-service cancel / reschedule)
- Every booking gets a secret `Booking.manageToken`; the confirmation email and
  success page link to **`/booking/manage/[token]`** (no login).
- That page lets the customer **cancel** (auto full Stripe refund if paid,
  deletes the calendar event, emails them) or **reschedule** (re-validates the
  new slot, moves the calendar event, emails them) — gated by
  `Settings.cancelCutoffHours` (default 24h before).
- Core logic in `lib/booking.ts`: `cancelBookingWithRefund()` +
  `rescheduleBooking()` (both take `{ enforceWindow }`). Admin cancel now calls
  `cancelBookingWithRefund(id, { enforceWindow: false })` so it also refunds.
- `Booking.googleEventId` stores the created event id so it can be moved/deleted;
  `lib/googleCalendar.ts` gained `updateCalendarEvent()` + `deleteCalendarEvent()`.

## Branding / theme
Black primary, white secondary (Kenshō brand). Global base in
`app/globals.css` (black bg `#000`, white text). Pattern used across pages:
surfaces `bg-zinc-900` + `border-zinc-800`; inputs `bg-zinc-950 text-white
border-zinc-700 focus:border-white`; **primary CTAs are white** (`bg-white
text-black hover:bg-zinc-200`); muted text `text-zinc-400`; slot buttons invert
to white-on-black on hover. Logo at `public/logo.png` (white enso on black,
blends into the page) shown on the home page and admin login via `next/image`.
Keep new UI consistent with this — don't reintroduce light-theme `gray-`/
`bg-white` surfaces.

## Conventions (keep these)
- **Money in cents** (`priceCents`, e.g. 12000 = £120). Currency GBP, in
  `lib/format.ts` (`CURRENCY`). Stripe uses the same.
- **Times of day = minutes since midnight** in `AvailabilityRule`.
- **Booking datetimes stored as UTC**; all slot math done in `Settings.timezone`
  (Europe/London) via Luxon.
- Unpaid holds auto-free from availability the moment `holdExpiresAt` passes
  (the availability query only counts pending bookings with a future hold), so
  no cron is required just to release slots.

## How the slot-release works without a cron
Availability ignores lapsed holds automatically. `expireStaleHolds()` only tidies
the row's status label and is called opportunistically from the checkout route.

## Running it
- Dev: `npm run dev` → http://localhost:3000
- After `npm install` on a new machine, run `npx prisma generate` (npm may skip
  Prisma's postinstall). The SQLite DB is `prisma/dev.db` (included, seeded).
- Re-seed: `npx prisma db seed`. npm "warn allow-scripts" messages are benign.
- **Prisma CLI/client version must stay matched.** `npm install` can pull the
  newest `prisma` CLI (v7) even though `@prisma/client` is pinned to `6.19.3`
  — v7's CLI dropped support for `datasource { url = env(...) }` in
  `schema.prisma` and `migrate dev` fails with a P1012 error if versions
  drift. Keep `prisma` devDependency pinned to `6.19.3` to match.

## Stripe notes (test mode)
- `.env` holds `STRIPE_SECRET_KEY` (test, `sk_test_…`) and `NEXT_PUBLIC_APP_URL`.
- `STRIPE_WEBHOOK_SECRET` in `.env` came from the OLD machine's Stripe CLI and is
  **stale here**. The success-page fallback confirms bookings without it, so the
  happy path works. To live-test the webhook on THIS machine: install the Stripe
  CLI, run `stripe listen --forward-to localhost:3000/api/webhooks/stripe`, copy
  the printed `whsec_…` into `.env`, restart `npm run dev`. In production the
  webhook is configured as a public URL in the Stripe dashboard (no CLI).
- Test card: `4242 4242 4242 4242`, any future expiry, any CVC.

## History / status
Steps 1–3 built and verified end-to-end on a previous machine (real test-card
payment confirmed a booking; webhook independently confirmed a booking too).
Project was then migrated to this personal Mac. Next task: **Step 4, Google
Calendar sync** — push each confirmed booking to the user's Google Calendar via
OAuth, with customer details in the event description. This needs the user to
create free Google Cloud OAuth credentials (walk them through it step by step).
