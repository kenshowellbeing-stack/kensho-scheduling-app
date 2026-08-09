import { PrismaClient } from "@prisma/client";

// In development, Next.js reloads your code on every change. Without this
// guard, each reload would open a brand-new database connection and you'd
// eventually run out. We stash a single client on the global object and reuse
// it. In production a fresh client is created once, which is what we want.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
