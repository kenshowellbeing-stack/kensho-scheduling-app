import { prisma } from "@/lib/db";
import { formatPrice, formatDuration } from "@/lib/format";
import { saveService, toggleServiceActive } from "../../actions";

export const dynamic = "force-dynamic";

export default async function AdminServicesPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const services = await prisma.service.findMany({
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { id: "asc" }],
  });

  // Distinct existing categories, for the datalist suggestions in the form.
  const categories = Array.from(
    new Set(services.map((s) => s.category?.trim()).filter(Boolean))
  ) as string[];

  return (
    <div>
      <h1 className="text-xl font-semibold">Services</h1>
      <p className="mt-1 text-sm text-zinc-400">
        What customers can book, grouped by category on the booking page.
        Deactivate to hide a service without deleting it.
      </p>

      {searchParams.error && (
        <p className="mt-3 rounded-lg bg-red-950 px-3 py-2 text-sm text-red-300">
          Please check the fields — name, a positive duration, and a price of £0 or more are required.
        </p>
      )}

      <ul className="mt-6 space-y-3">
        {services.map((s) => (
          <li key={s.id} className="rounded-lg border border-zinc-800 p-4">
            <details>
              <summary className="flex cursor-pointer items-center justify-between gap-3">
                <span className="font-medium">
                  {s.name}
                  {s.category && (
                    <span className="ml-2 rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-400">
                      {s.category}
                    </span>
                  )}
                  {!s.active && <span className="ml-2 text-xs text-zinc-500">(inactive)</span>}
                </span>
                <span className="whitespace-nowrap text-sm text-zinc-400">
                  {formatDuration(s.durationMinutes)} · {formatPrice(s.priceCents)}
                </span>
              </summary>
              <ServiceForm service={s} categories={categories} />
            </details>
            <form action={toggleServiceActive} className="mt-2">
              <input type="hidden" name="id" value={s.id} />
              <input type="hidden" name="active" value={String(s.active)} />
              <button className="text-xs text-zinc-400 underline hover:text-white">
                {s.active ? "Deactivate" : "Reactivate"}
              </button>
            </form>
          </li>
        ))}
      </ul>

      <div className="mt-8 rounded-lg border border-zinc-800 p-4">
        <h2 className="font-medium">Add a new service</h2>
        <ServiceForm categories={categories} />
      </div>
    </div>
  );
}

function ServiceForm({
  service,
  categories,
}: {
  service?: {
    id: number;
    name: string;
    description: string;
    durationMinutes: number;
    priceCents: number;
    category: string;
    sortOrder: number;
  };
  categories: string[];
}) {
  const inputClass =
    "mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white outline-none focus:border-white";
  return (
    <form action={saveService} className="mt-4 grid gap-3 sm:grid-cols-2">
      {service && <input type="hidden" name="id" value={service.id} />}
      <label className="text-sm font-medium text-zinc-200 sm:col-span-2">
        Name
        <input type="text" name="name" required defaultValue={service?.name} className={inputClass} />
      </label>
      <label className="text-sm font-medium text-zinc-200 sm:col-span-2">
        Description
        <input type="text" name="description" defaultValue={service?.description} className={inputClass} />
      </label>
      <label className="text-sm font-medium text-zinc-200">
        Category
        <input
          type="text"
          name="category"
          list="service-categories"
          placeholder="e.g. Breathwork"
          defaultValue={service?.category}
          className={inputClass}
        />
      </label>
      <datalist id="service-categories">
        {categories.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <label className="text-sm font-medium text-zinc-200">
        Order in category
        <input
          type="number"
          name="sortOrder"
          min={0}
          defaultValue={service?.sortOrder ?? 0}
          className={inputClass}
        />
      </label>
      <label className="text-sm font-medium text-zinc-200">
        Duration (minutes)
        <input type="number" name="durationMinutes" min={1} required defaultValue={service?.durationMinutes} className={inputClass} />
      </label>
      <label className="text-sm font-medium text-zinc-200">
        Price (£)
        <input
          type="number"
          name="pricePounds"
          min={0}
          step="0.01"
          required
          defaultValue={service ? service.priceCents / 100 : undefined}
          className={inputClass}
        />
      </label>
      <button className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black hover:bg-zinc-200 sm:col-span-2">
        {service ? "Save changes" : "Add service"}
      </button>
    </form>
  );
}
