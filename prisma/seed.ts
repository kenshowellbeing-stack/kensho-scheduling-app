// Populates the database with sensible starter data so you have something to
// click through immediately. Safe to run more than once: it clears the demo
// rows first. Run it with:  npx prisma db seed
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // --- Global settings (single row, id = 1) ---------------------------------
  await prisma.settings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      timezone: "Europe/London",
      bufferMinutes: 15, // 15-minute gap between appointments
      minNoticeHours: 12, // no bookings less than 12 hours out
    },
  });

  // --- Working hours: Monday–Friday, 9:00 AM to 5:00 PM ---------------------
  // Weekday numbers: 0=Sun, 1=Mon, ... 5=Fri, 6=Sat.
  const NINE_AM = 9 * 60; // 540 minutes since midnight
  const FIVE_PM = 17 * 60; // 1020 minutes since midnight
  for (let weekday = 1; weekday <= 5; weekday++) {
    await prisma.availabilityRule.upsert({
      where: { weekday },
      update: { startMinute: NINE_AM, endMinute: FIVE_PM, enabled: true },
      create: {
        weekday,
        startMinute: NINE_AM,
        endMinute: FIVE_PM,
        enabled: true,
      },
    });
  }

  // --- Example services -----------------------------------------------------
  // We only create these if there are no services yet, so we never clobber
  // real services you add later.
  const existingServices = await prisma.service.count();
  if (existingServices === 0) {
    await prisma.service.createMany({
      data: [
        {
          name: "Intro Call",
          description: "A free 30-minute introductory call to see if we're a good fit.",
          durationMinutes: 30,
          priceCents: 0,
        },
        {
          name: "60-min Consultation",
          description: "A focused one-hour working session.",
          durationMinutes: 60,
          priceCents: 12000, // £120.00
        },
        {
          name: "Deep-Dive Session",
          description: "A 90-minute deep-dive for complex problems.",
          durationMinutes: 90,
          priceCents: 18000, // £180.00
        },
      ],
    });
  }

  console.log("✅ Seed complete: settings, Mon–Fri 9–5 hours, 3 example services.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
