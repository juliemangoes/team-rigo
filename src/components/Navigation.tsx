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

type NavLink = {
  href: string;
  label: string;
  shortLabel?: string;
};

const allLinks: NavLink[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/campaign-setup", label: "Campaign Setup", shortLabel: "Setup" },
  { href: "/voters", label: "Voters" },
  { href: "/team", label: "Team Setup", shortLabel: "Team" },
  { href: "/upload", label: "Upload" },
  { href: "/reports", label: "Reports" },
];

function homeForRole(role: string | null) {
  if (role === "Campaign Manager") return "/dashboard";
  if (role === "Zone Leader") return "/voters";
  if (role === "Campaigner") return "/campaigners";
  if (role === "Driver") return "/campaigners";
  if (role === "Scrutineer") return "/scrutineer";

  return "/login";
}

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

function isActiveLink(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function Navigation() {
  const pathname = usePathname();
  const router = useRouter();

  const [profile, setProfile] = useState<TeamProfile | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      if (hiddenRoutes.includes(pathname)) return;

      setLoadingProfile(true);

      const { data: sessionData } = await supabase.auth.getSession();
      const email = sessionData.session?.user.email;

      if (!email) {
        setProfile(null);
        setLoadingProfile(false);
        return;
      }

      const { data } = await supabase
        .from("campaigners")
        .select("id, full_name, email, role, zone")
        .ilike("email", email)
        .maybeSingle();

      setProfile(data || null);
      setLoadingProfile(false);
    }

    loadProfile();
  }, [pathname]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  if (hiddenRoutes.includes(pathname)) {
    return null;
  }

  async function logout() {
    setMenuOpen(false);
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const links = linksForRole(profile?.role || null);
  const homeHref = homeForRole(profile?.role || null);

  return (
    <nav className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex min-h-16 items-center justify-between gap-3 py-3">
          <Link
            href={homeHref}
            className="flex min-w-0 items-center gap-3"
            aria-label="Go to Team Rigo home"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-700 text-sm font-black text-white shadow-sm">
              TR
            </div>

            <div className="min-w-0">
              <p className="truncate text-sm font-black uppercase tracking-wide text-blue-700">
                Team Rigo
              </p>
              <p className="hidden truncate text-xs text-slate-500 sm:block">
                Campaign Operations Platform
              </p>
            </div>
          </Link>

          <div className="hidden min-w-0 items-center gap-2 lg:flex">
            {links.map((link) => {
              const active = isActiveLink(pathname, link.href);

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-xl px-3 py-2 text-sm font-bold transition ${
                    active
                      ? "bg-blue-700 text-white shadow-sm"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <span className="xl:hidden">
                    {link.shortLabel || link.label}
                  </span>
                  <span className="hidden xl:inline">{link.label}</span>
                </Link>
              );
            })}
          </div>

          <div className="hidden shrink-0 items-center gap-2 lg:flex">
            {profile ? (
              <div className="max-w-[220px] rounded-2xl bg-slate-100 px-3 py-2 text-xs text-slate-700">
                <p className="truncate font-bold text-slate-900">
                  {profile.full_name}
                </p>
                <p className="truncate">
                  {profile.role || "No Role"}
                  {profile.zone ? ` · ${profile.zone}` : ""}
                </p>
              </div>
            ) : (
              <div className="rounded-2xl bg-slate-100 px-3 py-2 text-xs text-slate-500">
                {loadingProfile ? "Loading..." : "No profile"}
              </div>
            )}

            <button
              onClick={logout}
              className="rounded-xl border border-red-200 px-3 py-2 text-sm font-bold text-red-700 transition hover:bg-red-50"
            >
              Logout
            </button>
          </div>

          <button
            type="button"
            onClick={() => setMenuOpen((current) => !current)}
            className="inline-flex shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-800 shadow-sm transition hover:bg-slate-50 lg:hidden"
            aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={menuOpen}
          >
            <span className="mr-2">{menuOpen ? "Close" : "Menu"}</span>

            <span className="flex h-5 w-5 flex-col justify-center gap-1">
              <span
                className={`block h-0.5 rounded-full bg-slate-800 transition ${
                  menuOpen ? "translate-y-1.5 rotate-45" : ""
                }`}
              />
              <span
                className={`block h-0.5 rounded-full bg-slate-800 transition ${
                  menuOpen ? "opacity-0" : ""
                }`}
              />
              <span
                className={`block h-0.5 rounded-full bg-slate-800 transition ${
                  menuOpen ? "-translate-y-1.5 -rotate-45" : ""
                }`}
              />
            </span>
          </button>
        </div>

        {menuOpen && (
          <div className="border-t border-slate-200 py-4 lg:hidden">
            <div className="mb-4 rounded-2xl bg-slate-100 p-4">
              {profile ? (
                <>
                  <p className="break-words text-sm font-black text-slate-900">
                    {profile.full_name}
                  </p>

                  <p className="mt-1 break-words text-sm text-slate-600">
                    {profile.role || "No Role"}
                    {profile.zone ? ` · ${profile.zone}` : ""}
                  </p>

                  {profile.email && (
                    <p className="mt-1 break-words text-xs text-slate-500">
                      {profile.email}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-slate-500">
                  {loadingProfile ? "Loading profile..." : "No profile loaded"}
                </p>
              )}
            </div>

            <div className="grid gap-2">
              {links.map((link) => {
                const active = isActiveLink(pathname, link.href);

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`rounded-2xl px-4 py-4 text-base font-black transition ${
                      active
                        ? "bg-blue-700 text-white shadow-sm"
                        : "bg-white text-slate-800 hover:bg-slate-100"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}

              {links.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">
                  No navigation links available for this account.
                </div>
              )}

              <button
                onClick={logout}
                className="mt-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-left text-base font-black text-red-700 transition hover:bg-red-100"
              >
                Logout
              </button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
