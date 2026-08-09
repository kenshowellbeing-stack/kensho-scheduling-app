import { Resend } from "resend";
import { DateTime } from "luxon";
import { prisma } from "./db";
import { formatPrice } from "./format";

// Transactional emails via Resend. Like the calendar push, these are
// best-effort: if email isn't configured yet (no RESEND_API_KEY) or Resend
// errors, we log and move on — a booking must never fail because an email
// didn't send.

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

// Who the emails come from, e.g. "Kenshō <hello@yourdomain.com>". Must be an
// address on a domain you've verified in Resend (or resend.dev while testing).
function fromAddress(): string {
  return process.env.EMAIL_FROM || "Kenshō <onboarding@resend.dev>";
}

function manageUrl(token: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base}/booking/manage/${token}`;
}

type BookingForEmail = {
  customerName: string;
  customerEmail: string;
  startsAt: Date;
  manageToken?: string | null;
  service: { name: string; priceCents: number; durationMinutes: number };
};

async function formatWhen(startsAt: Date): Promise<string> {
  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  const zone = settings?.timezone ?? "Europe/London";
  return DateTime.fromJSDate(startsAt, { zone: "utc" })
    .setZone(zone)
    .toFormat("cccc d LLLL yyyy 'at' HH:mm");
}

function wrapHtml(inner: string): string {
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;color:#111;line-height:1.5">${inner}</div>`;
}

// A "Manage / cancel / reschedule" block appended to emails when we have a token.
function manageBlock(manageToken?: string | null): { html: string; text: string } {
  if (!manageToken) return { html: "", text: "" };
  const url = manageUrl(manageToken);
  return {
    html: `<p style="margin:16px 0"><a href="${url}" style="color:#111">Need to change or cancel? Manage your booking here.</a></p>`,
    text: `\nNeed to change or cancel? Manage your booking: ${url}\n`,
  };
}

export async function sendBookingConfirmation(booking: BookingForEmail): Promise<void> {
  const resend = getResend();
  if (!resend) return;

  try {
    const when = await formatWhen(booking.startsAt);
    const priceLine =
      booking.service.priceCents === 0
        ? "Free"
        : `Paid ${formatPrice(booking.service.priceCents)}`;
    const manage = manageBlock(booking.manageToken);

    await resend.emails.send({
      from: fromAddress(),
      to: booking.customerEmail,
      subject: `Booking confirmed: ${booking.service.name} — ${when}`,
      text: `Hi ${booking.customerName},\n\nYour booking is confirmed.\n\n${booking.service.name}\n${when}\n${priceLine}\n${manage.text}\nSee you then!\nKenshō`,
      html: wrapHtml(
        `<h2 style="margin:0 0 12px">You're booked! 🎉</h2>
         <p>Hi ${booking.customerName},</p>
         <p>Your booking is confirmed:</p>
         <p style="background:#f6f6f6;border-radius:8px;padding:16px;margin:16px 0">
           <strong>${booking.service.name}</strong><br>${when}<br>${priceLine}
         </p>
         ${manage.html}
         <p>See you then!<br>Kenshō</p>`
      ),
    });
  } catch (err) {
    console.error("Failed to send confirmation email:", err);
  }
}

// Notify the business owner (you) whenever a customer books. Sent to
// OWNER_EMAIL; skipped silently if that isn't set. Best-effort like the rest.
export async function sendOwnerBookingNotification(booking: BookingForEmail): Promise<void> {
  const resend = getResend();
  if (!resend) return;
  const owner = process.env.OWNER_EMAIL;
  if (!owner) return;

  try {
    const when = await formatWhen(booking.startsAt);
    const priceLine =
      booking.service.priceCents === 0 ? "Free" : formatPrice(booking.service.priceCents);
    await resend.emails.send({
      from: fromAddress(),
      to: owner,
      subject: `New booking: ${booking.service.name} — ${when}`,
      text: `New booking:\n\n${booking.service.name}\n${when}\n${priceLine}\n\nCustomer: ${booking.customerName}\nEmail: ${booking.customerEmail}`,
      html: wrapHtml(
        `<h2 style="margin:0 0 12px">New booking 📅</h2>
         <p style="background:#f6f6f6;border-radius:8px;padding:16px;margin:16px 0">
           <strong>${booking.service.name}</strong><br>${when}<br>${priceLine}
         </p>
         <p><strong>${booking.customerName}</strong><br>${booking.customerEmail}</p>`
      ),
    });
  } catch (err) {
    console.error("Failed to send owner notification email:", err);
  }
}

