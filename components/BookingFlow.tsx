"use client";

import { useState } from "react";
import { formatPrice } from "@/lib/format";

type Slot = { startISO: string; label: string };
type Day = {
  date: string;
  weekdayLabel: string;
  dateLabel: string;
  slots: Slot[];
};
type Service = {
  id: number;
  name: string;
  durationMinutes: number;
  priceCents: number;
};

type SelectedSlot = { startISO: string; label: string; dayLabel: string };

export default function BookingFlow({
  service,
  days,
  timezone,
}: {
  service: Service;
  days: Day[];
  timezone: string;
}) {
  const [selected, setSelected] = useState<SelectedSlot | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isFree = service.priceCents === 0;

  // ---- Details form (after a slot is chosen) -------------------------------
  if (selected) {
    const submit = async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setSubmitting(true);
      try {
        const res = await fetch("/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            serviceId: service.id,
            startISO: selected.startISO,
            name: name.trim(),
            email: email.trim(),
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.url) {
          setError(data.error ?? "Something went wrong. Please try again.");
          setSubmitting(false);
          return;
        }
        // Redirect to Stripe Checkout (paid) or the success page (free).
        window.location.href = data.url;
      } catch {
        setError("Network error. Please try again.");
        setSubmitting(false);
      }
    };

    return (
      <form onSubmit={submit} className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <div className="mb-4 rounded-lg bg-black/40 p-4 text-sm">
          <p className="font-medium text-white">{service.name}</p>
          <p className="text-zinc-400">
            {selected.dayLabel} at {selected.label} · {formatPrice(service.priceCents)}
          </p>
          <button
            type="button"
            onClick={() => {
              setSelected(null);
              setError(null);
            }}
            className="mt-1 text-zinc-400 underline hover:text-white"
          >
            Change time
          </button>
        </div>

        <label className="block text-sm font-medium text-zinc-200">
          Your name
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white outline-none focus:border-white"
          />
        </label>

        <label className="mt-4 block text-sm font-medium text-zinc-200">
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white outline-none focus:border-white"
          />
        </label>

        {error && (
          <p className="mt-4 rounded-lg bg-red-950 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="mt-5 w-full rounded-lg bg-white px-4 py-2.5 font-medium text-black hover:bg-zinc-200 disabled:opacity-50"
        >
          {submitting
            ? "Please wait…"
            : isFree
              ? "Confirm booking"
              : `Continue to payment · ${formatPrice(service.priceCents)}`}
        </button>
        {!isFree && (
          <p className="mt-2 text-center text-xs text-zinc-500">
            You&apos;ll be taken to Stripe to pay securely.
          </p>
        )}
      </form>
    );
  }

  // ---- Slot picker ---------------------------------------------------------
  if (days.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-zinc-700 bg-zinc-900 p-6 text-center text-zinc-400">
        No available times in the next few weeks. Please check back later.
      </p>
    );
  }

  return (
    <div>
      <p className="mb-4 text-sm text-zinc-400">Times shown in {timezone}.</p>
      <div className="space-y-5">
        {days.map((day) => (
          <div key={day.date}>
            <h3 className="mb-2 text-sm font-semibold text-zinc-300">
              {day.weekdayLabel} {day.dateLabel}
            </h3>
            <div className="flex flex-wrap gap-2">
              {day.slots.map((slot) => (
                <button
                  key={slot.startISO}
                  onClick={() =>
                    setSelected({
                      startISO: slot.startISO,
                      label: slot.label,
                      dayLabel: `${day.weekdayLabel} ${day.dateLabel}`,
                    })
                  }
                  className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:border-white hover:bg-white hover:text-black"
                >
                  {slot.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
