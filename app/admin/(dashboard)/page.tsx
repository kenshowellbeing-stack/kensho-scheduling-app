import { DateTime } from "luxon";
import { prisma } from "@/lib/db";
import { formatPrice } from "@/lib/format";
import { cancelBooking } from "../actions";

export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<string, string> = {
  confirmed: "bg-emerald-950 text-emerald-300",
  pending: "bg-amber-950 text-amber-300",
  cancelled: "bg-zinc-800 text-zinc-400",
  expired: "bg-zinc-800 text-zinc-400",
  conflict: "bg-red-950 text-red-300",
};

export default async function AdminBookingsPage() {
  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  const zone = settings?.timezone ?? "Europe/London";

  const bookings = await prisma.booking.findMany({
    where: { startsAt: { gte: new Date() }, status: { in: ["confirmed", "pending"] } },
    orderBy: { startsAt: "asc" },
    include: { service: true },
  });

  return (
    <div>
      <h1 className="text-xl font-semibold">Upcoming bookings</h1>
      <p className="mt-1 text-sm text-zinc-400">Times shown in {zone}.</p>

      {bookings.length === 0 ? (
        <p className="mt-6 rounded-lg border border-dashed border-zinc-700 p-6 text-center text-zinc-400">
          No upcoming bookings.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-left text-zinc-400">
                <th className="py-2 pr-4">When</th>
                <th className="py-2 pr-4">Service</th>
                <th className="py-2 pr-4">Customer</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.id} className="border-b border-zinc-800 align-top">
                  <td className="py-3 pr-4 whitespace-nowrap">
                    {DateTime.fromJSDate(b.startsAt, { zone: "utc" })
                      .setZone(zone)
                      .toFormat("ccc d LLL, HH:mm")}
                  </td>
                  <td className="py-3 pr-4">
                    {b.service.name}
                    <span className="block text-zinc-500">{formatPrice(b.service.priceCents)}</span>
                  </td>
                  <td className="py-3 pr-4">
                    {b.customerName}
                    <span className="block text-zinc-500">{b.customerEmail}</span>
                  </td>
                  <td className="py-3 pr-4">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        STATUS_STYLES[b.status] ?? "bg-zinc-800 text-zinc-400"
                      }`}
                    >
                      {b.status}
                    </span>
                  </td>
                  <td className="py-3">
                    <form action={cancelBooking}>
                      <input type="hidden" name="id" value={b.id} />
                      <button className="text-xs text-red-400 underline hover:text-red-300">
                        Cancel
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
