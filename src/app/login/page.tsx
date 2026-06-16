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
    <main className="min-h-screen overflow-hidden bg-slate-950 lg:flex lg:items-center lg:justify-center lg:p-6">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -left-28 -top-28 h-72 w-72 rounded-full bg-blue-600/30 blur-3xl sm:h-96 sm:w-96" />
        <div className="absolute -bottom-32 -right-32 h-80 w-80 rounded-full bg-cyan-400/20 blur-3xl sm:h-[520px] sm:w-[520px]" />
        <div className="absolute left-1/2 top-1/3 h-64 w-64 -translate-x-1/2 rounded-full bg-white/5 blur-3xl" />
      </div>

      <section className="relative flex min-h-screen items-center justify-center px-4 py-6 sm:px-6 lg:min-h-0 lg:w-full lg:max-w-5xl">
        <div className="grid w-full overflow-hidden rounded-[1.75rem] border border-white/10 bg-white shadow-2xl lg:grid-cols-[1.05fr_0.95fr]">
          <aside className="hidden min-h-[620px] bg-slate-950 p-10 text-white lg:block">
            <div className="relative flex h-full flex-col justify-between overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/5 p-8">
              <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-blue-500/30 blur-3xl" />
              <div className="absolute -bottom-24 -left-20 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" />

              <div className="relative">
                <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-white text-2xl font-black text-blue-700 shadow-xl">
                  TR
                </div>

                <h1 className="mt-8 text-5xl font-black tracking-tight">
                  Team Rigo
                </h1>

                <p className="mt-4 max-w-sm text-lg text-slate-300">
                  Campaign command center.
                </p>
              </div>

              <div className="relative space-y-4">
                <div className="rounded-3xl border border-white/10 bg-white/10 p-5 backdrop-blur">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-slate-300">
                      Path to Victory
                    </p>
                    <span className="rounded-full bg-green-400/20 px-3 py-1 text-xs font-black text-green-200">
                      Live
                    </span>
                  </div>

                  <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/10">
                    <div className="h-3 w-3/4 rounded-full bg-blue-400" />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                    <p className="text-xs text-slate-400">Voters</p>
                    <p className="mt-1 text-2xl font-black">Track</p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                    <p className="text-xs text-slate-400">Field</p>
                    <p className="mt-1 text-2xl font-black">Ready</p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                    <p className="text-xs text-slate-400">Zones</p>
                    <p className="mt-1 text-2xl font-black">Live</p>
                  </div>
                </div>
              </div>
            </div>
          </aside>

          <section className="bg-white px-5 py-7 sm:px-8 sm:py-10 lg:flex lg:min-h-[620px] lg:items-center lg:px-12">
            <div className="mx-auto w-full max-w-md">
              <div className="mb-7 text-center lg:text-left">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-700 text-xl font-black text-white shadow-lg shadow-blue-700/20 lg:mx-0">
                  TR
                </div>

                <p className="mt-5 text-xs font-black uppercase tracking-[0.22em] text-blue-700">
                  Secure Access
                </p>

                <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                  Sign in
                </h2>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-bold text-slate-700">
                    Email
                  </label>

                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") login();
                    }}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-700 focus:bg-white focus:ring-4 focus:ring-blue-100 sm:py-4"
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
                      className="w-full min-w-0 rounded-2xl bg-transparent px-4 py-3.5 text-base text-slate-950 outline-none placeholder:text-slate-400 sm:py-4"
                      placeholder="Password"
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
                  <div className="rounded-2xl border border-red-100 bg-red-50 p-3 text-sm font-bold text-red-700 sm:p-4">
                    {message}
                  </div>
                )}

                <button
                  onClick={login}
                  disabled={loading}
                  className="group relative w-full overflow-hidden rounded-2xl bg-blue-700 px-5 py-4 font-black text-white shadow-lg shadow-blue-700/20 transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-blue-300"
                >
                  <span className="relative z-10">
                    {loading ? "Signing in..." : "Enter"}
                  </span>
                  <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition duration-700 group-hover:translate-x-full" />
                </button>
              </div>

              <div className="mt-6 flex items-center justify-center gap-2 text-xs font-semibold text-slate-400 lg:justify-start">
                <span className="h-2 w-2 rounded-full bg-green-500" />
                Authorized users only
              </div>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
