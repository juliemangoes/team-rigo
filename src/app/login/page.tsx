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
    <main className="flex min-h-screen items-center justify-center bg-[#e9edff] p-4 sm:p-6">
      <div className="grid w-full max-w-5xl items-center gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="hidden min-h-[560px] overflow-hidden rounded-[2rem] bg-[#0369a1] p-8 text-white shadow-2xl lg:flex lg:flex-col lg:items-center lg:justify-center">
          <div className="flex h-24 w-24 items-center justify-center rounded-[2rem] bg-white/10 text-3xl font-black tracking-tight shadow-inner">
            TR
          </div>

          <h1 className="mt-6 text-4xl font-black tracking-tight">
            Team Rigo
          </h1>

          <p className="mt-3 max-w-xs text-center text-sm font-medium leading-6 text-white/70">
            Campaign operations, voter tracking, and field coordination.
          </p>
        </section>

        <section className="mx-auto w-full max-w-md overflow-hidden rounded-[2rem] bg-white px-6 py-8 shadow-2xl sm:px-8 sm:py-10 lg:min-h-[560px] lg:px-10">
          <div className="flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-[#0369a1] text-xl font-black text-white shadow-lg shadow-sky-900/20">
              TR
            </div>
          </div>

          <div className="mt-8">
            <h1 className="text-2xl font-black tracking-tight text-slate-900">
              Login to your Account
            </h1>
            <p className="mt-2 text-sm font-medium text-slate-500">
              Secure access for authorized users.
            </p>
          </div>

          <div className="mt-7 space-y-4">
            <div>
              <label className="sr-only">Email</label>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") login();
                }}
                className="w-full rounded-xl border border-slate-100 bg-white px-4 py-4 text-sm font-semibold text-slate-900 shadow-[0_8px_24px_rgba(15,23,42,0.06)] outline-none transition placeholder:text-slate-400 focus:border-[#0369a1] focus:ring-4 focus:ring-sky-100"
                placeholder="Email"
              />
            </div>

            <div>
              <label className="sr-only">Password</label>
              <div className="flex rounded-xl border border-slate-100 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.06)] transition focus-within:border-[#0369a1] focus-within:ring-4 focus-within:ring-sky-100">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") login();
                  }}
                  className="w-full min-w-0 rounded-xl bg-transparent px-4 py-4 text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400"
                  placeholder="Password"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="shrink-0 px-4 text-xs font-black text-[#0369a1]"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {message && (
              <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm font-bold text-red-700">
                {message}
              </div>
            )}

            <button
              onClick={login}
              disabled={loading}
              className="w-full rounded-xl bg-[#0369a1] px-5 py-4 text-sm font-black text-white shadow-lg shadow-sky-900/20 transition hover:bg-[#075985] disabled:cursor-not-allowed disabled:bg-sky-300"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </div>

          <div className="mt-10 flex items-center gap-4">
            <div className="h-px flex-1 bg-slate-100" />
            <p className="text-xs font-semibold text-slate-400">
              Authorized users only
            </p>
            <div className="h-px flex-1 bg-slate-100" />
          </div>

          <p className="mt-8 text-center text-xs font-medium text-slate-400">
            Team Rigo Campaign Operations
          </p>
        </section>
      </div>
    </main>
  );
}
