"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { cancelBookingWithRefund, rescheduleBooking } from "@/lib/booking";

export async function cancelAction(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const booking = await prisma.booking.findUnique({
    where: { manageToken: token },
    select: { id: true },
  });
  if (!booking) redirect(`/booking/manage/${token}?msg=notfound`);

  const res = await cancelBookingWithRefund(booking.id, { enforceWindow: true });
  redirect(`/booking/manage/${token}?msg=${res.ok ? "cancelled" : res.reason}`);
}

export async function rescheduleAction(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const startISO = String(formData.get("startISO") ?? "");
  const booking = await prisma.booking.findUnique({
    where: { manageToken: token },
    select: { id: true },
  });
  if (!booking) redirect(`/booking/manage/${token}?msg=notfound`);

  const res = await rescheduleBooking(booking.id, startISO, { enforceWindow: true });
  redirect(`/booking/manage/${token}?msg=${res.ok ? "rescheduled" : res.reason}`);
}
