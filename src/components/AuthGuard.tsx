"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { usePathname, useRouter } from "next/navigation";

const publicRoutes = ["/", "/login"];

type TeamProfile = {
  id: string;
  full_name: string;
  email: string | null;
  role: string | null;
  zone: string | null;
};

function homeForRole(role: string | null) {
  if (role === "Scrutineer") return "/scrutineer";
  if (role === "Campaigner") return "/campaigners";
  if (role === "Driver") return "/campaigners";
  if (role === "Zone Leader") return "/voters";
  if (role === "Campaign Manager") return "/dashboard";

  return "/login";
}

function canAccessRoute(role: string | null, pathname: string) {
  if (publicRoutes.includes(pathname)) return true;

  if (role === "Campaign Manager") {
    return true;
  }

  if (role === "Zone Leader") {
    return pathname.startsWith("/voters");
  }

  if (role === "Campaigner") {
    return pathname.startsWith("/campaigners");
  }

  if (role === "Driver") {
    return pathname.startsWith("/campaigners");
  }

  if (role === "Scrutineer") {
    return pathname.startsWith("/scrutineer");
  }

  return false;
}

export default function AuthGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [checking, setChecking] = useState(true);
  const [profile, setProfile] = useState<TeamProfile | null>(null);
  const [accessMessage, setAccessMessage] = useState("");

  useEffect(() => {
    async function checkSessionAndRole() {
      setChecking(true);
      setAccessMessage("");

      if (publicRoutes.includes(pathname)) {
        setChecking(false);
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();

      if (!sessionData.session) {
        router.push("/login");
        return;
      }

      const userEmail = sessionData.session.user.email;

      if (!userEmail) {
        setAccessMessage("No email found for this login.");
        setChecking(false);
        return;
      }

      const { data: teamProfile, error } = await supabase
        .from("campaigners")
        .select("id, full_name, email, role, zone")
        .ilike("email", userEmail)
        .maybeSingle();

      if (error) {
        console.error("Profile error:", error);
        setAccessMessage("Error checking your team role.");
        setChecking(false);
        return;
      }

      if (!teamProfile) {
        setAccessMessage(
          "No Team Rigo profile was found for this login. Add this email in Team Setup and assign a role."
        );
        setChecking(false);
        return;
      }

      setProfile(teamProfile);

      const allowed = canAccessRoute(teamProfile.role, pathname);

      if (!allowed) {
        router.push(homeForRole(teamProfile.role));
        return;
      }

      setChecking(false);
    }

    checkSessionAndRole();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session && !publicRoutes.includes(pathname)) {
        router.push("/login");
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [pathname, router]);

  async function logout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  if (checking && !publicRoutes.includes(pathname)) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <div className="rounded-2xl bg-white p-8 text-center shadow">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
            Team Rigo
          </p>
          <h1 className="mt-3 text-2xl font-bold text-slate-900">
            Checking access...
          </h1>
        </div>
      </main>
    );
  }

  if (accessMessage && !publicRoutes.includes(pathname)) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <div className="w-full max-w-lg rounded-2xl bg-white p-8 text-center shadow">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
            Team Rigo
          </p>

          <h1 className="mt-3 text-2xl font-bold text-slate-900">
            Access Not Available
          </h1>

          <p className="mt-3 text-slate-600">{accessMessage}</p>

          {profile && (
            <p className="mt-3 text-sm text-slate-500">
              Logged in as {profile.full_name}
            </p>
          )}

          <button
            onClick={logout}
            className="mt-6 rounded-xl bg-blue-700 px-5 py-3 font-semibold text-white hover:bg-blue-800"
          >
            Back to Login
          </button>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}