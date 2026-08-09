import Link from "next/link";
import { requireAdmin } from "@/lib/adminAuth";
import { logout } from "../actions";

export const dynamic = "force-dynamic";

export default function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  requireAdmin();

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <header className="mb-8 flex items-center justify-between border-b border-zinc-800 pb-4">
        <div className="flex items-center gap-5">
          <span className="font-semibold">Kenshō admin</span>
          <nav className="flex gap-4 text-sm text-zinc-400">
            <Link href="/admin" className="hover:text-white">
              Bookings
            </Link>
            <Link href="/admin/blackouts" className="hover:text-white">
              Blackout dates
            </Link>
            <Link href="/admin/services" className="hover:text-white">
              Services
            </Link>
          </nav>
        </div>
        <form action={logout}>
          <button className="text-sm text-zinc-400 underline hover:text-white">
            Log out
          </button>
        </form>
      </header>
      {children}
    </div>
  );
}
