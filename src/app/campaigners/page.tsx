"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

const PAGE_SIZE = 60;

type TeamProfile = {
  id: string;
  full_name: string;
  email: string | null;
  role: string | null;
  zone: string | null;
};

type CampaignZone = {
  id: string;
  name: string;
  description: string | null;
  display_order: number | null;
};

type SupportStatusOption = {
  id: string;
  value: string;
  label: string;
  description: string | null;
  color: string | null;
  display_order: number | null;
  is_active: boolean | null;
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

type FieldStats = {
  loaded: number;
  total: number;
  confirmed: number;
  leaning: number;
  pickupNeeded: number;
  issues: number;
  onRoute: number;
  completed: number;
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
  pickup_priority,
  voted,
  voted_at,
  notes,
  campaigners:campaigner_id (
    id,
    full_name
  )
`;

const defaultSupportStatuses = [
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

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value || 0);
}

function compactContact(value: string | null) {
  return value?.trim() || "";
}

function getWhatsAppLink(phone: string) {
  const digits = phone.replace(/\D/g, "");

  if (!digits) return "";

  const normalized = digits.length === 7 ? `501${digits}` : digits;

  return `https://wa.me/${normalized}`;
}

function supportPillClass(color: string | null | undefined, value?: string | null) {
  if (color === "green" || value === "Confirmed Supporter") {
    return "bg-green-100 text-green-800";
  }

  if (color === "blue") return "bg-sky-100 text-sky-800";

  if (color === "purple" || value === "Leaning Supporter") {
    return "bg-purple-100 text-purple-800";
  }

  if (color === "amber" || value === "Undecided") {
    return "bg-amber-100 text-amber-800";
  }

  if (color === "orange") return "bg-orange-100 text-orange-800";

  if (
    color === "red" ||
    value === "Not Supporting" ||
    value === "Do Not Contact"
  ) {
    return "bg-red-100 text-red-800";
  }

  return "bg-slate-100 text-slate-700";
}

function pickupPillClass(value: string | null) {
  if (value === "Issue") return "bg-red-100 text-red-800";
  if (value === "Completed") return "bg-green-100 text-green-800";
  if (value === "At Polling Station") return "bg-sky-100 text-sky-800";
  if (value === "Picked Up" || value === "On Route") {
    return "bg-purple-100 text-purple-800";
  }
  if (value === "Confirmed Pickup") return "bg-amber-100 text-amber-800";
  if (value === "No Pickup Needed") return "bg-slate-100 text-slate-600";

  return "bg-orange-100 text-orange-800";
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-xs font-black uppercase tracking-wide text-slate-500">
      {children}
    </label>
  );
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
  tone?: "blue" | "green" | "red" | "amber" | "purple" | "orange" | "slate";
}) {
  const color =
    tone === "blue"
      ? "border-sky-100 bg-sky-50 text-sky-700"
      : tone === "green"
      ? "border-green-100 bg-green-50 text-green-700"
      : tone === "red"
      ? "border-red-100 bg-red-50 text-red-700"
      : tone === "amber"
      ? "border-amber-100 bg-amber-50 text-amber-700"
      : tone === "purple"
      ? "border-purple-100 bg-purple-50 text-purple-700"
      : tone === "orange"
      ? "border-orange-100 bg-orange-50 text-orange-700"
      : "border-slate-200 bg-white text-slate-900";

  return (
    <div className={`rounded-3xl border p-4 shadow-sm ${color}`}>
      <p className="text-xs font-black uppercase tracking-wide opacity-65">
        {label}
      </p>
      <p className="mt-2 text-2xl font-black tracking-tight">{value}</p>
      {detail && <p className="mt-1 text-xs font-semibold opacity-70">{detail}</p>}
    </div>
  );
}

function SelectField({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm outline-none transition focus:border-sky-700 focus:ring-4 focus:ring-sky-100"
    >
      {children}
    </select>
  );
}

