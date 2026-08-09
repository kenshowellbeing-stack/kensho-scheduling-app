import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getAvailableSlots } from "@/lib/availability";
import { formatDuration, formatPrice } from "@/lib/format";
import BookingFlow from "@/components/BookingFlow";

export default async function BookServicePage({
  params,
  searchParams,
}: {
  params: { serviceId: string };
  searchParams: { canceled?: string };
}) {
  const serviceId = Number(params.serviceId);
  if (!Number.isInteger(serviceId)) notFound();

  const service = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!service || !service.active) notFound();

  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  const timezone = settings?.timezone ?? "Europe/London";

  // Compute the available days/slots on the server.
  const { days } = await getAvailableSlots(serviceId);

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <Link href="/" className="text-sm text-zinc-400 hover:text-white">
        ← All services
      </Link>

      <header className="mb-6 mt-4">
        <h1 className="text-2xl font-semibold tracking-tight text-white">{service.name}</h1>
        {service.description && (
          <p className="mt-1 text-zinc-400">{service.description}</p>
        )}
        <p className="mt-2 text-sm text-zinc-400">
          {formatDuration(service.durationMinutes)} ·{" "}
          <span className="font-medium text-zinc-200">
            {formatPrice(service.priceCents)}
          </span>
        </p>
      </header>

      {searchParams.canceled && (
        <div className="mb-5 rounded-lg border border-amber-800 bg-amber-950 px-4 py-3 text-sm text-amber-300">
          Payment was canceled, so no booking was made. Pick a time to try again — your
          slot is held for a few minutes.
        </div>
      )}

      <BookingFlow
        service={{
          id: service.id,
          name: service.name,
          durationMinutes: service.durationMinutes,
          priceCents: service.priceCents,
        }}
        days={days}
        timezone={timezone}
      />
    </main>
  );
}
