import Link from "next/link";
import { DateTime } from "luxon";
import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { confirmBooking } from "@/lib/booking";
import { formatPrice } from "@/lib/format";

// Don't cache this page — it reflects a just-completed payment.
export const dynamic = "force-dynamic";

function formatWhen(startsAt: Date, timezone: string) {
  return DateTime.fromJSDate(startsAt, { zone: "utc" })
    .setZone(timezone)
    .toFormat("cccc d LLLL yyyy 'at' HH:mm");
}

async function loadTimezone() {
  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  return settings?.timezone ?? "Europe/London";
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      {children}
      <Link
        href="/"
        className="mt-6 inline-block rounded-lg bg-white px-4 py-2 text-sm font-medium text-black hover:bg-zinc-200"
      >
        Back to services
      </Link>
    </main>
  );
}

export default async function SuccessPage({
  searchParams,
}: {
  searchParams: { session_id?: string; booking_id?: string };
}) {
  const timezone = await loadTimezone();

  // ---- Free booking path (no Stripe session) -------------------------------
  if (searchParams.booking_id) {
    const id = Number(searchParams.booking_id);
    const booking = Number.isInteger(id)
      ? await prisma.booking.findUnique({ where: { id }, include: { service: true } })
      : null;

    if (!booking || booking.status !== "confirmed") {
      return (
        <Shell>
          <h1 className="text-2xl font-semibold">Booking not found</h1>
          <p className="mt-2 text-zinc-400">We couldn&apos;t find that booking.</p>
        </Shell>
      );
    }

    return (
      <Shell>
        <ConfirmedCard
          serviceName={booking.service.name}
          when={formatWhen(booking.startsAt, timezone)}
          priceCents={booking.service.priceCents}
          email={booking.customerEmail}
          manageToken={booking.manageToken}
        />
      </Shell>
    );
  }

  // ---- Paid booking path (returning from Stripe) ---------------------------
  if (searchParams.session_id) {
    let session;
    try {
      session = await stripe.checkout.sessions.retrieve(searchParams.session_id);
    } catch {
      return (
        <Shell>
          <h1 className="text-2xl font-semibold">Something went wrong</h1>
          <p className="mt-2 text-zinc-400">
            We couldn&apos;t verify your payment. If you were charged, please get in touch.
          </p>
        </Shell>
      );
    }

    const bookingId = Number(session.metadata?.bookingId);

    if (session.payment_status !== "paid") {
      return (
        <Shell>
          <h1 className="text-2xl font-semibold">Payment not completed</h1>
          <p className="mt-2 text-zinc-400">
            Your payment wasn&apos;t completed, so no booking was made. Your slot is
            held for a few more minutes if you&apos;d like to try again.
          </p>
        </Shell>
      );
    }

    // Fallback confirmation (the webhook may also do this — it's idempotent).
    const paymentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id;
    const result = await confirmBooking(bookingId, paymentId);

    if (!result.ok && result.reason === "conflict") {
      return (
        <Shell>
          <h1 className="text-2xl font-semibold">We hit a snag</h1>
          <p className="mt-2 text-zinc-400">
            Your payment went through, but that time was just taken by someone else.
            Please get in touch and we&apos;ll arrange a refund or another time.
          </p>
        </Shell>
      );
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { service: true },
    });
    if (!booking) {
      return (
        <Shell>
          <h1 className="text-2xl font-semibold">Booking not found</h1>
        </Shell>
      );
    }

    return (
      <Shell>
        <ConfirmedCard
          serviceName={booking.service.name}
          when={formatWhen(booking.startsAt, timezone)}
          priceCents={booking.service.priceCents}
          email={booking.customerEmail}
          manageToken={booking.manageToken}
        />
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="text-2xl font-semibold">Nothing to show</h1>
      <p className="mt-2 text-zinc-400">No booking information was provided.</p>
    </Shell>
  );
}

function ConfirmedCard({
  serviceName,
  when,
  priceCents,
  email,
  manageToken,
}: {
  serviceName: string;
  when: string;
  priceCents: number;
  email: string;
  manageToken?: string | null;
}) {
  return (
    <div className="rounded-xl border border-emerald-800 bg-emerald-950 p-6">
      <h1 className="text-2xl font-semibold text-emerald-300">You&apos;re booked! 🎉</h1>
      <p className="mt-3 text-emerald-100">
        <strong>{serviceName}</strong>
        <br />
        {when}
      </p>
      <p className="mt-2 text-sm text-emerald-300">
        {priceCents === 0 ? "Free booking" : `Paid ${formatPrice(priceCents)}`}
      </p>
      <p className="mt-3 text-sm text-emerald-400">
        A confirmation email has been sent to {email}.
      </p>
      {manageToken && (
        <p className="mt-3 text-sm">
          <a
            href={`/booking/manage/${manageToken}`}
            className="text-emerald-200 underline hover:text-white"
          >
            Manage this booking (cancel or reschedule)
          </a>
        </p>
      )}
    </div>
  );
}