export default function CampaignersPage() {
  const [profile, setProfile] = useState<TeamProfile | null>(null);
  const [campaignZones, setCampaignZones] = useState<CampaignZone[]>([]);
  const [supportStatusOptions, setSupportStatusOptions] = useState<
    SupportStatusOption[]
  >([]);
  const [voters, setVoters] = useState<Voter[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadingVoters, setLoadingVoters] = useState(false);
  const [message, setMessage] = useState("");

  const [search, setSearch] = useState("");
  const [zoneFilter, setZoneFilter] = useState("All");
  const [supportFilter, setSupportFilter] = useState("All");
  const [pickupFilter, setPickupFilter] = useState("All");
  const [votedFilter, setVotedFilter] = useState("Not Voted");
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [fieldStats, setFieldStats] = useState<FieldStats>({
    loaded: 0,
    total: 0,
    confirmed: 0,
    leaning: 0,
    pickupNeeded: 0,
    issues: 0,
    onRoute: 0,
    completed: 0,
    notVoted: 0,
  });

  const canAccess =
    profile?.role === "Campaign Manager" ||
    profile?.role === "Zone Leader" ||
    profile?.role === "Campaigner" ||
    profile?.role === "Driver";

  const canManagePickup =
    profile?.role === "Campaign Manager" ||
    profile?.role === "Zone Leader" ||
    profile?.role === "Campaigner" ||
    profile?.role === "Driver";

  const isDriver = profile?.role === "Driver";
  const isCampaigner = profile?.role === "Campaigner";
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
    supportFilter,
    pickupFilter,
    votedFilter,
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

    const [zoneResult, supportResult] = await Promise.all([
      supabase
        .from("campaign_zones")
        .select("id, name, description, display_order")
        .order("display_order", { ascending: true })
        .order("name", { ascending: true }),

      supabase
        .from("support_status_options")
        .select("id, value, label, description, color, display_order, is_active")
        .eq("is_active", true)
        .order("display_order", { ascending: true })
        .order("label", { ascending: true }),
    ]);

    if (zoneResult.error) {
      console.error("Zones error:", zoneResult.error);
      setCampaignZones([]);
    } else {
      setCampaignZones(zoneResult.data || []);
    }

    if (supportResult.error) {
      console.error("Support status options error:", supportResult.error);
      setSupportStatusOptions([]);
    } else {
      setSupportStatusOptions(supportResult.data || []);
    }

    setLoading(false);
  }

  function applyFieldFilters(query: any) {
    const searchTokens = search
      .trim()
      .replace(/[,%()]/g, " ")
      .split(/\s+/)
      .map((token) => token.trim())
      .filter(Boolean)
      .slice(0, 6);

    searchTokens.forEach((token) => {
      query = query.or(
        [
          `voter_reg_no.ilike.%${token}%`,
          `voter_number.ilike.%${token}%`,
          `full_name.ilike.%${token}%`,
          `first_name.ilike.%${token}%`,
          `middle_name.ilike.%${token}%`,
          `last_name.ilike.%${token}%`,
          `contact_no.ilike.%${token}%`,
          `phone.ilike.%${token}%`,
          `street_name.ilike.%${token}%`,
          `address.ilike.%${token}%`,
          `polling_area.ilike.%${token}%`,
          `zone.ilike.%${token}%`,
        ].join(",")
      );
    });

    if (isDriver) {
      query = query.eq("pickup_needed", true);
    }

    if (zoneFilter !== "All") {
      query = query.eq("zone", zoneFilter);
    }

    if (supportFilter !== "All") {
      query = query.eq("support_status", supportFilter);
    }

    if (pickupFilter !== "All") {
      if (pickupFilter === "Needed") query = query.eq("pickup_needed", true);
      else if (pickupFilter === "Not Needed") query = query.eq("pickup_needed", false);
      else query = query.eq("pickup_status", pickupFilter);
    }

    if (votedFilter === "Voted") {
      query = query.eq("voted", true);
    }

    if (votedFilter === "Not Voted") {
      query = query.eq("voted", false);
    }

    return query;
  }

  async function getFilteredCount(applyExtraFilter?: (query: any) => any) {
    let query = supabase
      .from("voters")
      .select("id", { count: "exact", head: true });

    query = applyFieldFilters(query);

    if (applyExtraFilter) {
      query = applyExtraFilter(query);
    }

    const { error, count } = await query;

    if (error) throw error;

    return count || 0;
  }

  async function loadFieldStats(loadedCount: number, total: number) {
    try {
      const [
        confirmed,
        leaning,
        pickupNeeded,
        issues,
        onRoute,
        completed,
        notVoted,
      ] = await Promise.all([
        getFilteredCount((query) =>
          query.eq("support_status", "Confirmed Supporter")
        ),
        getFilteredCount((query) =>
          query.eq("support_status", "Leaning Supporter")
        ),
        getFilteredCount((query) => query.eq("pickup_needed", true)),
        getFilteredCount((query) => query.eq("pickup_status", "Issue")),
        getFilteredCount((query) => query.eq("pickup_status", "On Route")),
        getFilteredCount((query) => query.eq("pickup_status", "Completed")),
        getFilteredCount((query) => query.eq("voted", false)),
      ]);

      setFieldStats({
        loaded: loadedCount,
        total,
        confirmed,
        leaning,
        pickupNeeded,
        issues,
        onRoute,
        completed,
        notVoted,
      });
    } catch (error) {
      console.error("Field stats error:", error);
      setFieldStats((current) => ({
        ...current,
        loaded: loadedCount,
        total,
      }));
    }
  }

  async function loadVoters() {
    if (!profile) return;

    setLoadingVoters(true);
    setMessage("");

    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from("voters")
      .select(voterSelect, { count: "exact" })
      .order("pickup_priority", { ascending: true, nullsFirst: false })
      .order("last_name", { ascending: true, nullsFirst: false })
      .range(from, to);

    query = applyFieldFilters(query);

    const { data, error, count } = await query;

    if (error) {
      console.error("Field voters load error:", error);
      setMessage(error.message || "Error loading field voters.");
      setVoters([]);
      setTotalCount(0);
      setFieldStats({
        loaded: 0,
        total: 0,
        confirmed: 0,
        leaning: 0,
        pickupNeeded: 0,
        issues: 0,
        onRoute: 0,
        completed: 0,
        notVoted: 0,
      });
      setLoadingVoters(false);
      return;
    }

    const normalized = ((data || []) as RawVoter[]).map(normalizeVoter);
    const nextTotal = count || 0;

    setVoters(normalized);
    setTotalCount(nextTotal);
    await loadFieldStats(normalized.length, nextTotal);
    setLoadingVoters(false);
  }

  function resetToFirstPage() {
    if (page !== 1) setPage(1);
  }

  function clearFilters() {
    setSearch("");
    setZoneFilter("All");
    setSupportFilter("All");
    setPickupFilter("All");
    setVotedFilter(isDriver ? "Not Voted" : "Not Voted");
    setPage(1);
  }

  const zoneOptions = useMemo(() => {
    const zones = new Set<string>();

    campaignZones.forEach((zone) => {
      if (zone.name) zones.add(zone.name);
    });

    voters.forEach((voter) => {
      if (voter.zone) zones.add(voter.zone);
    });

    if (profile?.zone) zones.add(profile.zone);

    return Array.from(zones).sort();
  }, [campaignZones, voters, profile]);

  const supportStatuses = useMemo(() => {
    const activeOptions = supportStatusOptions
      .filter((item) => item.is_active !== false)
      .map((item) => item.value);

    return activeOptions.length > 0 ? activeOptions : defaultSupportStatuses;
  }, [supportStatusOptions]);

  function getSupportStatusOption(value: string | null) {
    const cleanValue = value || "Unknown";
    return supportStatusOptions.find((item) => item.value === cleanValue);
  }

  function getSupportStatusLabel(value: string | null) {
    const cleanValue = value || "Unknown";
    const option = getSupportStatusOption(cleanValue);

    return option?.label || cleanValue;
  }

  function getSupportPillClass(value: string | null) {
    const cleanValue = value || "Unknown";
    const option = getSupportStatusOption(cleanValue);

    return supportPillClass(option?.color, cleanValue);
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

  async function updatePickupStatus(voterId: string, pickupStatus: string) {
    if (!canManagePickup) {
      alert("This account cannot update pickup status.");
      return;
    }

    setMessage("");

    const { error } = await supabase.rpc("update_voter_pickup_status", {
      p_voter_id: voterId,
      p_pickup_status: pickupStatus,
    });

    if (error) {
      console.error("Pickup status update error:", error);
      setMessage(error.message || "Error updating pickup status.");
      return;
    }

    await loadVoters();
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 p-4 sm:p-6">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-3xl bg-white p-6 text-center shadow-sm">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-sky-700" />
            <h1 className="mt-5 text-xl font-black text-slate-900">
              Loading field view...
            </h1>
          </div>
        </div>
      </main>
    );
  }

  if (!canAccess) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4 sm:p-6">
        <div className="w-full max-w-xl rounded-3xl bg-white p-6 text-center shadow-sm sm:p-8">
          <h1 className="text-2xl font-black text-slate-900">
            Field View Access Restricted
          </h1>
          <p className="mt-3 text-slate-600">
            This page is available to Campaign Managers, Zone Leaders,
            Campaigners, and Drivers.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-slate-100">
      <section className="bg-white px-4 py-5 shadow-sm sm:px-6 sm:py-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-5xl">
                Field View
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-500 sm:text-base">
                {isDriver
                  ? "Driver queue for voters requiring pickup."
                  : isCampaigner
                  ? "Your assigned voters and field follow-up list."
                  : "Monitor campaigner and driver field operations."}
              </p>
            </div>

            <button
              onClick={loadVoters}
              className="w-full rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white hover:bg-slate-800 sm:w-auto"
            >
              {loadingVoters ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {message && (
            <div className="mt-4 rounded-2xl border border-sky-100 bg-sky-50 p-4 text-sm font-bold text-sky-900">
              {message}
            </div>
          )}

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            <SummaryCard
              label="Visible"
              value={formatNumber(fieldStats.total)}
              detail={`Loaded page ${formatNumber(fieldStats.loaded)}`}
              tone="blue"
            />
            <SummaryCard
              label="Confirmed"
              value={formatNumber(fieldStats.confirmed)}
              detail={`${formatNumber(fieldStats.leaning)} leaning`}
              tone="green"
            />
            <SummaryCard
              label="Not Voted"
              value={formatNumber(fieldStats.notVoted)}
              detail="Needs follow-up"
              tone="amber"
            />
            <SummaryCard
              label="Pickup"
              value={formatNumber(fieldStats.pickupNeeded)}
              detail="Needed"
              tone="purple"
            />
            <SummaryCard
              label="On Route"
              value={formatNumber(fieldStats.onRoute)}
              detail="In progress"
              tone="orange"
            />
            <SummaryCard
              label="Issues"
              value={formatNumber(fieldStats.issues)}
              detail={`${formatNumber(fieldStats.completed)} completed`}
              tone={fieldStats.issues > 0 ? "red" : "green"}
            />
          </div>
        </div>
      </section>

      <section className="px-4 py-5 sm:px-6 sm:py-8">
        <div className="mx-auto max-w-7xl">
          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="grid gap-3 lg:grid-cols-[1.5fr_repeat(4,1fr)_auto] lg:items-end">
              <div>
                <FieldLabel>Search</FieldLabel>
                <input
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    resetToFirstPage();
                  }}
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-sky-700 focus:ring-4 focus:ring-sky-100"
                  placeholder="Name, reg no., phone, street..."
                />
              </div>

              <div>
                <FieldLabel>Zone</FieldLabel>
                <SelectField
                  value={zoneFilter}
                  onChange={(value) => {
                    setZoneFilter(value);
                    resetToFirstPage();
                  }}
                >
                  <option>All</option>
                  {zoneOptions.map((zone) => (
                    <option key={zone} value={zone}>
                      {zone}
                    </option>
                  ))}
                </SelectField>
              </div>

              <div>
                <FieldLabel>Support</FieldLabel>
                <SelectField
                  value={supportFilter}
                  onChange={(value) => {
                    setSupportFilter(value);
                    resetToFirstPage();
                  }}
                >
                  <option>All</option>
                  {supportStatuses.map((status) => (
                    <option key={status} value={status}>
                      {getSupportStatusLabel(status)}
                    </option>
                  ))}
                </SelectField>
              </div>

              <div>
                <FieldLabel>Pickup</FieldLabel>
                <SelectField
                  value={pickupFilter}
                  onChange={(value) => {
                    setPickupFilter(value);
                    resetToFirstPage();
                  }}
                >
                  <option>All</option>
                  <option>Needed</option>
                  <option>Not Needed</option>
                  {pickupStatuses.map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </SelectField>
              </div>

              <div>
                <FieldLabel>Voted</FieldLabel>
                <SelectField
                  value={votedFilter}
                  onChange={(value) => {
                    setVotedFilter(value);
                    resetToFirstPage();
                  }}
                >
                  <option>All</option>
                  <option>Not Voted</option>
                  <option>Voted</option>
                </SelectField>
              </div>

              <button
                onClick={clearFilters}
                className="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-50"
              >
                Clear
              </button>
            </div>
          </section>

          <section className="mt-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-black text-slate-950">
                  Field Queue
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Showing {formatNumber(voters.length)} of{" "}
                  {formatNumber(totalCount)} result(s).
                </p>
              </div>

              {loadingVoters && (
                <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-black text-sky-700">
                  Loading...
                </span>
              )}
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {voters.map((voter) => {
                const contact = compactContact(voter.contact_no || voter.phone);
                const whatsapp = contact ? getWhatsAppLink(contact) : "";
                const address = voter.street_name || voter.address || "No street";
                const polling =
                  voter.polling_area || voter.polling_station || "No polling area";

                return (
                  <article
                    key={voter.id}
                    className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                          {getRegNo(voter)}
                        </p>
                        <h3 className="mt-1 break-words text-xl font-black text-slate-950">
                          {getDisplayName(voter)}
                        </h3>
                        <p className="mt-1 text-sm text-slate-500">
                          {address}
                        </p>
                      </div>

                      <span
                        className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${
                          voter.voted
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {voter.voted ? "Voted" : "Not Voted"}
                      </span>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-black ${getSupportPillClass(
                          voter.support_status
                        )}`}
                      >
                        {getSupportStatusLabel(voter.support_status)}
                      </span>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-black ${pickupPillClass(
                          voter.pickup_status
                        )}`}
                      >
                        {voter.pickup_status || "Not Contacted"}
                      </span>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-black ${
                          voter.pickup_needed
                            ? "bg-amber-100 text-amber-800"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {voter.pickup_needed ? "Pickup Needed" : "No Pickup"}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-xs font-black uppercase text-slate-400">
                          Zone
                        </p>
                        <p className="mt-1 font-bold text-slate-800">
                          {voter.zone || "No zone"}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-black uppercase text-slate-400">
                          Polling
                        </p>
                        <p className="mt-1 font-bold text-slate-800">
                          {polling}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-black uppercase text-slate-400">
                          Assigned To
                        </p>
                        <p className="mt-1 font-bold text-slate-800">
                          {voter.campaigners?.full_name || "Unassigned"}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-black uppercase text-slate-400">
                          Contact
                        </p>
                        <p className="mt-1 font-bold text-slate-800">
                          {contact || "No contact"}
                        </p>
                      </div>
                    </div>

                    {voter.notes && (
                      <div className="mt-4 rounded-2xl bg-slate-50 p-3 text-sm font-semibold text-slate-600">
                        {voter.notes}
                      </div>
                    )}

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {contact ? (
                        <>
                          <a
                            href={`tel:${contact}`}
                            className="rounded-2xl bg-slate-950 px-4 py-3 text-center text-sm font-black text-white hover:bg-slate-800"
                          >
                            Call
                          </a>

                          <a
                            href={whatsapp}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-2xl bg-green-600 px-4 py-3 text-center text-sm font-black text-white hover:bg-green-700"
                          >
                            WhatsApp
                          </a>
                        </>
                      ) : (
                        <div className="rounded-2xl bg-slate-100 px-4 py-3 text-center text-sm font-black text-slate-500 sm:col-span-2">
                          No contact number
                        </div>
                      )}
                    </div>

                    {canManagePickup && (
                      <div className="mt-4">
                        <FieldLabel>Pickup Status</FieldLabel>
                        <SelectField
                          value={voter.pickup_status || "Not Contacted"}
                          onChange={(value) => updatePickupStatus(voter.id, value)}
                        >
                          {pickupStatuses.map((status) => (
                            <option key={status}>{status}</option>
                          ))}
                        </SelectField>
                      </div>
                    )}
                  </article>
                );
              })}

              {voters.length === 0 && (
                <div className="rounded-3xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 lg:col-span-2">
                  No field voters found.
                </div>
              )}
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-bold text-slate-500">
                Page {page} of {totalPages}
              </p>

              <div className="grid grid-cols-2 gap-3 sm:flex">
                <button
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page <= 1}
                  className="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>

                <button
                  onClick={() =>
                    setPage((current) => Math.min(totalPages, current + 1))
                  }
                  disabled={page >= totalPages}
                  className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
