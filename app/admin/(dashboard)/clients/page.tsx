import { DateTime } from "luxon";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// A quick sanity-check view of the auto-managed Client list — status, when they
// last had a session, and whether the follow-up / nudge emails have gone out.
// Read-only; everything here is populated automatically by bookings and the
// daily /api/cron/client-followups job.

const STATUS_STYLES: Record<string, string> = {
  lead: "bg-zinc-800 text-zinc-300",
  booked: "bg-amber-950 text-amber-300",
  active: "bg-emerald-950 text-emerald-300",
  past: "bg-zinc-800 text-zinc-400",
};

export default async function AdminClientsPage() {
  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  const zone = settings?.timezone ?? "Europe/London";

  const clients = await prisma.client.findMany({
    orderBy: [{ lastSessionAt: "desc" }, { createdAt: "desc" }],
  });

  const fmt = (d: Date | null) =>
    d
      ? DateTime.fromJSDate(d, { zone: "utc" }).setZone(zone).toFormat("ccc d LLL yyyy, HH:mm")
      : "—";

  return (
    <div>
      <h1 className="text-xl font-semibold">Clients</h1>
      <p className="mt-1 text-sm text-zinc-400">
        {clients.length} {clients.length === 1 ? "client" : "clients"} · times shown in {zone}.
      </p>

      {clients.length === 0 ? (
        <p className="mt-6 rounded-lg border border-dashed border-zinc-700 p-6 text-center text-zinc-400">
          No clients yet. New clients appear here automatically once someone books.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-left text-zinc-400">
                <th className="py-2 pr-4">Client</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Last session</th>
                <th className="py-2 pr-4">Follow-up</th>
                <th className="py-2 pr-4">Nudge</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id} className="border-b border-zinc-800 align-top">
                  <td className="py-3 pr-4">
                    {c.name}
                    <span className="block text-zinc-500">{c.email}</span>
                  </td>
                  <td className="py-3 pr-4">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        STATUS_STYLES[c.status] ?? "bg-zinc-800 text-zinc-400"
                      }`}
                    >
                      {c.status}
                    </span>
                  </td>
                  <td className="py-3 pr-4 whitespace-nowrap">{fmt(c.lastSessionAt)}</td>
                  <td className="py-3 pr-4 whitespace-nowrap text-zinc-400">
                    {c.followUpSentAt ? `Sent ${fmt(c.followUpSentAt)}` : "—"}
                  </td>
                  <td className="py-3 pr-4 whitespace-nowrap text-zinc-400">
                    {c.nudgeSentAt ? `Sent ${fmt(c.nudgeSentAt)}` : "—"}
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
