"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const hiddenRoutes = ["/", "/login"];

type TeamProfile = {
  id: string;
  full_name: string;
  email: string | null;
  role: string | null;
  zone: string | null;
};

const allLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/voters", label: "Voters" },
  { href: "/campaigners", label: "Campaigners" },
  { href: "/campaign-setup", label: "Campaign Setup" },
  { href: "/team", label: "Team Setup" },
  { href: "/upload", label: "Upload" },
  { href: "/reports", label: "Reports" },
];

function linksForRole(role: string | null) {
  if (role === "Campaign Manager") {
    return allLinks;
  }

  if (role === "Zone Leader") {
    return allLinks.filter((link) => link.href === "/voters");
  }

  if (role === "Campaigner") {
    return allLinks.filter((link) => link.href === "/campaigners");
  }

  if (role === "Driver") {
    return allLinks.filter((link) => link.href === "/campaigners");
  }

  if (role === "Scrutineer") {
    return allLinks.filter((link) => link.href === "/scrutineer");
  }

  return [];
}

export default function Navigation() {
  const pathname = usePathname();
  const router = useRouter();

  const [profile, setProfile] = useState<TeamProfile | null>(null);

  useEffect(() => {
    async function loadProfile() {
      if (hiddenRoutes.includes(pathname)) return;

      const { data: sessionData } = await supabase.auth.getSession();
      const email = sessionData.session?.user.email;

      if (!email) return;

      const { data } = await supabase
        .from("campaigners")
        .select("id, full_name, email, role, zone")
        .ilike("email", email)
        .maybeSingle();

      setProfile(data || null);
    }

    loadProfile();
  }, [pathname]);

  if (hiddenRoutes.includes(pathname)) {
    return null;
  }

  async function logout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const links = linksForRole(profile?.role || null);

  return (
    <nav className="sticky top-0 z-50 border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-4 md:flex-row md:items-center md:justify-between">
        <Link href={profile?.role === "Zone Leader" ? "/voters" : "/dashboard"} className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-700 font-bold text-white">
            TR
          </div>

          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
              Team Rigo
            </p>
            <p className="text-xs text-slate-500">
              Campaign Operations Platform
            </p>
          </div>
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          {profile && (
            <div className="mr-2 rounded-xl bg-slate-100 px-3 py-2 text-xs text-slate-600">
              {profile.full_name} · {profile.role || "No Role"}
            </div>
          )}

          {links.map((link) => {
            const isActive = pathname === link.href;

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-xl px-3 py-2 text-sm font-semibold ${
                  isActive
                    ? "bg-blue-700 text-white"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                {link.label}
              </Link>
            );
          })}

          <button
            onClick={logout}
            className="rounded-xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}