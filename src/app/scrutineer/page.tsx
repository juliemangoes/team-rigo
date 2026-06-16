"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type TeamProfile = {
  id: string;
  full_name: string;
  email: string | null;
  role: string | null;
  zone: string | null;
  assigned_polling_area: string | null;
  assigned_classroom: string | null;
  surname_from: string | null;
  surname_to: string | null;
};

type Voter = {
  id: string;
  voter_reg_no: string | null;
  voter_number: string | null;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  full_name: string;
  dob: string | null;
  age: number | null;
  street_name: string | null;
  address: string | null;
  zone: string | null;
  polling_area: string | null;
  polling_station: string | null;
  voted: boolean;
  voted_at: string | null;
};

type VotedFilter = "Not Voted" | "Voted" | "All";

const voterSelect = `
  id,
  voter_reg_no,
  voter_number,
  first_name,
  middle_name,
  last_name,
  full_name,
  dob,
  age,
  street_name,
  address,
  zone,
  polling_area,
  polling_station,
  voted,
  voted_at
`;

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value || 0);
}

function cleanText(value: string | null | undefined) {
  return value?.trim() || "";
}

function getDisplayName(voter: Voter) {
  const nameFromParts = [
    voter.first_name,
    voter.middle_name,
    voter.last_name,
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  return nameFromParts || voter.full_name || "Unnamed voter";
}

function getRegNo(voter: Voter) {
  return voter.voter_reg_no || voter.voter_number || "No reg no.";
}

function getAddress(voter: Voter) {
  return voter.street_name || voter.address || "";
}

function getPollingArea(voter: Voter) {
  return voter.polling_area || voter.polling_station || "";
}

function formatTime(value: string | null) {
  if (!value) return "";

  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateTime(value: string | null) {
  if (!value) return "";

  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function initials(name: string | null | undefined) {
  if (!name) return "TR";

  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) return "TR";

  return parts.map((part) => part.charAt(0).toUpperCase()).join("");
}

function percentage(value: number, total: number) {
  if (!total || total <= 0) return 0;
  return Math.round((value / total) * 100);
}

function clamp(value: number, min = 0, max = 100) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function SummaryCard({
  label,
  value,
  detail,
  tone = "slate",
}: {
  label: string;
  value: string | number;
  detail?: string;
  tone?: "sky" | "green" | "red" | "amber" | "purple" | "slate";
}) {
  const color =
    tone === "sky"
      ? "border-sky-100 bg-sky-50 text-sky-700"
      : tone === "green"
      ? "border-green-100 bg-green-50 text-green-700"
      : tone === "red"
      ? "border-red-100 bg-red-50 text-red-700"
      : tone === "amber"
      ? "border-amber-100 bg-amber-50 text-amber-700"
      : tone === "purple"
      ? "border-purple-100 bg-purple-50 text-purple-700"
      : "border-slate-200 bg-white text-slate-900";

  return (
    <div className={`rounded-[1.6rem] border p-4 shadow-sm ${color}`}>
      <p className="text-xs font-black uppercase tracking-wide opacity-65">
        {label}
      </p>
      <p className="mt-2 text-2xl font-black tracking-tight">{value}</p>
      {detail && <p className="mt-1 text-xs font-semibold opacity-70">{detail}</p>}
    </div>
  );
}

function ProgressBar({ value, total }: { value: number; total: number }) {
  const width = clamp(percentage(value, total));

  return (
    <div className="h-3 overflow-hidden rounded-full bg-slate-100">
      <div className="h-3 rounded-full bg-sky-500" style={{ width: `${width}%` }} />
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-xs font-black uppercase tracking-wide text-slate-500">
      {children}
    </label>
  );
}

export default function ScrutineerPage() {
  const [profile, setProfile] = useState<TeamProfile | null>(null);
  const [voters, setVoters] = useState<Voter[]>([]);
  const [lastMarkedVoter, setLastMarkedVoter] = useState<Voter | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadingVoters, setLoadingVoters] = useState(false);
  const [markingId, setMarkingId] = useState("");
  const [message, setMessage] = useState("");

  const [search, setSearch] = useState("");
  const [votedFilter, setVotedFilter] = useState<VotedFilter>("Not Voted");

  const canAccess = profile?.role === "Scrutineer";
  const assignmentComplete =
    !!profile?.assigned_polling_area &&
    !!profile?.assigned_classroom &&
    !!profile?.surname_from &&
    !!profile?.surname_to;

  useEffect(() => {
    loadPage();
  }, []);

  async function loadPage() {
    setLoading(true);
    setMessage("");

    const { data: sessionData } = await supabase.auth.getSession();
    const email = sessionData.session?.user.email;

    if (!email) {
      setMessage("No login email found.");
      setLoading(false);
      return;
    }

    const { data: profileData, error: profileError } = await supabase
      .from("campaigners")
      .select(
        `
        id,
        full_name,
        email,
        role,
        zone,
        assigned_polling_area,
        assigned_classroom,
        surname_from,
        surname_to
      `
      )
      .ilike("email", email)
      .maybeSingle();

    if (profileError) {
      console.error("Profile error:", profileError);
      setMessage("Error loading your scrutineer profile.");
      setLoading(false);
      return;
    }

    if (!profileData) {
      setMessage("No Team Rigo profile found for this login email.");
      setLoading(false);
      return;
    }

    setProfile(profileData);
    setLoading(false);

    if (profileData.role === "Scrutineer") {
      await loadVoters();
    }
  }

  async function loadVoters() {
    setLoadingVoters(true);
    setMessage("");

    const { data, error } = await supabase
      .from("voters")
      .select(voterSelect)
      .order("last_name", { ascending: true, nullsFirst: false })
      .order("first_name", { ascending: true, nullsFirst: false })
      .range(0, 49999);

    if (error) {
      console.error("Scrutineer voters load error:", error);
      setMessage(error.message || "Error loading your assigned voter list.");
      setVoters([]);
      setLoadingVoters(false);
      return;
    }

    setVoters(data || []);
    setLoadingVoters(false);
  }

  const stats = useMemo(() => {
    const total = voters.length;
    const voted = voters.filter((voter) => voter.voted).length;
    const notVoted = total - voted;

    return {
      total,
      voted,
      notVoted,
      progress: percentage(voted, total),
    };
  }, [voters]);

  const filteredVoters = useMemo(() => {
    const cleanSearch = search.trim().toLowerCase();

    return voters.filter((voter) => {
      const matchesFilter =
        votedFilter === "All" ||
        (votedFilter === "Voted" && voter.voted) ||
        (votedFilter === "Not Voted" && !voter.voted);

      const matchesSearch =
        !cleanSearch ||
        getRegNo(voter).toLowerCase() === cleanSearch ||
        getRegNo(voter).toLowerCase().includes(cleanSearch) ||
        getDisplayName(voter).toLowerCase().includes(cleanSearch) ||
        cleanText(voter.first_name).toLowerCase().includes(cleanSearch) ||
        cleanText(voter.middle_name).toLowerCase().includes(cleanSearch) ||
        cleanText(voter.last_name).toLowerCase().includes(cleanSearch) ||
        getAddress(voter).toLowerCase().includes(cleanSearch);

      return matchesFilter && matchesSearch;
    });
  }, [voters, search, votedFilter]);

  async function setVotedStatus(voter: Voter, voted: boolean) {
    if (!canAccess) return;

    const actionText = voted ? "mark this voter as voted" : "undo this voted mark";
    const confirmed = confirm(`Are you sure you want to ${actionText}?`);

    if (!confirmed) return;

    setMarkingId(voter.id);
    setMessage("");

    const { data, error } = await supabase.rpc("set_voter_voted_status", {
      p_voter_id: voter.id,
      p_voted: voted,
    });

    if (error) {
      console.error("Set voted status error:", error);
      setMessage(error.message || "Error updating voted status.");
      setMarkingId("");
      return;
    }

    const updatedVoter = data as Voter;

    setVoters((current) =>
      current.map((item) =>
        item.id === voter.id
          ? {
              ...item,
              voted: updatedVoter.voted,
              voted_at: updatedVoter.voted_at,
            }
          : item
      )
    );

    setLastMarkedVoter(
      voted
        ? {
            ...voter,
            voted: updatedVoter.voted,
            voted_at: updatedVoter.voted_at,
          }
        : null
    );

    setSearch("");

    if (voted) {
      setMessage(`${getDisplayName(voter)} marked as voted.`);
    } else {
      setMessage(`${getDisplayName(voter)} voted mark undone.`);
    }

    setMarkingId("");
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#eef2f6] p-4 sm:p-6">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-[2rem] bg-white p-6 text-center shadow-sm">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-sky-600" />
            <h1 className="mt-5 text-xl font-black text-slate-900">
              Loading scrutineer station...
            </h1>
          </div>
        </div>
      </main>
    );
  }

  if (!canAccess) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#eef2f6] p-4 sm:p-6">
        <div className="w-full max-w-xl rounded-[2rem] bg-white p-6 text-center shadow-sm sm:p-8">
          <h1 className="text-2xl font-black text-slate-900">
            Scrutineer Access Only
          </h1>
          <p className="mt-3 text-slate-600">
            This station is restricted to users assigned as Scrutineers.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#eef2f6]">
      <section className="px-4 py-5 sm:px-6 sm:py-8">
        <div className="mx-auto max-w-5xl">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                Election Day Station
              </p>
              <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950 sm:text-5xl">
                Scrutineer
              </h1>
              <p className="mt-1 truncate text-sm font-semibold text-slate-500">
                {profile.full_name}
              </p>
            </div>

            <button
              onClick={loadVoters}
              disabled={loadingVoters}
              className="shrink-0 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loadingVoters ? "..." : "Refresh"}
            </button>
          </div>

          {message && (
            <div className="mb-4 rounded-2xl border border-sky-100 bg-sky-50 p-4 text-sm font-bold text-sky-900">
              {message}
            </div>
          )}

          {!assignmentComplete && (
            <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">
              This scrutineer assignment is incomplete. Add polling area,
              classroom and surname range in Team Setup.
            </div>
          )}

          <section className="overflow-hidden rounded-[2rem] bg-slate-950 p-5 text-white shadow-xl shadow-slate-300 sm:p-7">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-sm font-black text-white">
                    {initials(profile.full_name)}
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-lg font-black">
                      {profile.assigned_classroom || "No Classroom"}
                    </p>
                    <p className="truncate text-sm font-semibold text-white/50">
                      Polling {profile.assigned_polling_area || "Not Set"}
                    </p>
                  </div>
                </div>

                <h2 className="mt-6 text-3xl font-black tracking-tight sm:text-5xl">
                  {formatNumber(stats.notVoted)} voters left
                </h2>

                <p className="mt-3 text-sm font-medium leading-6 text-white/60">
                  Surname range: {profile.surname_from || "?"} to{" "}
                  {profile.surname_to || "?"}. Mark only when the voter has
                  appeared and is confirmed as voted.
                </p>
              </div>

              <div className="rounded-[1.5rem] bg-white/10 p-4 ring-1 ring-white/10">
                <p className="text-xs font-black uppercase tracking-wide text-white/50">
                  Progress
                </p>
                <p className="mt-2 text-4xl font-black text-sky-300">
                  {stats.progress}%
                </p>
                <p className="mt-1 text-xs font-semibold text-white/50">
                  {formatNumber(stats.voted)} of {formatNumber(stats.total)}
                </p>
              </div>
            </div>

            <div className="mt-7">
              <div className="mb-2 flex items-center justify-between text-xs font-bold text-white/60">
                <span>Marked voted</span>
                <span>{stats.progress}%</span>
              </div>

              <div className="h-3 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-3 rounded-full bg-sky-400"
                  style={{ width: `${clamp(stats.progress)}%` }}
                />
              </div>
            </div>
          </section>

          <div className="mt-4 grid grid-cols-3 gap-3">
            <SummaryCard
              label="Assigned"
              value={formatNumber(stats.total)}
              detail="Visible list"
              tone="sky"
            />
            <SummaryCard
              label="Voted"
              value={formatNumber(stats.voted)}
              detail="Marked today"
              tone="green"
            />
            <SummaryCard
              label="Left"
              value={formatNumber(stats.notVoted)}
              detail="Not yet marked"
              tone={stats.notVoted > 0 ? "amber" : "green"}
            />
          </div>

          {lastMarkedVoter && (
            <section className="mt-4 rounded-[2rem] border border-green-100 bg-green-50 p-4 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-green-700">
                    Immediate Past Voter
                  </p>
                  <h2 className="mt-1 text-xl font-black text-slate-950">
                    {getDisplayName(lastMarkedVoter)}
                  </h2>
                  <p className="mt-1 text-sm font-semibold text-green-800">
                    {getRegNo(lastMarkedVoter)} · Marked{" "}
                    {formatDateTime(lastMarkedVoter.voted_at)}
                  </p>
                </div>

                <button
                  onClick={() => setVotedStatus(lastMarkedVoter, false)}
                  disabled={markingId === lastMarkedVoter.id}
                  className="rounded-2xl border border-red-200 bg-white px-4 py-3 text-sm font-black text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Undo
                </button>
              </div>
            </section>
          )}

          <section className="mt-4 rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
              <div>
                <FieldLabel>Search Voter</FieldLabel>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-4 text-base font-semibold text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-sky-700 focus:ring-4 focus:ring-sky-100"
                  placeholder="Reg no., first name, last name, or address..."
                  autoFocus
                />
              </div>

              <div>
                <FieldLabel>Status</FieldLabel>
                <select
                  value={votedFilter}
                  onChange={(event) => setVotedFilter(event.target.value as VotedFilter)}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-base font-semibold text-slate-900 shadow-sm outline-none transition focus:border-sky-700 focus:ring-4 focus:ring-sky-100 md:w-44"
                >
                  <option>Not Voted</option>
                  <option>Voted</option>
                  <option>All</option>
                </select>
              </div>
            </div>
          </section>

          <section className="mt-4 rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-black text-slate-950">
                  Voter Checklist
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Showing {formatNumber(filteredVoters.length)} voter(s).
                </p>
              </div>

              {loadingVoters && (
                <span className="w-fit rounded-full bg-sky-50 px-3 py-1 text-xs font-black text-sky-700">
                  Loading...
                </span>
              )}
            </div>

            <div className="grid gap-3">
              {filteredVoters.map((voter) => (
                <article
                  key={voter.id}
                  className={`rounded-[1.7rem] border p-4 ${
                    voter.voted
                      ? "border-green-100 bg-green-50"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">
                          {getRegNo(voter)}
                        </span>

                        <span
                          className={`rounded-full px-3 py-1 text-xs font-black ${
                            voter.voted
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {voter.voted ? "Voted" : "Not Voted"}
                        </span>
                      </div>

                      <h3 className="mt-3 break-words text-2xl font-black text-slate-950">
                        {getDisplayName(voter)}
                      </h3>

                      <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-3">
                        <p>
                          <span className="font-black text-slate-400">Age:</span>{" "}
                          {voter.age || "—"}
                        </p>
                        <p>
                          <span className="font-black text-slate-400">
                            Polling:
                          </span>{" "}
                          {getPollingArea(voter) || "—"}
                        </p>
                        <p>
                          <span className="font-black text-slate-400">
                            Address:
                          </span>{" "}
                          {getAddress(voter) || "—"}
                        </p>
                      </div>

                      {voter.voted_at && (
                        <p className="mt-3 text-xs font-black text-green-700">
                          Marked voted at {formatTime(voter.voted_at)}
                        </p>
                      )}
                    </div>

                    <div className="shrink-0">
                      {voter.voted ? (
                        <button
                          onClick={() => setVotedStatus(voter, false)}
                          disabled={markingId === voter.id}
                          className="w-full rounded-2xl border border-red-200 bg-white px-5 py-4 text-sm font-black text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 md:w-auto"
                        >
                          Undo
                        </button>
                      ) : (
                        <button
                          onClick={() => setVotedStatus(voter, true)}
                          disabled={markingId === voter.id}
                          className="w-full rounded-2xl bg-sky-700 px-5 py-4 text-sm font-black text-white shadow-sm hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-sky-300 md:w-auto"
                        >
                          {markingId === voter.id ? "Marking..." : "Mark Voted"}
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              ))}

              {filteredVoters.length === 0 && (
                <div className="rounded-3xl border border-dashed border-slate-300 p-8 text-center text-sm font-semibold text-slate-500">
                  No voters match this search.
                </div>
              )}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
