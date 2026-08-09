import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/db";
import { formatDuration, formatPrice } from "@/lib/format";

// Always reflect the live database so service changes (via the admin panel)
// show immediately, rather than being frozen at build time.
export const dynamic = "force-dynamic";

// A server component: this code runs on the server, reads the database
// directly, and sends finished HTML to the browser.
// Preferred order for category headings; any category not listed here is
// appended afterwards (alphabetically). Uncategorised services fall under "Other".
const CATEGORY_ORDER = ["Breathwork", "Coaching", "Organisations"];

export default async function HomePage() {
  const services = await prisma.service.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });

  // Group services by category, preserving the sortOrder within each group.
  const groups = new Map<string, typeof services>();
  for (const s of services) {
    const key = s.category?.trim() || "Other";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(s);
  }
  const orderedCategories = [
    ...CATEGORY_ORDER.filter((c) => groups.has(c)),
    ...Array.from(groups.keys())
      .filter((c) => !CATEGORY_ORDER.includes(c))
      .sort(),
  ];

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <header className="mb-10 flex flex-col items-center text-center">
        <Image
          src="/logo.png"
          alt="The Kenshō Wellbeing Collective"
          width={180}
          height={180}
          priority
          className="h-40 w-40"
        />
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">Book a session</h1>
        <p className="mt-2 text-zinc-400">Choose a service to see available times.</p>
      </header>

      {services.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-700 bg-zinc-900 p-6 text-center text-zinc-400">
          No services are available right now.
        </p>
      ) : (
        <div className="space-y-10">
          {orderedCategories.map((category) => (
            <section key={category}>
              <h2 className="mb-4 border-b border-zinc-800 pb-2 text-sm font-semibold uppercase tracking-wider text-zinc-400">
                {category}
              </h2>
              <ul className="space-y-4">
                {groups.get(category)!.map((service) => (
                  <li
                    key={service.id}
                    className="rounded-xl border border-zinc-800 bg-zinc-900 p-5"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-medium text-white">{service.name}</h3>
                        {service.description && (
                          <p className="mt-1 text-sm text-zinc-400">{service.description}</p>
                        )}
                        <p className="mt-2 text-sm text-zinc-400">
                          {formatDuration(service.durationMinutes)} ·{" "}
                          <span className="font-medium text-zinc-200">
                            {formatPrice(service.priceCents)}
                          </span>
                        </p>
                      </div>
                      <Link
                        href={`/book/${service.id}`}
                        className="shrink-0 rounded-lg bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-zinc-200"
                      >
                        Book
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
