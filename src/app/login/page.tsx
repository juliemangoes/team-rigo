"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

function homeForRole(role: string | null) {
  if (role === "Campaign Manager") return "/dashboard";
  if (role === "Zone Leader") return "/voters";
  if (role === "Campaigner") return "/campaigners";
  if (role === "Driver") return "/campaigners";
  if (role === "Scrutineer") return "/scrutineer";

  return "/login";
}

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function login() {
    if (!email.trim() || !password.trim()) {
      setMessage("Enter your email and password.");
      return;
    }

    setLoading(true);
    setMessage("");

    const cleanEmail = email.trim().toLowerCase();

    const { error: loginError } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (loginError) {
      console.error("Login error:", loginError);
      setMessage("Login failed. Check your email and password.");
      setLoading(false);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("campaigners")
      .select("id, full_name, email, role, zone")
      .ilike("email", cleanEmail)
      .maybeSingle();

    if (profileError) {
      console.error("Profile error:", profileError);
      setMessage("Login succeeded, but your team profile could not be loaded.");
      setLoading(false);
      return;
    }

    if (!profile) {
      await supabase.auth.signOut();

      setMessage("No Team Rigo profile found for this email.");
      setLoading(false);
      return;
    }

    router.push(homeForRole(profile.role));
    router.refresh();
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 p-4">
      <div className="absolute left-[-120px] top-[-120px] h-80 w-80 rounded-full bg-blue-600/30 blur-3xl" />
      <div className="absolute bottom-[-140px] right-[-120px] h-96 w-96 rounded-full bg-cyan-500/20 blur-3xl" />
      <div className="absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/5 blur-3xl" />

      <div className="relative grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-white/10 bg-white shadow-2xl lg:grid-cols-2">
        <section className="relative hidden min-h-[640px] overflow-hidden bg-slate-950 p-10 text-white lg:block">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.55),_transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(6,182,212,0.25),_transparent_35%)]" />

          <div className="absolute left-10 top-10 h-20 w-20 rounded-3xl border border-white/10 bg-white/10" />
          <div className="absolute right-12 top-28 h-28 w-28 rounded-full border border-blue-300/20 bg-blue-500/10" />
          <div className="absolute bottom-16 left-16 h-32 w-32 rounded-[2rem] border border-cyan-300/20 bg-cyan-500/10 rotate-12" />

          <div className="relative z-10 flex h-full flex-col justify-between">
            <div>
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-white text-2xl font-black text-blue-700 shadow-xl">
                TR
              </div>

              <h1 className="mt-8 text-5xl font-black leading-tight tracking-tight">
                Team Rigo
              </h1>

              <p className="mt-4 max-w-sm text-lg text-slate-300">
                Campaign command center.
              </p>
            </div>

            <div className="grid gap-3">
              <div className="rounded-3xl border border-white/10 bg-white/10 p-5 backdrop-blur">
                <p className="text-sm font-semibold text-slate-300">
                  Path to Victory
                </p>
                <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/10">
                  <div className="h-3 w-3/4 rounded-full bg-blue-400" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-2xl bg-white/10 p-4">
                  <p className="text-xs text-slate-400">Zones</p>
                  <p className="mt-1 text-2xl font-black">Live</p>
                </div>

                <div className="rounded-2xl bg-white/10 p-4">
                  <p className="text-xs text-slate-400">Field</p>
                  <p className="mt-1 text-2xl font-black">Ready</p>
                </div>

                <div className="rounded-2xl bg-white/10 p-4">
                  <p className="text-xs text-slate-400">Votes</p>
                  <p className="mt-1 text-2xl font-black">Track</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="relative flex min-h-screen flex-col justify-center bg-white p-6 sm:min-h-[640px] sm:p-10">
          <div className="mx-auto w-full max-w-md">
            <div className="mb-8 text-center lg:hidden">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-blue-700 text-2xl font-black text-white shadow-lg">
                TR
              </div>

              <h1 className="mt-4 text-3xl font-black text-slate-900">
                Team Rigo
              </h1>
            </div>

            <div className="mb-8">
              <p className="text-sm font-black uppercase tracking-[0.25em] text-blue-700">
                Secure Access
              </p>

              <h2 className="mt-3 text-4xl font-black tracking-tight text-slate-950">
                Sign in
              </h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-bold text-slate-700">Email</label>

                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") login();
                  }}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-700 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label className="text-sm font-bold text-slate-700">
                  Password
                </label>

                <div className="mt-2 flex rounded-2xl border border-slate-200 bg-slate-50 transition focus-within:border-blue-700 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-100">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") login();
                    }}
                    className="w-full rounded-2xl bg-transparent px-4 py-4 text-slate-950 outline-none placeholder:text-slate-400"
                    placeholder="Enter password"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="shrink-0 px-4 text-sm font-black text-blue-700"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              {message && (
                <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-700">
                  {message}
                </div>
              )}

              <button
                onClick={login}
                disabled={loading}
                className="group relative w-full overflow-hidden rounded-2xl bg-blue-700 px-5 py-4 font-black text-white shadow-lg shadow-blue-700/20 transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-blue-300"
              >
                <span className="relative z-10">
                  {loading ? "Signing in..." : "Enter Dashboard"}
                </span>
                <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition group-hover:translate-x-full" />
              </button>
            </div>

            <div className="mt-8 flex items-center justify-center gap-2 text-xs font-semibold text-slate-400">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              Authorized campaign users only
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
