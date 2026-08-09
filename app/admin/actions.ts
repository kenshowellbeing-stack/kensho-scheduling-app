"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { DateTime } from "luxon";
import { prisma } from "@/lib/db";
import { ADMIN_COOKIE, requireAdmin } from "@/lib/adminAuth";
import { cancelBookingWithRefund } from "@/lib/booking";

export async function logout() {
  cookies().delete(ADMIN_COOKIE);
  redirect("/admin/login");
}

// ---- Bookings -------------------------------------------------------------
export async function cancelBooking(formData: FormData) {
  requireAdmin();
  const id = Number(formData.get("id"));
  if (Number.isInteger(id)) {
    // Admin can cancel any time (no 24h window); refunds the card, removes the
    // calendar event, and emails the customer.
    await cancelBookingWithRefund(id, { enforceWindow: false });
    revalidatePath("/admin");
  }
}

// ---- Blackout dates -------------------------------------------------------
async function providerZone(): Promise<string> {
  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  return settings?.timezone ?? "Europe/London";
}

export async function addBlackout(formData: FormData) {
  requireAdmin();
  const zone = await providerZone();
  const startLocal = String(formData.get("startsAt") ?? "");
  const endLocal = String(formData.get("endsAt") ?? "");
  const reason = String(formData.get("reason") ?? "");

  const startsAt = DateTime.fromISO(startLocal, { zone });
  const endsAt = DateTime.fromISO(endLocal, { zone });
  if (!startsAt.isValid || !endsAt.isValid || endsAt <= startsAt) {
    redirect("/admin/blackouts?error=1");
  }

  await prisma.blackoutDate.create({
    data: {
      startsAt: startsAt.toUTC().toJSDate(),
      endsAt: endsAt.toUTC().toJSDate(),
      reason,
    },
  });
  revalidatePath("/admin/blackouts");
}

export async function deleteBlackout(formData: FormData) {
  requireAdmin();
  const id = Number(formData.get("id"));
  if (Number.isInteger(id)) {
    await prisma.blackoutDate.delete({ where: { id } });
    revalidatePath("/admin/blackouts");
  }
}

// ---- Services -------------------------------------------------------------
export async function saveService(formData: FormData) {
  requireAdmin();
  const id = Number(formData.get("id"));
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const durationMinutes = Number(formData.get("durationMinutes"));
  const pricePounds = Number(formData.get("pricePounds"));
  const category = String(formData.get("category") ?? "").trim();
  const sortOrder = Number(formData.get("sortOrder"));

  if (!name || !Number.isFinite(durationMinutes) || durationMinutes <= 0 || !Number.isFinite(pricePounds) || pricePounds < 0) {
    redirect("/admin/services?error=1");
  }

  const data = {
    name,
    description,
    durationMinutes: Math.round(durationMinutes),
    priceCents: Math.round(pricePounds * 100), // pounds in the form -> cents in the DB
    category,
    sortOrder: Number.isFinite(sortOrder) ? Math.round(sortOrder) : 0,
  };

  if (Number.isInteger(id) && id > 0) {
    await prisma.service.update({ where: { id }, data });
  } else {
    await prisma.service.create({ data });
  }
  revalidatePath("/admin/services");
  revalidatePath("/"); // public service list reflects changes
}

export async function toggleServiceActive(formData: FormData) {
  requireAdmin();
  const id = Number(formData.get("id"));
  const active = String(formData.get("active")) === "true";
  if (Number.isInteger(id)) {
    await prisma.service.update({ where: { id }, data: { active: !active } });
    revalidatePath("/admin/services");
    revalidatePath("/");
  }
}
