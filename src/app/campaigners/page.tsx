"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

const PAGE_SIZE = 20;

type TeamProfile = {
  id: string;
  full_name: string;
  email: string | null;
  role: string | null;
  zone: string | null;
};

type Campaigner = {
  id: string;
  full_name: string;
  phone: string | null;
  zone: string | null;
  role: string | null;
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
  street_name: string | null;
  address: string | null;
  zone: string | null;
  polling_area: string | null;
  polling_station: string | null;
  contact_no: string | null;
  phone: string | null;
  support_status: string | null;
  campaigner_id: string | null;
  pickup_needed: boolean;
  pickup_status: string | null;
  pickup_priority: number | null;
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
  totalVisible: number;
  activeWork: number;
  completed: number;
  issues: number;
  pickupNeeded: number;
};

const pickupStatuses = [
  "Not Contacted",
  "Confirmed Pickup",
  "On Route",
  "Picked Up",
  "At Polling Station",
  "Completed",
  "Issue",
  "No Pickup Needed",
];

const supportStatuses = [
  "All",
  "Unknown",
  "Confirmed Supporter",
  "Leaning Supporter",
  "Undecided",
  "Not Supporting",
  "Follow Up",
];

export default function CampaignersPage() {
  const [profile, setProfile] = useState<TeamProfile | null>(null);
  const [campaigners, setCampaigners] = useState<Campaigner[]>([]);
  const [voters, setVoters] = useState<Voter[]>([]);

  const [stats, setStats] = useState<Stats>({
    totalVisible: 0,
    activeWork: 0,
    completed: 0,
    issues: 0,
    pickupNeeded: 0,
  });

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [workFilter, setWorkFilter] = useState("Active Work");
  const [pickupStatusFilter, setPickupStatusFilter] = useState("All");
  const [supportFilter, setSupportFilter] = useState("All");
  const [campaignerFilter, setCampaignerFilter] = useState("All");

  const [currentPage, setCurrentPage] = useState(1);
  const [totalMatching, setTotalMatching] = useState(0);

  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(totalMatching / PAGE_SIZE));
  }, [totalMatching]);

  const canFilterByCampaigner =
    profile?.role === "Campaign Manager" || profile?.role === "Zone Leader";

  const visibleCampaigners = useMemo(() => {
    if (!profile) return [];

    if (profile.role === "Campaign Manager") {
      return campaigners;
    }

    if (profile.role === "Zone Leader") {
      if (profile.zone === "All Zones") return campaigners;
      return campaigners.filter((member) => member.zone === profile.zone);
    }

    return campaigners.filter((member) => member.id === profile.id);
  }, [campaigners, profile]);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (profile) {
      loadVoters();
    }
  }, [
    profile,
    currentPage,
    search,
    workFilter,
    pickupStatusFilter,
    supportFilter,
    campaignerFilter,
  ]);

  function applyRoleScope(query: any, activeProfile: TeamProfile | null) {
    if (!activeProfile) return query;

    if (activeProfile.role === "Campaign Manager") {
      return query;
    }

    if (activeProfile.role === "Zone Leader") {
      if (activeProfile.zone === "All Zones") return query;
      return query.eq("zone", activeProfile.zone);
    }

    if (activeProfile.role === "Campaigner") {
      return query.eq("campaigner_id", activeProfile.id);
    }

    if (activeProfile.role === "Driver") {
      let scopedQuery = query.eq("pickup_needed", true);

      if (activeProfile.zone !== "All Zones") {
        scopedQuery = scopedQuery.eq("zone", activeProfile.zone);
      }

      return scopedQuery;
    }

    return query.eq("campaigner_id", activeProfile.id);
  }

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
      .select("id, full_name, email, role, zone")
      .ilike("email", email)
      .maybeSingle();

    if (profileError) {
      console.error("Profile error:", profileError);
      setMessage("Error loading your team profile.");
      setLoading(false);
      return;
    }

    if (!profileData) {
      setMessage("No Team Rigo profile found for this login email.");
      setLoading(false);
      return;
    }

    setProfile(profileData);

    const { data: campaignerData, error: campaignerError } = await supabase
      .from("campaigners")
      .select("id, full_name, phone, zone, role")
      .order("full_name", { ascending: true });

    if (campaignerError) {
      console.error("Campaigner error:", campaignerError);
      setMessage("Error loading campaigners.");
      setLoading(false);
      return;
    }

    setCampaigners(campaignerData || []);

    await loadStats(profileData);

    setLoading(false);
  }

  async function getScopedCount(
    activeProfile: TeamProfile,
    applyExtraFilters?: (query: any) => any
  ) {
    let query = supabase
      .from("voters")
      .select("id", { count: "exact", head: true });

    query = applyRoleScope(query, activeProfile);

    if (applyExtraFilters) {
      query = applyExtraFilters(query);
    }

    const { count } = await query;

    return count || 0;
  }

  async function loadStats(activeProfile = profile) {
    if (!activeProfile) return;

    const totalVisible = await getScopedCount(activeProfile);

    const activeWork = await getScopedCount(activeProfile, (query) =>
      query.eq("voted", false).lt("pickup_priority", 80)
    );

    const completed = await getScopedCount(activeProfile, (query) =>
      query.eq("pickup_status", "Completed")
    );

    const issues = await getScopedCount(activeProfile, (query) =>
      query.eq("pickup_status", "Issue")
    );

    const pickupNeeded = await getScopedCount(activeProfile, (query) =>
      query.eq("pickup_needed", true)
    );

    setStats({
      totalVisible,
      activeWork,
      completed,
      issues,
      pickupNeeded,
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

  async function loadVoters() {
    setListLoading(true);
    setMessage("");

    const from = (currentPage - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from("voters")
      .select(
        `
        id,
        voter_reg_no,
        voter_number,
        first_name,
        middle_name,
        last_name,
        full_name,
        street_name,
        address,
        zone,
        polling_area,
        polling_station,
        contact_no,
        phone,
        support_status,
        campaigner_id,
        pickup_needed,
        pickup_status,
        pickup_priority,
        voted,
        voted_at,
        notes,
        campaigners:campaigner_id (
          id,
          full_name
        )
      `,
        { count: "exact" }
      )
      .order("pickup_priority", { ascending: true, nullsFirst: false })
      .order("last_name", { ascending: true, nullsFirst: false })
      .order("first_name", { ascending: true, nullsFirst: false })
      .range(from, to);

    query = applyRoleScope(query, profile);

    if (workFilter === "Active Work") {
      query = query.eq("voted", false).lt("pickup_priority", 80);
    }

    if (workFilter === "Completed Only") {
      query = query.eq("pickup_status", "Completed");
    }

    if (workFilter === "Issues Only") {
      query = query.eq("pickup_status", "Issue");
    }

    if (pickupStatusFilter !== "All") {
      query = query.eq("pickup_status", pickupStatusFilter);
    }

    if (supportFilter !== "All") {
      query = query.eq("support_status", supportFilter);
    }

    if (campaignerFilter !== "All") {
      query = query.eq("campaigner_id", campaignerFilter);
    }

    const cleanSearch = search.trim().replace(/,/g, " ");

    if (cleanSearch) {
      query = query.or(
        [
          `voter_reg_no.ilike.%${cleanSearch}%`,
          `voter_number.ilike.%${cleanSearch}%`,
          `full_name.ilike.%${cleanSearch}%`,
          `first_name.ilike.%${cleanSearch}%`,
          `middle_name.ilike.%${cleanSearch}%`,
          `last_name.ilike.%${cleanSearch}%`,
          `contact_no.ilike.%${cleanSearch}%`,
          `phone.ilike.%${cleanSearch}%`,
          `street_name.ilike.%${cleanSearch}%`,
          `address.ilike.%${cleanSearch}%`,
          `polling_area.ilike.%${cleanSearch}%`,
          `polling_station.ilike.%${cleanSearch}%`,
          `zone.ilike.%${cleanSearch}%`,
        ].join(",")
      );
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("Voters error:", error);
      setMessage("Error loading voters.");
      setVoters([]);
      setTotalMatching(0);
    } else {
      const normalizedVoters = ((data || []) as RawVoter[]).map(normalizeVoter);

      setVoters(normalizedVoters);
      setTotalMatching(count || 0);
    }

    setListLoading(false);
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

  function getContact(voter: Voter) {
    return voter.contact_no || voter.phone || "";
  }

  function whatsappLink(phone: string | null) {
    if (!phone) return "#";

    const cleanedPhone = phone.replace(/\D/g, "");

    if (cleanedPhone.startsWith("501")) {
      return `https://wa.me/${cleanedPhone}`;
    }

    return `https://wa.me/501${cleanedPhone}`;
  }

  function getStatusStyle(status: string | null) {
    if (status === "Completed") return "bg-green-100 text-green-800";
    if (status === "Issue") return "bg-red-100 text-red-800";
    if (status === "On Route") return "bg-blue-100 text-blue-800";
    if (status === "Picked Up") return "bg-blue-100 text-blue-800";
    if (status === "At Polling Station") return "bg-purple-100 text-purple-800";
    if (status === "Confirmed Pickup") return "bg-amber-100 text-amber-800";
    if (status === "No Pickup Needed") return "bg-slate-100 text-slate-700";

    return "bg-slate-100 text-slate-700";
  }

  function notesPreview(notes: string | null) {
    if (!notes) return "No notes";
    if (notes.length <= 80) return notes;
    return `${notes.slice(0, 80)}...`;
  }

  function applySearch() {
    setCurrentPage(1);
    setSearch(searchInput.trim());
  }

  function resetFilters() {
    setSearchInput("");
    setSearch("");
    setWorkFilter("Active Work");
    setPickupStatusFilter("All");
    setSupportFilter("All");
    setCampaignerFilter("All");
    setCurrentPage(1);
  }

  async function updatePickupStatus(voter: Voter, status: string) {
    setUpdatingId(voter.id);
    setMessage("");

    const { error } = await supabase.rpc("update_voter_pickup_status", {
      p_voter_id: voter.id,
      p_pickup_status: status,
    });

    if (error) {
      console.error("Pickup update error:", error);
      setMessage(error.message || "Error updating pickup status.");
      setUpdatingId(null);
      return;
    }

    await loadVoters();
    await loadStats();

    setUpdatingId(null);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 p-4">
        <div className="mx-auto max-w-md rounded-2xl bg-white p-6 text-center shadow">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
            Team Rigo
          </p>

          <h1 className="mt-3 text-2xl font-bold text-slate-900">
            Loading work queue...
          </h1>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 pb-28">
      <div className="sticky top-0 z-40 border-b border-slate-200 bg-white px-4 py-4 shadow-sm">
        <div className="mx-auto max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
            Team Rigo
          </p>

          <div className="mt-1 flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                Field Queue
              </h1>

              {profile && (
                <p className="mt-1 text-xs text-slate-500">
                  {profile.full_name} · {profile.role} ·{" "}
                  {profile.zone || "No zone"}
                </p>
              )}
            </div>

            <button
              onClick={() => {
                loadVoters();
                loadStats();
              }}
              className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-5">
        {message && (
          <div className="mb-4 rounded-xl bg-blue-50 p-4 text-sm font-medium text-blue-900">
            {message}
          </div>
        )}

        <div className="mb-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white p-4 shadow">
            <p className="text-xs text-slate-500">Active Work</p>
            <h2 className="mt-1 text-3xl font-bold text-blue-700">
              {stats.activeWork}
            </h2>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow">
            <p className="text-xs text-slate-500">Issues</p>
            <h2 className="mt-1 text-3xl font-bold text-red-700">
              {stats.issues}
            </h2>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow">
            <p className="text-xs text-slate-500">Pickup Needed</p>
            <h2 className="mt-1 text-3xl font-bold text-amber-700">
              {stats.pickupNeeded}
            </h2>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow">
            <p className="text-xs text-slate-500">Completed</p>
            <h2 className="mt-1 text-3xl font-bold text-green-700">
              {stats.completed}
            </h2>
          </div>
        </div>

        <section className="mb-5 rounded-2xl bg-white p-4 shadow">
          <label className="text-sm font-medium text-slate-700">Search</label>

          <div className="mt-2 flex gap-2">
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") applySearch();
              }}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base text-slate-900 outline-none focus:border-blue-700"
              placeholder="Name, reg no., phone, street..."
            />

            <button
              onClick={applySearch}
              className="rounded-xl bg-blue-700 px-4 py-3 text-sm font-semibold text-white"
            >
              Go
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600">
                View
              </label>

              <select
                value={workFilter}
                onChange={(event) => {
                  setWorkFilter(event.target.value);
                  setCurrentPage(1);
                }}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 text-sm text-slate-900"
              >
                <option>Active Work</option>
                <option>All Work</option>
                <option>Completed Only</option>
                <option>Issues Only</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-600">
                Pickup
              </label>

              <select
                value={pickupStatusFilter}
                onChange={(event) => {
                  setPickupStatusFilter(event.target.value);
                  setCurrentPage(1);
                }}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 text-sm text-slate-900"
              >
                <option>All</option>
                {pickupStatuses.map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-600">
                Support
              </label>

              <select
                value={supportFilter}
                onChange={(event) => {
                  setSupportFilter(event.target.value);
                  setCurrentPage(1);
                }}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 text-sm text-slate-900"
              >
                {supportStatuses.map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
            </div>

            {canFilterByCampaigner && (
              <div>
                <label className="text-xs font-medium text-slate-600">
                  Campaigner
                </label>

                <select
                  value={campaignerFilter}
                  onChange={(event) => {
                    setCampaignerFilter(event.target.value);
                    setCurrentPage(1);
                  }}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 text-sm text-slate-900"
                >
                  <option value="All">All</option>

                  {visibleCampaigners.map((campaigner) => (
                    <option key={campaigner.id} value={campaigner.id}>
                      {campaigner.full_name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <button
            onClick={resetFilters}
            className="mt-4 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700"
          >
            Reset Filters
          </button>
        </section>

        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-medium text-slate-600">
            Page {currentPage} of {totalPages}
          </p>

          {listLoading && (
            <p className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-600">
              Loading...
            </p>
          )}
        </div>

        <section className="space-y-4">
          {voters.map((voter) => {
            const contact = getContact(voter);

            return (
              <div
                key={voter.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Reg No. {getRegNo(voter)}
                    </p>

                    <h2 className="mt-1 text-xl font-bold text-slate-900">
                      {getDisplayName(voter)}
                    </h2>

                    <p className="mt-1 text-sm text-slate-600">
                      {voter.street_name || voter.address || "No street listed"}
                    </p>
                  </div>

                  {voter.voted ? (
                    <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-800">
                      Voted
                    </span>
                  ) : (
                    <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-800">
                      Not Voted
                    </span>
                  )}
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">Zone</p>
                    <p className="font-semibold text-slate-900">
                      {voter.zone || "No zone"}
                    </p>
                  </div>

                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">Polling Area</p>
                    <p className="font-semibold text-slate-900">
                      {voter.polling_area ||
                        voter.polling_station ||
                        "Not listed"}
                    </p>
                  </div>

                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">Support</p>
                    <p className="font-semibold text-slate-900">
                      {voter.support_status || "Unknown"}
                    </p>
                  </div>

                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">Campaigner</p>
                    <p className="font-semibold text-slate-900">
                      {voter.campaigners?.full_name || "Unassigned"}
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <label className="text-sm font-semibold text-slate-700">
                    Pickup Status
                  </label>

                  <select
                    value={voter.pickup_status || "Not Contacted"}
                    disabled={updatingId === voter.id}
                    onChange={(event) =>
                      updatePickupStatus(voter, event.target.value)
                    }
                    className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-4 text-base font-semibold text-slate-900 outline-none focus:border-blue-700 disabled:bg-slate-100"
                  >
                    {pickupStatuses.map((status) => (
                      <option key={status}>{status}</option>
                    ))}
                  </select>

                  <span
                    className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStatusStyle(
                      voter.pickup_status
                    )}`}
                  >
                    {voter.pickup_status || "Not Contacted"}
                  </span>
                </div>

                {voter.notes && (
                  <div className="mt-4 rounded-xl bg-yellow-50 p-3 text-sm text-yellow-900">
                    <p className="font-semibold">Notes</p>
                    <p className="mt-1">{notesPreview(voter.notes)}</p>
                  </div>
                )}

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <a
                    href={contact ? `tel:${contact}` : "#"}
                    className="rounded-xl bg-blue-700 px-4 py-4 text-center font-bold text-white"
                  >
                    Call
                  </a>

                  <a
                    href={whatsappLink(contact)}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl bg-green-600 px-4 py-4 text-center font-bold text-white"
                  >
                    WhatsApp
                  </a>
                </div>
              </div>
            );
          })}

          {voters.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
              No voters found.
            </div>
          )}
        </section>

        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-4 text-sm font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Previous
          </button>

          <button
            disabled={currentPage >= totalPages}
            onClick={() =>
              setCurrentPage((page) => Math.min(totalPages, page + 1))
            }
            className="flex-1 rounded-xl bg-blue-700 px-4 py-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-blue-300"
          >
            Next
          </button>
        </div>
      </div>
    </main>
  );
}