export async function sendBookingReminder(booking: BookingForEmail): Promise<void> {
  const resend = getResend();
  if (!resend) return;

  try {
    const when = await formatWhen(booking.startsAt);
    const manage = manageBlock(booking.manageToken);
    await resend.emails.send({
      from: fromAddress(),
      to: booking.customerEmail,
      subject: `Reminder: ${booking.service.name} tomorrow — ${when}`,
      text: `Hi ${booking.customerName},\n\nThis is a friendly reminder of your upcoming booking:\n\n${booking.service.name}\n${when}\n${manage.text}\nSee you then!\nKenshō`,
      html: wrapHtml(
        `<h2 style="margin:0 0 12px">See you tomorrow 👋</h2>
         <p>Hi ${booking.customerName},</p>
         <p>A friendly reminder of your upcoming booking:</p>
         <p style="background:#f6f6f6;border-radius:8px;padding:16px;margin:16px 0">
           <strong>${booking.service.name}</strong><br>${when}
         </p>
         ${manage.html}
         <p>See you then!<br>Kenshō</p>`
      ),
    });
  } catch (err) {
    console.error("Failed to send reminder email:", err);
  }
}

export async function sendBookingCancellation(
  booking: BookingForEmail,
  refunded: boolean
): Promise<void> {
  const resend = getResend();
  if (!resend) return;

  try {
    const when = await formatWhen(booking.startsAt);
    const refundLine = refunded
      ? "Your payment has been refunded in full — it may take a few days to show on your statement."
      : "";
    await resend.emails.send({
      from: fromAddress(),
      to: booking.customerEmail,
      subject: `Booking cancelled: ${booking.service.name} — ${when}`,
      text: `Hi ${booking.customerName},\n\nYour booking has been cancelled:\n\n${booking.service.name}\n${when}\n\n${refundLine}\n\nHope to see you another time.\nKenshō`,
      html: wrapHtml(
        `<h2 style="margin:0 0 12px">Booking cancelled</h2>
         <p>Hi ${booking.customerName},</p>
         <p>Your booking has been cancelled:</p>
         <p style="background:#f6f6f6;border-radius:8px;padding:16px;margin:16px 0">
           <strong>${booking.service.name}</strong><br>${when}
         </p>
         ${refunded ? `<p>${refundLine}</p>` : ""}
         <p>Hope to see you another time.<br>Kenshō</p>`
      ),
    });
  } catch (err) {
    console.error("Failed to send cancellation email:", err);
  }
}

export async function sendBookingReschedule(
  booking: BookingForEmail,
  previousStartsAt: Date
): Promise<void> {
  const resend = getResend();
  if (!resend) return;

  try {
    const when = await formatWhen(booking.startsAt);
    const previous = await formatWhen(previousStartsAt);
    const manage = manageBlock(booking.manageToken);
    await resend.emails.send({
      from: fromAddress(),
      to: booking.customerEmail,
      subject: `Booking moved: ${booking.service.name} — ${when}`,
      text: `Hi ${booking.customerName},\n\nYour booking has been rescheduled.\n\nNew time: ${when}\n(was ${previous})\n${manage.text}\nSee you then!\nKenshō`,
      html: wrapHtml(
        `<h2 style="margin:0 0 12px">Your booking has moved</h2>
         <p>Hi ${booking.customerName},</p>
         <p>Your booking has been rescheduled:</p>
         <p style="background:#f6f6f6;border-radius:8px;padding:16px;margin:16px 0">
           <strong>${booking.service.name}</strong><br>${when}<br>
           <span style="color:#888;text-decoration:line-through">${previous}</span>
         </p>
         ${manage.html}
         <p>See you then!<br>Kenshō</p>`
      ),
    });
  } catch (err) {
    console.error("Failed to send reschedule email:", err);
  }
}
