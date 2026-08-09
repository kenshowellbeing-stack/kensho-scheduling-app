import Link from "next/link";
import { DateTime } from "luxon";
import { prisma } from "@/lib/db";
import { getAvailableSlots } from "@/lib/availability";
import { isWithinChangeWindow } from "@/lib/booking";
import { formatPrice } from "@/lib/format";
import { cancelAction, rescheduleAction } from "./actions";

export const dynamic = "force-dynamic";

const BANNERS: Record<string, { tone: "good" | "bad"; text: string }> = {
  cancelled: { tone: "good", text: "Your booking has been cancelled. If you paid, a full refund is on its way." },
  rescheduled: { tone: "good", text: "Done — your booking has been moved to the new time." },
  too_late: { tone: "bad", text: "Sorry, changes can't be made this close to the appointment. Please get in touch and we'll help." },
  slot_unavailable: { tone: "bad", text: "That time was just taken — please pick another." },
  already_cancelled: { tone: "bad", text: "This booking is already cancelled." },
  not_confirmed: { tone: "bad", text: "This booking can't be rescheduled." },
  notfound: { tone: "bad", text: "We couldn't find that booking." },
};

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto max-w-2xl px-4 py-12">{children}</main>;
}

export default async function ManageBookingPage({
  params,
  searchParams,
}: {
  params: { token: string };
  searchParams: { msg?: string };
}) {
  const token = params.token;
  const booking = await prisma.booking.findUnique({
    where: { manageToken: token },
    include: { service: true },
  });

  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  const zone = settings?.timezone ?? "Europe/London";
  const cutoffH = settings?.cancelCutoffHours ?? 24;
  const banner = searchParams.msg ? BANNERS[searchParams.msg] : null;

  if (!booking) {
    return (
      <Shell>
        <h1 className="text-2xl font-semibold">Booking not found</h1>
        <p className="mt-2 text-zinc-400">This manage link is invalid or has expired.</p>
        <Link href="/" className="mt-6 inline-block text-zinc-400 underline hover:text-white">
          Back to booking
        </Link>
      </Shell>
    );
  }

  const when = DateTime.fromJSDate(booking.startsAt, { zone: "utc" })
    .setZone(zone)
    .toFormat("cccc d LLLL yyyy 'at' HH:mm");
  const cancelled = booking.status === "cancelled";
  const withinWindow = !cancelled && (await isWithinChangeWindow(booking.startsAt));

  const days = withinWindow ? (await getAvailableSlots(booking.serviceId)).days : [];

  return (
    <Shell>
      <h1 className="text-2xl font-semibold tracking-tight">Manage your booking</h1>

      {banner && (
        <p
          className={`mt-4 rounded-lg px-4 py-3 text-sm ${
            banner.tone === "good"
              ? "border border-emerald-800 bg-emerald-950 text-emerald-300"
              : "border border-amber-800 bg-amber-950 text-amber-300"
          }`}
        >
          {banner.text}
        </p>
      )}

      <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <p className="font-medium text-white">{booking.service.name}</p>
        <p className="mt-1 text-zinc-400">{when}</p>
        <p className="mt-1 text-sm text-zinc-400">
          {formatPrice(booking.service.priceCents)} ·{" "}
          <span className={cancelled ? "text-amber-400" : "text-emerald-400"}>
            {cancelled ? "Cancelled" : "Confirmed"}
          </span>
        </p>
      </div>

      {cancelled ? (
        <p className="mt-6 text-zinc-400">
          This booking is cancelled.{" "}
          <Link href="/" className="underline hover:text-white">
            Book a new time
          </Link>
          .
        </p>
      ) : !withinWindow ? (
        <p className="mt-6 rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-400">
          Bookings can be changed or cancelled up to {cutoffH} hours beforehand. This one is
          now inside that window — please get in touch if you need to make a change.
        </p>
      ) : (
        <>
          {/* Cancel */}
          <div className="mt-8">
            <h2 className="text-sm font-semibold text-zinc-300">Cancel</h2>
            <form action={cancelAction} className="mt-2">
              <input type="hidden" name="token" value={token} />
              <button className="rounded-lg border border-red-800 bg-red-950 px-4 py-2 text-sm font-medium text-red-300 hover:bg-red-900">
                Cancel booking{booking.service.priceCents > 0 ? " & refund" : ""}
              </button>
            </form>
          </div>

          {/* Reschedule */}
          <div className="mt-10">
            <h2 className="text-sm font-semibold text-zinc-300">Or reschedule to a new time</h2>
            <p className="mt-1 text-sm text-zinc-500">Times shown in {zone}.</p>
            {days.length === 0 ? (
              <p className="mt-4 text-sm text-zinc-400">No other times are available right now.</p>
            ) : (
              <div className="mt-4 space-y-5">
                {days.map((day) => (
                  <div key={day.date}>
                    <h3 className="mb-2 text-sm font-semibold text-zinc-300">
                      {day.weekdayLabel} {day.dateLabel}
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {day.slots.map((slot) => (
                        <form key={slot.startISO} action={rescheduleAction}>
                          <input type="hidden" name="token" value={token} />
                          <input type="hidden" name="startISO" value={slot.startISO} />
                          <button className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:border-white hover:bg-white hover:text-black">
                            {slot.label}
                          </button>
                        </form>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </Shell>
  );
}
