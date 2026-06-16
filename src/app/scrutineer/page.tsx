"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
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

type CampaignerRelation =
  | {
      id: string;
      full_name: string;
    }
  | {
      id: string;
      full_name: string;
    }[]
  | null;

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
  support_status: string | null;
  campaigner_id: string | null;
  pickup_needed: boolean;
  pickup_status: string | null;
  voted: boolean;
  voted_at: string | null;
  notes: string | null;
  campaigners?: {
    id: string;
    full_name: string;
  } | null;
};

type RawVoter = Omit<Voter, "campaigners"> & {
  campaigners?: CampaignerRelation;
};

type Stats = {
  totalAssigned: number;
  voted: number;
  notVoted: number;
};

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
  support_status,
  campaigner_id,
  pickup_needed,
  pickup_status,
  voted,
  voted_at,
  notes,
  campaigners:campaigner_id (
    id,
    full_name
  )
`;

export default function ScrutineerPage() {
  const searchRef = useRef<HTMLInputElement | null>(null);

  const [profile, setProfile] = useState<TeamProfile | null>(null);
  const [results, setResults] = useState<Voter[]>([]);
  const [immediatePastVoter, setImmediatePastVoter] = useState<Voter | null>(
    null
  );

  const [stats, setStats] = useState<Stats>({
    totalAssigned: 0,
    voted: 0,
    notVoted: 0,
  });

  const [searchInput, setSearchInput] = useState("");

  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const canMarkVoted = profile?.role === "Scrutineer";

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (!loading) {
      searchRef.current?.focus();
    }
  }, [loading]);

  async function loadInitialData() {
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

    await loadStats();

    setLoading(false);
  }

  async function loadStats() {
    const totalResult = await supabase
      .from("voters")
      .select("id", { count: "exact", head: true });

    const votedResult = await supabase
      .from("voters")
      .select("id", { count: "exact", head: true })
      .eq("voted", true);

    const notVotedResult = await supabase
      .from("voters")
      .select("id", { count: "exact", head: true })
      .eq("voted", false);

    setStats({
      totalAssigned: totalResult.count || 0,
      voted: votedResult.count || 0,
      notVoted: notVotedResult.count || 0,
    });
  }

  function normalizeVoter(item: RawVoter): Voter {
    return {
      ...item,
      campaigners: Array.isArray(item.campaigners)
        ? item.campaigners[0] || null
        : item.campaigners || null,
    };
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

  function formatDob(dob: string | null) {
    if (!dob) return "No DOB";

    return dob;
  }

  function formatAge(age: number | null) {
    if (age === null || age === undefined) return "No age";

    return `${age}`;
  }

  function formatTime(value: string | null) {
    if (!value) return "";

    return new Date(value).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  async function runExactRegSearch(cleanSearch: string) {
    const { data, error } = await supabase
      .from("voters")
      .select(voterSelect)
      .eq("voter_reg_no", cleanSearch)
      .limit(12);

    if (error) {
      throw error;
    }

    if (data && data.length > 0) {
      return ((data || []) as RawVoter[]).map(normalizeVoter);
    }

    const { data: numberData, error: numberError } = await supabase
      .from("voters")
      .select(voterSelect)
      .eq("voter_number", cleanSearch)
      .limit(12);

    if (numberError) {
      throw numberError;
    }

    return ((numberData || []) as RawVoter[]).map(normalizeVoter);
  }

  async function searchVoters(event?: FormEvent) {
    event?.preventDefault();

    const cleanSearch = searchInput.trim().replace(/,/g, " ");

    if (!cleanSearch) {
      setResults([]);
      setMessage("Enter a voter registration number, surname, or name.");
      searchRef.current?.focus();
      return;
    }

    setSearching(true);
    setMessage("");

    try {
      const exactMatches = await runExactRegSearch(cleanSearch);

      if (exactMatches.length > 0) {
        setResults(exactMatches);
        setSearching(false);
        return;
      }

      const hasSpace = cleanSearch.includes(" ");

      const searchFields = [
        `voter_reg_no.ilike.%${cleanSearch}%`,
        `voter_number.ilike.%${cleanSearch}%`,
        `last_name.ilike.%${cleanSearch}%`,
        `first_name.ilike.%${cleanSearch}%`,
        `middle_name.ilike.%${cleanSearch}%`,
      ];

      if (hasSpace) {
        searchFields.push(`full_name.ilike.%${cleanSearch}%`);
      }

      const { data, error } = await supabase
        .from("voters")
        .select(voterSelect)
        .or(searchFields.join(","))
        .order("last_name", { ascending: true, nullsFirst: false })
        .order("first_name", { ascending: true, nullsFirst: false })
        .limit(12);

      if (error) {
        throw error;
      }

      const normalizedResults = ((data || []) as RawVoter[]).map(
        normalizeVoter
      );

      setResults(normalizedResults);

      if (normalizedResults.length === 0) {
        setMessage("No voter found in your assigned classroom list.");
      }
    } catch (error) {
      console.error("Search error:", error);
      setMessage("Error searching voter.");
      setResults([]);
    }

    setSearching(false);
  }

  async function markAsVoted(voter: Voter) {
    if (!canMarkVoted) {
      alert("Only scrutineers can mark voters as voted.");
      return;
    }

    if (voter.voted) {
      alert("This voter is already marked as voted.");
      return;
    }

    const confirmed = confirm(`Mark ${getDisplayName(voter)} as voted?`);

    if (!confirmed) return;

    setUpdatingId(voter.id);
    setMessage("");

    const { error } = await supabase.rpc("set_voter_voted_status", {
      p_voter_id: voter.id,
      p_voted: true,
    });

    if (error) {
      console.error("Mark voted error:", error);
      setMessage(error.message || "Error marking voter as voted.");
      setUpdatingId(null);
      return;
    }

    const updatedVoter: Voter = {
      ...voter,
      voted: true,
      voted_at: new Date().toISOString(),
    };

    setImmediatePastVoter(updatedVoter);
    setResults([]);
    setSearchInput("");
    setMessage(`${getDisplayName(voter)} was marked as voted.`);

    await loadStats();

    setUpdatingId(null);

    setTimeout(() => {
      searchRef.current?.focus();
    }, 100);
  }

  async function undoImmediatePast() {
    if (!immediatePastVoter) return;

    const confirmed = confirm(
      `Undo voted status for ${getDisplayName(immediatePastVoter)}?`
    );

    if (!confirmed) return;

    setUpdatingId(immediatePastVoter.id);
    setMessage("");

    const { error } = await supabase.rpc("set_voter_voted_status", {
      p_voter_id: immediatePastVoter.id,
      p_voted: false,
    });

    if (error) {
      console.error("Undo voted error:", error);
      setMessage(error.message || "Error undoing voted status.");
      setUpdatingId(null);
      return;
    }

    setMessage(
      `Voted status was undone for ${getDisplayName(immediatePastVoter)}.`
    );
    setImmediatePastVoter(null);

    await loadStats();

    setUpdatingId(null);

    setTimeout(() => {
      searchRef.current?.focus();
    }, 100);
  }

  function clearSearch() {
    setSearchInput("");
    setResults([]);
    setMessage("");
    searchRef.current?.focus();
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <div className="rounded-2xl bg-white p-8 text-center shadow">
          <p className="text-sm font-semibold uppercase tracking-wide text-sky-700">
            Team Rigo
          </p>

          <h1 className="mt-3 text-2xl font-bold text-slate-900">
            Loading scrutineer station...
          </h1>
        </div>
      </main>
    );
  }

  if (!canMarkVoted) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <div className="w-full max-w-xl rounded-2xl bg-white p-8 text-center shadow">
          <p className="text-sm font-semibold uppercase tracking-wide text-sky-700">
            Team Rigo
          </p>

          <h1 className="mt-3 text-2xl font-bold text-slate-900">
            Scrutineer Access Only
          </h1>

          <p className="mt-3 text-slate-600">
            This station is only for users assigned the Scrutineer role.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 grid gap-6 lg:grid-cols-3">
          <section className="rounded-2xl bg-white p-6 shadow lg:col-span-2">
            <div className="mb-6">
              <p className="text-sm font-semibold uppercase tracking-wide text-sky-700">
                Team Rigo
              </p>

              <h1 className="mt-2 text-3xl font-bold text-slate-900">
                Scrutineer Station
              </h1>

              <p className="mt-2 text-slate-600">
                Search voters in your assigned classroom list and mark them as
                voted.
              </p>
            </div>

            <div className="mb-6 rounded-2xl border border-sky-100 bg-sky-50 p-5">
              <p className="text-sm font-semibold uppercase tracking-wide text-sky-700">
                Assigned Classroom
              </p>

              <div className="mt-3 grid gap-3 md:grid-cols-4">
                <div>
                  <p className="text-xs text-sky-700">Polling Area</p>
                  <p className="text-lg font-bold text-slate-900">
                    {profile?.assigned_polling_area || "Not assigned"}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-sky-700">Classroom</p>
                  <p className="text-lg font-bold text-slate-900">
                    {profile?.assigned_classroom || "Not assigned"}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-sky-700">Surname Range</p>
                  <p className="text-lg font-bold text-slate-900">
                    {profile?.surname_from || "?"} – {profile?.surname_to || "?"}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-sky-700">Scrutineer</p>
                  <p className="text-lg font-bold text-slate-900">
                    {profile?.full_name}
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={searchVoters} className="mb-6">
              <label className="text-sm font-medium text-slate-700">
                Search Voter
              </label>

              <div className="mt-2 flex gap-3">
                <input
                  ref={searchRef}
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-5 py-4 text-xl font-semibold text-slate-900 outline-none focus:border-sky-700"
                  placeholder="Reg no., surname, first name..."
                />

                <button
                  type="submit"
                  disabled={searching}
                  className="rounded-xl bg-sky-700 px-8 py-4 text-lg font-bold text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-sky-300"
                >
                  {searching ? "Searching..." : "Search"}
                </button>

                <button
                  type="button"
                  onClick={clearSearch}
                  className="rounded-xl border border-slate-300 px-5 py-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Clear
                </button>
              </div>
            </form>

            {message && (
              <div className="mb-6 rounded-xl bg-slate-50 p-4 text-sm font-semibold text-slate-700">
                {message}
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full min-w-[750px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-slate-600">
                    <th className="p-3">Reg No.</th>
                    <th className="p-3">Name</th>
                    <th className="p-3">Age / DOB</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {results.map((voter) => (
                    <tr key={voter.id} className="border-b">
                      <td className="p-3 font-bold text-slate-900">
                        {getRegNo(voter)}
                      </td>

                      <td className="p-3">
                        <p className="font-bold text-slate-900">
                          {getDisplayName(voter)}
                        </p>

                        <p className="text-xs text-slate-500">
                          Campaigner:{" "}
                          {voter.campaigners?.full_name || "Unassigned"}
                        </p>
                      </td>

                      <td className="p-3 text-slate-700">
                        <p className="font-semibold">
                          Age: {formatAge(voter.age)}
                        </p>

                        <p className="text-xs text-slate-500">
                          DOB: {formatDob(voter.dob)}
                        </p>
                      </td>

                      <td className="p-3">
                        {voter.voted ? (
                          <div>
                            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-800">
                              Already Voted
                            </span>

                            {voter.voted_at && (
                              <p className="mt-2 text-xs font-semibold text-green-700">
                                Time: {formatTime(voter.voted_at)}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-800">
                            Not Voted
                          </span>
                        )}
                      </td>

                      <td className="p-3">
                        <button
                          onClick={() => markAsVoted(voter)}
                          disabled={updatingId === voter.id || voter.voted}
                          className="rounded-xl bg-green-700 px-5 py-3 font-bold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                        >
                          {updatingId === voter.id
                            ? "Marking..."
                            : voter.voted
                            ? "Done"
                            : "Mark Voted"}
                        </button>
                      </td>
                    </tr>
                  ))}

                  {results.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="p-10 text-center text-slate-500"
                      >
                        Search for a voter to begin.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <aside className="space-y-6">
            <section className="rounded-2xl bg-white p-6 shadow">
              <h2 className="text-xl font-bold text-slate-900">
                Classroom Count
              </h2>

              <div className="mt-5 grid gap-4">
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">Assigned List</p>
                  <h3 className="mt-1 text-3xl font-bold text-slate-900">
                    {stats.totalAssigned}
                  </h3>
                </div>

                <div className="rounded-xl bg-green-50 p-4">
                  <p className="text-sm text-green-700">Voted</p>
                  <h3 className="mt-1 text-3xl font-bold text-green-800">
                    {stats.voted}
                  </h3>
                </div>

                <div className="rounded-xl bg-red-50 p-4">
                  <p className="text-sm text-red-700">Not Yet Voted</p>
                  <h3 className="mt-1 text-3xl font-bold text-red-800">
                    {stats.notVoted}
                  </h3>
                </div>
              </div>
            </section>

            <section className="rounded-2xl bg-white p-6 shadow">
              <h2 className="text-xl font-bold text-slate-900">
                Immediate Past Voter
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Only the last voter marked at this station is shown.
              </p>

              {!immediatePastVoter ? (
                <div className="mt-5 rounded-xl border border-dashed border-slate-300 p-6 text-center text-slate-500">
                  No voter marked yet.
                </div>
              ) : (
                <div className="mt-5 rounded-2xl border border-green-200 bg-green-50 p-5">
                  <p className="text-sm font-semibold uppercase tracking-wide text-green-700">
                    Last Marked
                  </p>

                  <h3 className="mt-2 text-2xl font-bold text-slate-900">
                    {getDisplayName(immediatePastVoter)}
                  </h3>

                  <div className="mt-3 space-y-1 text-sm text-slate-700">
                    <p>
                      <span className="font-semibold">Reg No:</span>{" "}
                      {getRegNo(immediatePastVoter)}
                    </p>

                    <p>
                      <span className="font-semibold">Age:</span>{" "}
                      {formatAge(immediatePastVoter.age)}
                    </p>

                    <p>
                      <span className="font-semibold">DOB:</span>{" "}
                      {formatDob(immediatePastVoter.dob)}
                    </p>

                    <p>
                      <span className="font-semibold">Time:</span>{" "}
                      {formatTime(immediatePastVoter.voted_at)}
                    </p>
                  </div>

                  <button
                    onClick={undoImmediatePast}
                    disabled={updatingId === immediatePastVoter.id}
                    className="mt-5 w-full rounded-xl border border-red-300 bg-white px-4 py-3 font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Undo Last Mark
                  </button>
                </div>
              )}
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}