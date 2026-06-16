import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-lg">
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
          Campaign Operations Platform
        </p>

        <h1 className="mt-3 text-4xl font-bold text-slate-900">
          Team Rigo
        </h1>

        <p className="mt-4 text-slate-600">
          Manage supporters, campaigners, pickups, and convention-day turnout.
        </p>

        <Link
          href="/login"
          className="mt-8 block w-full rounded-xl bg-blue-700 px-4 py-3 font-semibold text-white hover:bg-blue-800"
        >
          Sign In
        </Link>
      </div>
    </main>
  );
}