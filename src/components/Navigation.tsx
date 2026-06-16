"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
  description: string;
};

const allLinks: NavLink[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    description: "Victory overview",
  },
  {
    href: "/campaign-setup",
    label: "Campaign Setup",
    shortLabel: "Setup",
    description: "Targets and options",
  },
  {
    href: "/voters",
    label: "Voters",
    description: "Voter register",
  },
  {
    href: "/campaigners",
    label: "Field View",
    shortLabel: "Field",
    description: "Campaigner and driver work",
  },
  {
    href: "/scrutineer",
    label: "Scrutineer",
    description: "Election day marking",
  },
  {
    href: "/team",
    label: "Team Setup",
    shortLabel: "Team",
    description: "Users and roles",
  },
  {
    href: "/upload",
    label: "Upload",
    description: "Import voter data",
  },
  {
    href: "/reports",
    label: "Reports",
    description: "Export and analysis",
  },
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

function initials(name: string | null | undefined) {
  if (!name) return "TR";

  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) return "TR";

  return parts.map((part) => part[0]?.toUpperCase()).join("");
}

function linkNumber(index: number) {
  return String(index + 1).padStart(2, "0");
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

  useEffect(() => {
    if (!menuOpen) {
      document.body.style.overflow = "";
      return;
    }

    document.body.style.overflow = "hidden";

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    }

    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuOpen]);

  const links = useMemo(() => linksForRole(profile?.role || null), [profile]);
  const homeHref = homeForRole(profile?.role || null);

  if (hiddenRoutes.includes(pathname)) {
    return null;
  }

  async function logout() {
    setMenuOpen(false);
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <>
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
              onClick={() => setMenuOpen(true)}
              className="inline-flex shrink-0 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-800 shadow-sm transition hover:bg-slate-50 lg:hidden"
              aria-label="Open navigation menu"
              aria-expanded={menuOpen}
            >
              <span>Menu</span>
              <span className="grid gap-1">
                <span className="block h-0.5 w-4 rounded-full bg-slate-800" />
                <span className="block h-0.5 w-4 rounded-full bg-slate-800" />
                <span className="block h-0.5 w-4 rounded-full bg-slate-800" />
              </span>
            </button>
          </div>
        </div>
      </nav>

      {menuOpen && (
        <div className="fixed inset-0 z-[999] bg-slate-100 lg:hidden">
          <div className="flex h-full flex-col">
            <div className="relative overflow-hidden bg-white">
              <div className="absolute -right-16 -top-20 h-48 w-48 rounded-full bg-blue-100 blur-3xl" />
              <div className="absolute -left-16 top-10 h-40 w-40 rounded-full bg-cyan-100 blur-3xl" />

              <div className="relative flex min-h-16 items-center justify-between border-b border-slate-200 px-4 py-4">
                <Link
                  href={homeHref}
                  className="flex min-w-0 items-center gap-3"
                  aria-label="Go to Team Rigo home"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-700 text-sm font-black text-white shadow-sm">
                    TR
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-sm font-black uppercase tracking-wide text-slate-950">
                      Team Rigo
                    </p>
                    <p className="truncate text-xs font-semibold text-slate-500">
                      Navigation
                    </p>
                  </div>
                </Link>

                <button
                  type="button"
                  onClick={() => setMenuOpen(false)}
                  className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-2xl font-black leading-none text-slate-800 shadow-sm"
                  aria-label="Close navigation menu"
                >
                  ×
                </button>
              </div>

              <div className="relative px-4 py-4">
                <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                  {profile ? (
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-sm font-black text-white">
                        {initials(profile.full_name)}
                      </div>

                      <div className="min-w-0">
                        <p className="truncate text-base font-black text-slate-950">
                          {profile.full_name}
                        </p>

                        <p className="mt-0.5 truncate text-sm font-semibold text-slate-500">
                          {profile.role || "No Role"}
                          {profile.zone ? ` · ${profile.zone}` : ""}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm font-semibold text-slate-500">
                      {loadingProfile ? "Loading profile..." : "No profile loaded"}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4">
              <div className="grid grid-cols-2 gap-3">
                {links.map((link, index) => {
                  const active = isActiveLink(pathname, link.href);

                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`min-h-[112px] rounded-3xl border p-4 shadow-sm transition ${
                        active
                          ? "border-blue-700 bg-blue-700 text-white"
                          : "border-slate-200 bg-white text-slate-950 hover:border-blue-200 hover:bg-blue-50"
                      }`}
                    >
                      <div className="flex h-full flex-col justify-between">
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-black ${
                              active
                                ? "bg-white/20 text-white"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {linkNumber(index)}
                          </span>

                          {active && (
                            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-blue-700">
                              Open
                            </span>
                          )}
                        </div>

                        <div>
                          <p className="break-words text-lg font-black leading-tight">
                            {link.shortLabel || link.label}
                          </p>
                          <p
                            className={`mt-1 line-clamp-2 text-xs font-semibold ${
                              active ? "text-blue-100" : "text-slate-500"
                            }`}
                          >
                            {link.description}
                          </p>
                        </div>
                      </div>
                    </Link>
                  );
                })}

                {links.length === 0 && (
                  <div className="col-span-2 rounded-3xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm font-semibold text-slate-500">
                    No navigation links available for this account.
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-slate-200 bg-white p-4">
              <div className="grid grid-cols-[1fr_auto] gap-3">
                <Link
                  href={homeHref}
                  className="rounded-2xl bg-slate-100 px-4 py-4 text-center text-sm font-black text-slate-800"
                >
                  Home
                </Link>

                <button
                  onClick={logout}
                  className="rounded-2xl bg-red-600 px-6 py-4 text-sm font-black text-white shadow-sm hover:bg-red-700"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
