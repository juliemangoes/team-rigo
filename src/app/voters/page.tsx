"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

const PAGE_SIZE = 50;

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
  email: string | null;
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
  reg_date: string | null;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  full_name: string;
  dob: string | null;
  age: number | null;
  vocation: string | null;
  contact_no: string | null;
  phone: string | null;
  street_name: string | null;
  address: string | null;
  zone: string | null;
  polling_area: string | null;
  polling_station: string | null;
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

const voterSelect = `
  id,
  voter_reg_no,
  voter_number,
  reg_date,
  first_name,
  middle_name,
  last_name,
  full_name,
  dob,
  age,
  vocation,
  contact_no,
  phone,
  street_name,
  address,
  zone,
  polling_area,
  polling_station,
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

const supportStatuses = [
  "Unknown",
  "Confirmed Supporter",
  "Leaning Supporter",
  "Undecided",
  "Not Supporting",
  "Do Not Contact",
];

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

function normalizeVoter(item: RawVoter): Voter {
  return {
    ...item,
    campaigners: Array.isArray(item.campaigners)
      ? item.campaigners[0] || null
      : item.campaigners || null,
  };
}

export default function VotersPage() {
  const [profile, setProfile] = useState<TeamProfile | null>(null);
  const [campaigners, setCampaigners] = useState<Campaigner[]>([]);
  const [voters, setVoters] = useState<Voter[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadingVoters, setLoadingVoters] = useState(false);
  const [message, setMessage] = useState("");

  const [search, setSearch] = useState("");
  const [zoneFilter, setZoneFilter] = useState("All");
  const [pollingAreaFilter, setPollingAreaFilter] = useState("All");
  const [supportFilter, setSupportFilter] = useState("All");
  const [campaignerFilter, setCampaignerFilter] = useState("All");
  const [pickupFilter, setPickupFilter] = useState("All");

  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkCampaignerId, setBulkCampaignerId] = useState("");
  const [bulkSupportStatus, setBulkSupportStatus] = useState("");

  const [manageVoter, setManageVoter] = useState<Voter | null>(null);
  const [manageContact, setManageContact] = useState("");
  const [manageNotes, setManageNotes] = useState("");
  const [managePickupStatus, setManagePickupStatus] = useState("");

  const canAccess =
    profile?.role === "Campaign Manager" || profile?.role === "Zone Leader";

  const canManage = profile?.role === "Campaign Manager";

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (profile && canAccess) {
      loadVoters();
    }
  }, [
    profile,
    canAccess,
    page,
    search,
    zoneFilter,
    pollingAreaFilter,
    supportFilter,
    campaignerFilter,
    pickupFilter,
  ]);

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
      .select("id, full_name, email, phone, zone, role")
      .order("full_name", { ascending: true });

    if (campaignerError) {
      console.error("Campaigners error:", campaignerError);
      setCampaigners([]);
    } else {
      setCampaigners(campaignerData || []);
    }

    setLoading(false);
  }

  async function loadVoters() {
    if (!profile) return;

    setLoadingVoters(true);
    setMessage("");

    const cleanSearch = search.trim().replace(/,/g, " ");

    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from("voters")
      .select(voterSelect, { count: "exact" })
      .order("last_name", { ascending: true, nullsFirst: false })
      .order("first_name", { ascending: true, nullsFirst: false })
      .range(from, to);

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
          `zone.ilike.%${cleanSearch}%`,
        ].join(",")
      );
    }

    if (zoneFilter !== "All") {
      query = query.eq("zone", zoneFilter);
    }

    if (pollingAreaFilter !== "All") {
      query = query.eq("polling_area", pollingAreaFilter);
    }

    if (supportFilter !== "All") {
      query = query.eq("support_status", supportFilter);
    }

    if (campaignerFilter !== "All") {
      if (campaignerFilter === "Unassigned") {
        query = query.is("campaigner_id", null);
      } else {
        query = query.eq("campaigner_id", campaignerFilter);
      }
    }

    if (pickupFilter !== "All") {
      if (pickupFilter === "Needed") {
        query = query.eq("pickup_needed", true);
      }

      if (pickupFilter === "Not Needed") {
        query = query.eq("pickup_needed", false);
      }
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("Voters load error:", error);
      setMessage(error.message || "Error loading voters.");
      setVoters([]);
      setTotalCount(0);
      setLoadingVoters(false);
      return;
    }

    const normalized = ((data || []) as RawVoter[]).map(normalizeVoter);

    setVoters(normalized);
    setTotalCount(count || 0);
    setSelectedIds([]);
    setLoadingVoters(false);
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

  function formatTime(value: string | null) {
    if (!value) return "";

    return new Date(value).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function resetToFirstPage() {
    if (page !== 1) {
      setPage(1);
    }
  }

  function clearFilters() {
    setSearch("");
    setZoneFilter("All");
    setPollingAreaFilter("All");
    setSupportFilter("All");
    setCampaignerFilter("All");
    setPickupFilter("All");
    setPage(1);
  }

  const zoneOptions = useMemo(() => {
    const zones = new Set<string>();

    campaigners.forEach((person) => {
      if (person.zone) zones.add(person.zone);
    });

    voters.forEach((voter) => {
      if (voter.zone) zones.add(voter.zone);
    });

    if (profile?.role === "Zone Leader" && profile.zone) {
      zones.add(profile.zone);
    }

    return Array.from(zones).sort();
  }, [campaigners, voters, profile]);

  const pageStats = useMemo(() => {
    return {
      loaded: voters.length,
      assigned: voters.filter((voter) => voter.campaigner_id).length,
      unassigned: voters.filter((voter) => !voter.campaigner_id).length,
      confirmed: voters.filter(
        (voter) => voter.support_status === "Confirmed Supporter"
      ).length,
      pickupNeeded: voters.filter((voter) => voter.pickup_needed).length,
      voted: voters.filter((voter) => voter.voted).length,
    };
  }, [voters]);

  function toggleSelected(id: string) {
    setSelectedIds((current) => {
      if (current.includes(id)) {
        return current.filter((item) => item !== id);
      }

      return [...current, id];
    });
  }

  function toggleSelectVisible() {
    if (voters.length === 0) return;

    if (selectedIds.length === voters.length) {
      setSelectedIds([]);
      return;
    }

    setSelectedIds(voters.map((voter) => voter.id));
  }

  async function updateVoter(voterId: string, payload: Partial<Voter>) {
    if (!canManage) {
      alert("Only the Campaign Manager can update voter records.");
      return;
    }

    setMessage("");

    const { error } = await supabase
      .from("voters")
      .update(payload)
      .eq("id", voterId);

    if (error) {
      console.error("Update voter error:", error);
      setMessage(error.message || "Error updating voter.");
      return;
    }

    await loadVoters();
  }

  async function bulkUpdate(payload: Partial<Voter>) {
    if (!canManage) {
      alert("Only the Campaign Manager can use bulk actions.");
      return;
    }

    if (selectedIds.length === 0) {
      alert("Select at least one voter first.");
      return;
    }

    const confirmed = confirm(`Update ${selectedIds.length} selected voter(s)?`);

    if (!confirmed) return;

    setMessage("");

    const { error } = await supabase
      .from("voters")
      .update(payload)
      .in("id", selectedIds);

    if (error) {
      console.error("Bulk update error:", error);
      setMessage(error.message || "Error applying bulk update.");
      return;
    }

    setMessage(`${selectedIds.length} voter(s) updated.`);
    setSelectedIds([]);
    setBulkCampaignerId("");
    setBulkSupportStatus("");

    await loadVoters();
  }

  function openManageModal(voter: Voter) {
    setManageVoter(voter);
    setManageContact(voter.contact_no || voter.phone || "");
    setManageNotes(voter.notes || "");
    setManagePickupStatus(voter.pickup_status || "Not Contacted");
  }

  async function saveManageModal() {
    if (!manageVoter) return;

    await updateVoter(manageVoter.id, {
      contact_no: manageContact.trim() || null,
      phone: manageContact.trim() || null,
      notes: manageNotes.trim() || null,
      pickup_status: managePickupStatus || "Not Contacted",
    });

    setManageVoter(null);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 p-6">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-2xl bg-white p-8 text-center shadow">
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
              Team Rigo
            </p>

            <h1 className="mt-3 text-2xl font-bold text-slate-900">
              Loading voters...
            </h1>
          </div>
        </div>
      </main>
    );
  }

  if (!canAccess) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <div className="w-full max-w-xl rounded-2xl bg-white p-8 text-center shadow">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
            Team Rigo
          </p>

          <h1 className="mt-3 text-2xl font-bold text-slate-900">
            Voter Access Only
          </h1>

          <p className="mt-3 text-slate-600">
            This page is restricted to the Campaign Manager and Zone Leaders.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
              Team Rigo
            </p>

            <h1 className="mt-2 text-3xl font-bold text-slate-900">
              Voters
            </h1>

            <p className="mt-2 text-slate-600">
              {profile?.role === "Zone Leader"
                ? `Zone Leader view. You are seeing voters allowed for your assigned zone: ${
                    profile.zone || "No zone assigned"
                  }.`
                : "Manage voter assignments, support status, and pickup details."}
            </p>
          </div>

          <button
            onClick={loadVoters}
            className="rounded-xl bg-blue-700 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-800"
          >
            Refresh
          </button>
        </div>

        {message && (
          <div className="mb-6 rounded-xl bg-blue-50 p-4 text-sm font-medium text-blue-900">
            {message}
          </div>
        )}

        {!canManage && (
          <div className="mb-6 rounded-xl bg-amber-50 p-4 text-sm font-medium text-amber-900">
            View-only access. Only the Campaign Manager can update assignments
            or voter records.
          </div>
        )}

        <div className="mb-6 grid gap-4 md:grid-cols-6">
          <div className="rounded-2xl bg-white p-5 shadow">
            <p className="text-sm text-slate-500">Total Found</p>
            <h2 className="mt-2 text-3xl font-bold text-slate-900">
              {totalCount}
            </h2>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow">
            <p className="text-sm text-slate-500">Loaded Page</p>
            <h2 className="mt-2 text-3xl font-bold text-blue-700">
              {pageStats.loaded}
            </h2>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow">
            <p className="text-sm text-slate-500">Assigned</p>
            <h2 className="mt-2 text-3xl font-bold text-green-700">
              {pageStats.assigned}
            </h2>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow">
            <p className="text-sm text-slate-500">Unassigned</p>
            <h2 className="mt-2 text-3xl font-bold text-red-700">
              {pageStats.unassigned}
            </h2>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow">
            <p className="text-sm text-slate-500">Pickup Needed</p>
            <h2 className="mt-2 text-3xl font-bold text-amber-700">
              {pageStats.pickupNeeded}
            </h2>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow">
            <p className="text-sm text-slate-500">Voted</p>
            <h2 className="mt-2 text-3xl font-bold text-purple-700">
              {pageStats.voted}
            </h2>
          </div>
        </div>

        <section className="mb-6 rounded-2xl bg-white p-6 shadow">
          <div className="grid gap-4 md:grid-cols-6">
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-slate-700">
                Search
              </label>

              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  resetToFirstPage();
                }}
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-700"
                placeholder="Name, reg no., phone, street..."
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">
                Zone
              </label>

              <select
                value={zoneFilter}
                onChange={(event) => {
                  setZoneFilter(event.target.value);
                  resetToFirstPage();
                }}
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-700"
              >
                <option>All</option>
                {zoneOptions.map((zone) => (
                  <option key={zone}>{zone}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">
                Polling Area
              </label>

              <select
                value={pollingAreaFilter}
                onChange={(event) => {
                  setPollingAreaFilter(event.target.value);
                  resetToFirstPage();
                }}
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-700"
              >
                <option>All</option>
                <option>39</option>
                <option>40</option>
                <option>41</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">
                Support
              </label>

              <select
                value={supportFilter}
                onChange={(event) => {
                  setSupportFilter(event.target.value);
                  resetToFirstPage();
                }}
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-700"
              >
                <option>All</option>
                {supportStatuses.map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">
                Pickup
              </label>

              <select
                value={pickupFilter}
                onChange={(event) => {
                  setPickupFilter(event.target.value);
                  resetToFirstPage();
                }}
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-700"
              >
                <option>All</option>
                <option>Needed</option>
                <option>Not Needed</option>
              </select>
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div>
              <label className="text-sm font-medium text-slate-700">
                Campaigner
              </label>

              <select
                value={campaignerFilter}
                onChange={(event) => {
                  setCampaignerFilter(event.target.value);
                  resetToFirstPage();
                }}
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-700"
              >
                <option value="All">All</option>
                <option value="Unassigned">Unassigned</option>
                {campaigners.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.full_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={clearFilters}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 font-semibold text-slate-700 hover:bg-slate-50"
              >
                Clear Filters
              </button>
            </div>

            <div className="flex items-end">
              <button
                onClick={loadVoters}
                disabled={loadingVoters}
                className="w-full rounded-xl bg-blue-700 px-4 py-3 font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-blue-300"
              >
                {loadingVoters ? "Loading..." : "Apply / Refresh"}
              </button>
            </div>
          </div>
        </section>

        {canManage && (
          <section className="mb-6 rounded-2xl bg-white p-6 shadow">
            <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Bulk Actions
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Selected voters: {selectedIds.length}
                </p>
              </div>

              <button
                onClick={toggleSelectVisible}
                className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                {selectedIds.length === voters.length && voters.length > 0
                  ? "Unselect Visible"
                  : "Select Visible"}
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <select
                value={bulkCampaignerId}
                onChange={(event) => setBulkCampaignerId(event.target.value)}
                className="rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-700"
              >
                <option value="">Assign Campaigner</option>
                {campaigners.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.full_name}
                  </option>
                ))}
              </select>

              <button
                onClick={() => {
                  if (!bulkCampaignerId) {
                    alert("Choose a campaigner first.");
                    return;
                  }

                  bulkUpdate({
                    campaigner_id: bulkCampaignerId,
                  });
                }}
                className="rounded-xl bg-blue-700 px-4 py-3 font-semibold text-white hover:bg-blue-800"
              >
                Apply Campaigner
              </button>

              <select
                value={bulkSupportStatus}
                onChange={(event) => setBulkSupportStatus(event.target.value)}
                className="rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-700"
              >
                <option value="">Set Support Status</option>
                {supportStatuses.map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>

              <button
                onClick={() => {
                  if (!bulkSupportStatus) {
                    alert("Choose a support status first.");
                    return;
                  }

                  bulkUpdate({
                    support_status: bulkSupportStatus,
                  });
                }}
                className="rounded-xl bg-green-700 px-4 py-3 font-semibold text-white hover:bg-green-800"
              >
                Apply Support
              </button>

              <button
                onClick={() =>
                  bulkUpdate({
                    pickup_needed: true,
                  })
                }
                className="rounded-xl bg-amber-600 px-4 py-3 font-semibold text-white hover:bg-amber-700"
              >
                Mark Pickup Needed
              </button>

              <button
                onClick={() =>
                  bulkUpdate({
                    pickup_needed: false,
                    pickup_status: "No Pickup Needed",
                  })
                }
                className="rounded-xl border border-slate-300 px-4 py-3 font-semibold text-slate-700 hover:bg-slate-50"
              >
                No Pickup Needed
              </button>
            </div>
          </section>
        )}

        <section className="rounded-2xl bg-white shadow">
          <div className="flex flex-col gap-3 border-b p-5 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Voter Register
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Page {page} of {totalPages} · Showing {voters.length} of{" "}
                {totalCount}
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>

              <button
                onClick={() =>
                  setPage((current) => Math.min(totalPages, current + 1))
                }
                disabled={page >= totalPages}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1250px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b bg-slate-50 text-slate-600">
                  {canManage && <th className="p-3">Select</th>}
                  <th className="p-3">Reg No.</th>
                  <th className="p-3">Name</th>
                  <th className="p-3">Age / DOB</th>
                  <th className="p-3">Contact</th>
                  <th className="p-3">Street</th>
                  <th className="p-3">Zone</th>
                  <th className="p-3">Polling</th>
                  <th className="p-3">Support</th>
                  <th className="p-3">Campaigner</th>
                  <th className="p-3">Pickup</th>
                  <th className="p-3">Voted</th>
                  {canManage && <th className="p-3">Manage</th>}
                </tr>
              </thead>

              <tbody>
                {voters.map((voter) => (
                  <tr key={voter.id} className="border-b align-top">
                    {canManage && (
                      <td className="p-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(voter.id)}
                          onChange={() => toggleSelected(voter.id)}
                          className="h-5 w-5"
                        />
                      </td>
                    )}

                    <td className="p-3 font-bold text-slate-900">
                      {getRegNo(voter)}
                    </td>

                    <td className="p-3">
                      <p className="font-bold text-slate-900">
                        {getDisplayName(voter)}
                      </p>
                      <p className="text-xs text-slate-500">
                        {voter.vocation || "No vocation"}
                      </p>
                    </td>

                    <td className="p-3 text-slate-700">
                      <p>Age: {voter.age ?? "No age"}</p>
                      <p className="text-xs text-slate-500">
                        DOB: {voter.dob || "No DOB"}
                      </p>
                    </td>

                    <td className="p-3 text-slate-700">
                      {voter.contact_no || voter.phone || "No contact"}
                    </td>

                    <td className="p-3 text-slate-700">
                      {voter.street_name || voter.address || "No street"}
                    </td>

                    <td className="p-3 text-slate-700">
                      {voter.zone || "No zone"}
                    </td>

                    <td className="p-3 text-slate-700">
                      {voter.polling_area ||
                        voter.polling_station ||
                        "No polling area"}
                    </td>

                    <td className="p-3">
                      {canManage ? (
                        <select
                          value={voter.support_status || "Unknown"}
                          onChange={(event) =>
                            updateVoter(voter.id, {
                              support_status: event.target.value,
                            })
                          }
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
                        >
                          {supportStatuses.map((status) => (
                            <option key={status}>{status}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                          {voter.support_status || "Unknown"}
                        </span>
                      )}
                    </td>

                    <td className="p-3">
                      {canManage ? (
                        <select
                          value={voter.campaigner_id || ""}
                          onChange={(event) =>
                            updateVoter(voter.id, {
                              campaigner_id: event.target.value || null,
                            })
                          }
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
                        >
                          <option value="">Unassigned</option>
                          {campaigners.map((person) => (
                            <option key={person.id} value={person.id}>
                              {person.full_name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-slate-700">
                          {voter.campaigners?.full_name || "Unassigned"}
                        </span>
                      )}
                    </td>

                    <td className="p-3">
                      {canManage ? (
                        <label className="flex items-center gap-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={voter.pickup_needed}
                            onChange={(event) =>
                              updateVoter(voter.id, {
                                pickup_needed: event.target.checked,
                                pickup_status: event.target.checked
                                  ? voter.pickup_status || "Not Contacted"
                                  : "No Pickup Needed",
                              })
                            }
                            className="h-5 w-5"
                          />
                          Needed
                        </label>
                      ) : (
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold ${
                            voter.pickup_needed
                              ? "bg-amber-100 text-amber-800"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {voter.pickup_needed ? "Needed" : "Not Needed"}
                        </span>
                      )}

                      <p className="mt-2 text-xs text-slate-500">
                        {voter.pickup_status || "Not Contacted"}
                      </p>
                    </td>

                    <td className="p-3">
                      {voter.voted ? (
                        <div>
                          <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-800">
                            Voted
                          </span>
                          {voter.voted_at && (
                            <p className="mt-2 text-xs text-green-700">
                              {formatTime(voter.voted_at)}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-800">
                          Not Voted
                        </span>
                      )}
                    </td>

                    {canManage && (
                      <td className="p-3">
                        <button
                          onClick={() => openManageModal(voter)}
                          className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800"
                        >
                          Manage
                        </button>
                      </td>
                    )}
                  </tr>
                ))}

                {voters.length === 0 && (
                  <tr>
                    <td
                      colSpan={canManage ? 13 : 11}
                      className="p-10 text-center text-slate-500"
                    >
                      No voters found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {manageVoter && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
              <div className="mb-5">
                <h2 className="text-2xl font-bold text-slate-900">
                  Manage Voter
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {getDisplayName(manageVoter)} · {getRegNo(manageVoter)}
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-slate-700">
                    Contact Number
                  </label>
                  <input
                    value={manageContact}
                    onChange={(event) => setManageContact(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-700"
                    placeholder="Contact number"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700">
                    Pickup Status
                  </label>
                  <select
                    value={managePickupStatus}
                    onChange={(event) =>
                      setManagePickupStatus(event.target.value)
                    }
                    className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-700"
                  >
                    {pickupStatuses.map((status) => (
                      <option key={status}>{status}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700">
                    Notes
                  </label>
                  <textarea
                    value={manageNotes}
                    onChange={(event) => setManageNotes(event.target.value)}
                    className="mt-2 min-h-28 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-700"
                    placeholder="Notes"
                  />
                </div>
              </div>

              <div className="mt-6 grid gap-3 md:grid-cols-2">
                <button
                  onClick={() => setManageVoter(null)}
                  className="rounded-xl border border-slate-300 px-4 py-3 font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  onClick={saveManageModal}
                  className="rounded-xl bg-blue-700 px-4 py-3 font-semibold text-white hover:bg-blue-800"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
