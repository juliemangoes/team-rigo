"use client";

import Link from "next/link";
import type { MouseEvent } from "react";
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
    description: "Campaign overview",
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
    description: "Voter records",
  },
  {
    href: "/campaigners",
    label: "Field View",
    shortLabel: "Field",
    description: "Campaigner and driver work",
  },
  {
    href: "/team",
    label: "Team Setup",
    shortLabel: "Team",
    description: "Users, roles and access",
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

function getInitials(name: string | null | undefined) {
  if (!name) return "TR";

  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) return "TR";

  return parts.map((part) => part.charAt(0).toUpperCase()).join("");
}

export default function Navigation() {
  const pathname = usePathname();
  const router = useRouter();

  const [profile, setProfile] = useState<TeamProfile | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const links = useMemo(() => linksForRole(profile?.role || null), [profile]);
  const homeHref = homeForRole(profile?.role || null);

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

  if (hiddenRoutes.includes(pathname)) {
    return null;
  }

  async function logout(event?: MouseEvent<HTMLButtonElement>) {
    event?.preventDefault();

    if (signingOut) return;

    setSigningOut(true);
    setMenuOpen(false);

    try {
      const { error } = await supabase.auth.signOut({ scope: "global" });

      if (error) {
        console.error("Logout error:", error);
      }
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      if (typeof window !== "undefined") {
        try {
          Object.keys(window.localStorage).forEach((key) => {
            if (key.startsWith("sb-") && key.includes("auth-token")) {
              window.localStorage.removeItem(key);
            }
          });

          Object.keys(window.sessionStorage).forEach((key) => {
            if (key.startsWith("sb-") && key.includes("auth-token")) {
              window.sessionStorage.removeItem(key);
            }
          });
        } catch (storageError) {
          console.error("Could not clear auth storage:", storageError);
        }

        window.location.replace("/login");
        return;
      }

      router.replace("/login");
      router.refresh();
    }
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
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-sky-700 text-sm font-black text-white shadow-sm">
                TR
              </div>

              <div className="min-w-0">
                <p className="truncate text-sm font-black uppercase tracking-wide text-sky-700">
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
                        ? "bg-sky-700 text-white shadow-sm"
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
                type="button"
                onClick={logout}
                disabled={signingOut}
                className="rounded-xl border border-red-200 px-3 py-2 text-sm font-bold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {signingOut ? "Logging out..." : "Logout"}
              </button>
            </div>

            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:bg-slate-50 lg:hidden"
              aria-label="Open navigation menu"
              aria-expanded={menuOpen}
            >
              <span className="grid gap-1">
                <span className="block h-0.5 w-5 rounded-full bg-slate-900" />
                <span className="block h-0.5 w-5 rounded-full bg-slate-900" />
                <span className="block h-0.5 w-5 rounded-full bg-slate-900" />
              </span>
            </button>
          </div>
        </div>
      </nav>

      {menuOpen && (
        <div className="fixed inset-0 z-[999] bg-white lg:hidden">
          <div className="flex h-full flex-col">
            <div className="border-b border-slate-200 px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-700 text-sm font-black text-white">
                    TR
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-base font-black text-slate-950">
                      Menu
                    </p>
                    <p className="truncate text-xs font-semibold text-slate-500">
                      Team Rigo
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setMenuOpen(false)}
                  className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-2xl font-black leading-none text-slate-900"
                  aria-label="Close navigation menu"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3">
              <div className="divide-y divide-slate-100 rounded-3xl border border-slate-200 bg-white">
                {links.map((link) => {
                  const active = isActiveLink(pathname, link.href);

                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`flex items-center justify-between gap-4 px-4 py-4 transition ${
                        active ? "bg-sky-50" : "hover:bg-slate-50"
                      } first:rounded-t-3xl last:rounded-b-3xl`}
                    >
                      <div className="min-w-0">
                        <p
                          className={`truncate text-base font-black ${
                            active ? "text-sky-700" : "text-slate-950"
                          }`}
                        >
                          {link.label}
                        </p>

                        <p className="mt-0.5 truncate text-sm font-semibold text-slate-500">
                          {link.description}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        {active && (
                          <span className="rounded-full bg-sky-700 px-2.5 py-1 text-xs font-black text-white">
                            Open
                          </span>
                        )}
                        <span className="text-xl font-black text-slate-300">
                          ›
                        </span>
                      </div>
                    </Link>
                  );
                })}

                {links.length === 0 && (
                  <div className="p-6 text-center text-sm font-semibold text-slate-500">
                    No navigation links available for this account.
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-slate-200 bg-slate-50 p-4">
              {profile ? (
                <div className="mb-3 flex items-center gap-3 rounded-3xl bg-white p-3 shadow-sm">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-sm font-black text-white">
                    {getInitials(profile.full_name)}
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-slate-950">
                      {profile.full_name}
                    </p>
                    <p className="truncate text-xs font-semibold text-slate-500">
                      {profile.role || "No Role"}
                      {profile.zone ? ` · ${profile.zone}` : ""}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="mb-3 rounded-3xl bg-white p-3 text-sm font-semibold text-slate-500 shadow-sm">
                  {loadingProfile ? "Loading profile..." : "No profile loaded"}
                </div>
              )}

              <div className="grid grid-cols-[1fr_auto] gap-3">
                <Link
                  href={homeHref}
                  className="rounded-2xl bg-white px-4 py-3 text-center text-sm font-black text-slate-800 shadow-sm"
                >
                  Home
                </Link>

                <button
                  type="button"
                  onClick={logout}
                  disabled={signingOut}
                  className="rounded-2xl bg-red-600 px-5 py-3 text-sm font-black text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {signingOut ? "Logging out..." : "Logout"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
