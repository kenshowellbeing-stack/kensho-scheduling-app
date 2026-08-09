import { DateTime } from "luxon";
import { prisma } from "@/lib/db";
import { addBlackout, deleteBlackout } from "../../actions";

export const dynamic = "force-dynamic";

export default async function AdminBlackoutsPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  const zone = settings?.timezone ?? "Europe/London";

  const blackouts = await prisma.blackoutDate.findMany({
    where: { endsAt: { gte: new Date() } },
    orderBy: { startsAt: "asc" },
  });

  return (
    <div>
      <h1 className="text-xl font-semibold">Blackout dates</h1>
      <p className="mt-1 text-sm text-zinc-400">
        Block time when you&apos;re unavailable. Times are in {zone}.
      </p>

      <form action={addBlackout} className="mt-6 flex flex-wrap items-end gap-3 rounded-lg border border-zinc-800 p-4">
        <label className="text-sm font-medium text-zinc-200">
          From
          <input
            type="datetime-local"
            name="startsAt"
            required
            className="mt-1 block rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white outline-none focus:border-white"
          />
        </label>
        <label className="text-sm font-medium text-zinc-200">
          To
          <input
            type="datetime-local"
            name="endsAt"
            required
            className="mt-1 block rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white outline-none focus:border-white"
          />
        </label>
        <label className="text-sm font-medium text-zinc-200">
          Reason (optional)
          <input
            type="text"
            name="reason"
            placeholder="Holiday"
            className="mt-1 block rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white outline-none focus:border-white"
          />
        </label>
        <button className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black hover:bg-zinc-200">
          Add block
        </button>
      </form>

      {searchParams.error && (
        <p className="mt-3 rounded-lg bg-red-950 px-3 py-2 text-sm text-red-300">
          Please enter a valid range (the end must be after the start).
        </p>
      )}

      {blackouts.length === 0 ? (
        <p className="mt-6 rounded-lg border border-dashed border-zinc-700 p-6 text-center text-zinc-400">
          No upcoming blackout dates.
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-zinc-800">
          {blackouts.map((b) => (
            <li key={b.id} className="flex items-center justify-between py-3 text-sm">
              <span>
                {DateTime.fromJSDate(b.startsAt, { zone: "utc" }).setZone(zone).toFormat("ccc d LLL HH:mm")}
                {" → "}
                {DateTime.fromJSDate(b.endsAt, { zone: "utc" }).setZone(zone).toFormat("ccc d LLL HH:mm")}
                {b.reason && <span className="text-zinc-500"> · {b.reason}</span>}
              </span>
              <form action={deleteBlackout}>
                <input type="hidden" name="id" value={b.id} />
                <button className="text-xs text-red-400 underline hover:text-red-300">Remove</button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
