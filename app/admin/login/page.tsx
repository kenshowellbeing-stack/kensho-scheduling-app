import Image from "next/image";
import { login } from "./actions";

export const dynamic = "force-dynamic";

export default function AdminLoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center px-4">
      <Image
        src="/logo.png"
        alt="The Kenshō Wellbeing Collective"
        width={96}
        height={96}
        priority
        className="mb-6 h-24 w-24"
      />
      <h1 className="text-2xl font-semibold">Admin login</h1>

      <form action={login} className="mt-6 w-full space-y-4">
        <label className="block text-sm font-medium text-zinc-200">
          Password
          <input
            type="password"
            name="password"
            required
            autoFocus
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white outline-none focus:border-white"
          />
        </label>

        {searchParams.error && (
          <p className="rounded-lg bg-red-950 px-3 py-2 text-sm text-red-300">
            Incorrect password.
          </p>
        )}

        <button
          type="submit"
          className="w-full rounded-lg bg-white px-4 py-2.5 font-medium text-black hover:bg-zinc-200"
        >
          Log in
        </button>
      </form>
    </main>
  );
}
