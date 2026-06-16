"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

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

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function login() {
    if (!email.trim() || !password.trim()) {
      setMessage("Please enter your email and password.");
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

      setMessage(
        "No Team Rigo profile was found for this email. Ask the Campaign Manager to add this email in Team Setup."
      );
      setLoading(false);
      return;
    }

    const destination = homeForRole(profile.role);

    router.push(destination);
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
            Team Rigo
          </p>

          <h1 className="mt-3 text-3xl font-bold text-slate-900">
            Sign In
          </h1>

          <p className="mt-2 text-slate-600">
            Access the campaign operations platform.
          </p>
        </div>

        <div className="mt-8 space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700">
              Email
            </label>

            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  login();
                }
              }}
              className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-700"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">
              Password
            </label>

            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  login();
                }
              }}
              className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-700"
              placeholder="Enter password"
            />
          </div>

          {message && (
            <div className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700">
              {message}
            </div>
          )}

          <button
            onClick={login}
            disabled={loading}
            className="w-full rounded-xl bg-blue-700 px-4 py-3 font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-blue-300"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          Authorized users only.
        </p>
      </div>
    </main>
  );
}