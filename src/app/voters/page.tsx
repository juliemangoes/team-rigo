"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

type CampaignZone = {
  id: string;
  name: string;
  description: string | null;
  display_order: number | null;
};

type PollingArea = {
  id: string;
  code: string;
  name: string | null;
  location: string | null;
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

type VoterStats = {
  loaded: number;
  total: number;
  confirmed: number;
  leaning: number;
  opponent: number;
  unassigned: number;
  pickupNeeded: number;
  voted: number;
};

type PendingBulkAction = {
  label: string;
  payload: Partial<Voter>;
  ids: string[];
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

function pillClass(color: string | null | undefined, value?: string | null) {
  if (color === "green" || value === "Confirmed Supporter") {
    return "bg-green-100 text-green-800";
  }

  if (color === "blue") return "bg-blue-100 text-blue-800";
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

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value || 0);
}

function compactContact(value: string | null) {
  return value?.trim() || "";
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-xs font-black uppercase tracking-wide text-slate-500">
      {children}
    </label>
  );
}

function VotedBadge({ voted }: { voted: boolean }) {
  return (
    <span
      className={`inline-flex min-w-[92px] items-center justify-center rounded-full px-3 py-2 text-xs font-black leading-none whitespace-nowrap ${
        voted
          ? "bg-green-100 text-green-800"
          : "bg-red-100 text-red-800"
      }`}
    >
      {voted ? "Voted" : "Not Voted"}
    </span>
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
  tone?: "blue" | "green" | "red" | "amber" | "purple" | "slate";
}) {
  const color =
    tone === "blue"
      ? "border-blue-100 bg-blue-50 text-blue-700"
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
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm outline-none transition focus:border-blue-700 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
    >
      {children}
    </select>
  );
}

export default function VotersPage() {
  const [profile, setProfile] = useState<TeamProfile | null>(null);
  const [campaigners, setCampaigners] = useState<Campaigner[]>([]);
  const [campaignZones, setCampaignZones] = useState<CampaignZone[]>([]);
  const [pollingAreas, setPollingAreas] = useState<PollingArea[]>([]);
  const [supportStatusOptions, setSupportStatusOptions] = useState<
    SupportStatusOption[]
  >([]);
  const [voters, setVoters] = useState<Voter[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadingVoters, setLoadingVoters] = useState(false);
  const [message, setMessage] = useState("");

  const loadRequestRef = useRef(0);

  const [search, setSearch] = useState("");
  const [zoneFilter, setZoneFilter] = useState("All");
  const [pollingAreaFilter, setPollingAreaFilter] = useState("All");
  const [supportFilter, setSupportFilter] = useState("All");
  const [campaignerFilter, setCampaignerFilter] = useState("All");
  const [pickupFilter, setPickupFilter] = useState("All");

  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [voterStats, setVoterStats] = useState<VoterStats>({
    loaded: 0,
    total: 0,
    confirmed: 0,
    leaning: 0,
    opponent: 0,
    unassigned: 0,
    pickupNeeded: 0,
    voted: 0,
  });

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkCampaignerId, setBulkCampaignerId] = useState("");
  const [bulkSupportStatus, setBulkSupportStatus] = useState("");
  const [pendingBulkAction, setPendingBulkAction] =
    useState<PendingBulkAction | null>(null);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [savingManage, setSavingManage] = useState(false);
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [manageVoter, setManageVoter] = useState<Voter | null>(null);
  const [manageContact, setManageContact] = useState("");
  const [manageZone, setManageZone] = useState("");
  const [managePollingArea, setManagePollingArea] = useState("");
  const [manageNotes, setManageNotes] = useState("");
  const [managePickupStatus, setManagePickupStatus] = useState("");
  const [managePickupNeeded, setManagePickupNeeded] = useState(false);
  const [manageSupportStatus, setManageSupportStatus] = useState("Unknown");
  const [manageCampaignerId, setManageCampaignerId] = useState("");

  const canAccess =
    profile?.role === "Campaign Manager" || profile?.role === "Zone Leader";

  const canManage = profile?.role === "Campaign Manager";

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);

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

    const [campaignerResult, zoneResult, pollingResult, supportResult] =
      await Promise.all([
        supabase
          .from("campaigners")
          .select("id, full_name, email, phone, zone, role")
          .order("full_name", { ascending: true }),

        supabase
          .from("campaign_zones")
          .select("id, name, description, display_order")
          .order("display_order", { ascending: true })
          .order("name", { ascending: true }),

        supabase
          .from("polling_areas")
          .select("id, code, name, location, display_order")
          .order("display_order", { ascending: true })
          .order("code", { ascending: true }),

        supabase
          .from("support_status_options")
          .select("id, value, label, description, color, display_order, is_active")
          .eq("is_active", true)
          .order("display_order", { ascending: true })
          .order("label", { ascending: true }),
      ]);

    if (campaignerResult.error) {
      console.error("Campaigners error:", campaignerResult.error);
      setCampaigners([]);
    } else {
      setCampaigners(campaignerResult.data || []);
    }

    if (zoneResult.error) {
      console.error("Campaign setup zones error:", zoneResult.error);
      setCampaignZones([]);
    } else {
      setCampaignZones(zoneResult.data || []);
    }

    if (pollingResult.error) {
      console.error("Campaign setup polling areas error:", pollingResult.error);
      setPollingAreas([]);
    } else {
      setPollingAreas(pollingResult.data || []);
    }

    if (supportResult.error) {
      console.error("Support status options error:", supportResult.error);
      setSupportStatusOptions([]);
    } else {
      setSupportStatusOptions(supportResult.data || []);
    }

    setLoading(false);
  }

  function applyVoterFilters(query: any) {
    const searchTokens = search
      .trim()
      .replace(/[,%()]/g, " ")
      .split(/\s+/)
      .map((token) => token.trim())
      .filter(Boolean)
      .slice(0, 6);

    if (searchTokens.length === 1) {
      const token = searchTokens[0];

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
    }

    if (searchTokens.length > 1) {
      const hasNumber = searchTokens.some((token) => /\d/.test(token));

      if (hasNumber) {
        // Mixed searches like a voter number plus a name still require every token.
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
            ].join(",")
          );
        });
      } else {
        // Multi-word text searches are treated as a person's name.
        // This prevents "Julian Brown" from returning everyone with either
        // Julian anywhere OR Brown anywhere.
        const firstToken = searchTokens[0];
        const lastToken = searchTokens[searchTokens.length - 1];
        const forwardNamePattern = `%${searchTokens.join("%")}%`;
        const reverseNamePattern = `%${[...searchTokens].reverse().join("%")}%`;

        query = query.or(
          [
            `full_name.ilike.${forwardNamePattern}`,
            `full_name.ilike.${reverseNamePattern}`,
            `and(first_name.ilike.%${firstToken}%,last_name.ilike.%${lastToken}%)`,
            `and(first_name.ilike.%${lastToken}%,last_name.ilike.%${firstToken}%)`,
          ].join(",")
        );
      }
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
      if (pickupFilter === "Needed") query = query.eq("pickup_needed", true);
      if (pickupFilter === "Not Needed") query = query.eq("pickup_needed", false);
    }

    return query;
  }

  async function getFilteredCount(applyExtraFilter?: (query: any) => any) {
    let query = supabase
      .from("voters")
      .select("id", { count: "exact", head: true });

    query = applyVoterFilters(query);

    if (applyExtraFilter) {
      query = applyExtraFilter(query);
    }

    const { error, count } = await query;

    if (error) throw error;

    return count || 0;
  }

  async function loadVoterStats(
    loadedCount: number,
    total: number,
    requestId: number
  ) {
    try {
      const [
        confirmed,
        leaning,
        opponent,
        unassigned,
        pickupNeeded,
        voted,
      ] = await Promise.all([
        getFilteredCount((query) =>
          query.eq("support_status", "Confirmed Supporter")
        ),
        getFilteredCount((query) =>
          query.eq("support_status", "Leaning Supporter")
        ),
        getFilteredCount((query) =>
          query.eq("support_status", "Not Supporting")
        ),
        getFilteredCount((query) => query.is("campaigner_id", null)),
        getFilteredCount((query) => query.eq("pickup_needed", true)),
        getFilteredCount((query) => query.eq("voted", true)),
      ]);

      if (requestId !== loadRequestRef.current) return;

      setVoterStats({
        loaded: loadedCount,
        total,
        confirmed,
        leaning,
        opponent,
        unassigned,
        pickupNeeded,
        voted,
      });
    } catch (error) {
      if (requestId !== loadRequestRef.current) return;

      console.error("Voter stats error:", error);
      setVoterStats((current) => ({
        ...current,
        loaded: loadedCount,
        total,
      }));
    }
  }

  async function loadVoters() {
    if (!profile) return;

    const requestId = ++loadRequestRef.current;

    setLoadingVoters(true);
    setMessage("");

    const { data, error } = await supabase.rpc("search_voters_module", {
      p_search: search,
      p_zone: zoneFilter,
      p_polling_area: pollingAreaFilter,
      p_support_status: supportFilter,
      p_campaigner_id: campaignerFilter,
      p_pickup_filter: pickupFilter,
      p_page: page,
      p_page_size: PAGE_SIZE,
    });

    if (requestId !== loadRequestRef.current) return;

    if (error) {
      console.error("Voters load error:", error);
      setMessage(error.message || "Error loading voters.");
      setVoters([]);
      setTotalCount(0);
      setVoterStats({
        loaded: 0,
        total: 0,
        confirmed: 0,
        leaning: 0,
        opponent: 0,
        unassigned: 0,
        pickupNeeded: 0,
        voted: 0,
      });
      setLoadingVoters(false);
      return;
    }

    const result = (data || {}) as {
      rows?: RawVoter[];
      total?: number;
      stats?: Partial<VoterStats>;
    };

    const normalized = ((result.rows || []) as RawVoter[]).map(normalizeVoter);
    const nextTotal = Number(result.total || 0);
    const stats = result.stats || {};

    setVoters(normalized);
    setTotalCount(nextTotal);
    setSelectedIds([]);
    setVoterStats({
      loaded: normalized.length,
      total: nextTotal,
      confirmed: Number(stats.confirmed || 0),
      leaning: Number(stats.leaning || 0),
      opponent: Number(stats.opponent || 0),
      unassigned: Number(stats.unassigned || 0),
      pickupNeeded: Number(stats.pickupNeeded || 0),
      voted: Number(stats.voted || 0),
    });

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
    if (page !== 1) setPage(1);
  }

  function clearFilters() {
    loadRequestRef.current += 1;
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

    campaignZones.forEach((zone) => {
      if (zone.name) zones.add(zone.name);
    });

    campaigners.forEach((person) => {
      if (person.zone) zones.add(person.zone);
    });

    voters.forEach((voter) => {
      if (voter.zone) zones.add(voter.zone);
    });

    if (profile?.role === "Zone Leader" && profile.zone) zones.add(profile.zone);

    return Array.from(zones).sort();
  }, [campaignZones, campaigners, voters, profile]);

  const pollingAreaOptions = useMemo(() => {
    const areas = new Set<string>();

    pollingAreas.forEach((area) => {
      if (area.code) areas.add(area.code);
    });

    voters.forEach((voter) => {
      if (voter.polling_area) areas.add(voter.polling_area);
      if (voter.polling_station) areas.add(voter.polling_station);
    });

    return Array.from(areas).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true })
    );
  }, [pollingAreas, voters]);

  const campaignerOptions = useMemo(() => {
    return campaigners.filter((person) => person.role === "Campaigner");
  }, [campaigners]);

  const supportStatuses = useMemo(() => {
    const activeOptions = supportStatusOptions
      .filter((item) => item.is_active !== false)
      .map((item) => item.value);

    return activeOptions.length > 0 ? activeOptions : defaultSupportStatuses;
  }, [supportStatusOptions]);

  function getPollingAreaLabel(code: string) {
    const area = pollingAreas.find((item) => item.code === code);
    if (!area) return code;

    return area.name ? `${area.code} - ${area.name}` : area.code;
  }

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

    return pillClass(option?.color, cleanValue);
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
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

  function queueBackgroundRefresh() {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }

    refreshTimeoutRef.current = setTimeout(() => {
      if (profile && canAccess) {
        loadVoters();
      }
    }, 900);
  }

  function applyLocalVoterUpdate(voterId: string, payload: Partial<Voter>) {
    const assignedCampaigner =
      typeof payload.campaigner_id !== "undefined"
        ? campaigners.find((person) => person.id === payload.campaigner_id) || null
        : undefined;

    setVoters((current) =>
      current.map((voter) => {
        if (voter.id !== voterId) return voter;

        return {
          ...voter,
          ...payload,
          campaigners:
            typeof payload.campaigner_id !== "undefined"
              ? assignedCampaigner
                ? {
                    id: assignedCampaigner.id,
                    full_name: assignedCampaigner.full_name,
                  }
                : null
              : voter.campaigners,
        };
      })
    );
  }

  async function updateVoter(
    voterId: string,
    payload: Partial<Voter>,
    options: { backgroundRefresh?: boolean } = {}
  ) {
    if (!canManage) {
      alert("Only the Campaign Manager can update voter records.");
      return false;
    }

    const previousVoter = voters.find((voter) => voter.id === voterId) || null;
    const cleanPayload = { ...payload } as Record<string, unknown>;

    delete cleanPayload.id;
    delete cleanPayload.campaigners;
    delete cleanPayload.voted_at;

    setMessage("");
    applyLocalVoterUpdate(voterId, payload);

    const { data, error } = await supabase
      .from("voters")
      .update(cleanPayload)
      .eq("id", voterId)
      .select(voterSelect)
      .maybeSingle();

    if (error) {
      console.error("Update voter error:", error);

      if (previousVoter) {
        setVoters((current) =>
          current.map((voter) => (voter.id === voterId ? previousVoter : voter))
        );
      }

      setMessage(error.message || "Error updating voter.");
      return false;
    }

    if (data) {
      const updatedVoter = normalizeVoter(data as RawVoter);

      setVoters((current) =>
        current.map((voter) => (voter.id === voterId ? updatedVoter : voter))
      );
    }

    if (options.backgroundRefresh !== false) {
      queueBackgroundRefresh();
    }

    return true;
  }

  function requestBulkUpdate(label: string, payload: Partial<Voter>) {
    if (!canManage) {
      alert("Only the Campaign Manager can use bulk actions.");
      return;
    }

    if (selectedIds.length === 0) {
      alert("Select at least one voter first.");
      return;
    }

    // Do not use the browser's native confirm(). It blocks the main thread
    // and can trigger an INP warning on slower devices. This opens a normal
    // React modal immediately, keeping the click response fast.
    setPendingBulkAction({
      label,
      payload,
      ids: [...selectedIds],
    });
  }

  async function runPendingBulkUpdate() {
    if (!pendingBulkAction || bulkSaving) return;

    setBulkSaving(true);
    setMessage("Applying bulk update...");

    // Let the modal/button loading state paint before the network request starts.
    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => resolve());
    });

    const idsToUpdate = pendingBulkAction.ids;

    const { error } = await supabase
      .from("voters")
      .update(pendingBulkAction.payload)
      .in("id", idsToUpdate);

    if (error) {
      console.error("Bulk update error:", error);
      setMessage(error.message || "Error applying bulk update.");
      setBulkSaving(false);
      return;
    }

    setMessage(`${idsToUpdate.length} voter(s) updated.`);
    setSelectedIds([]);
    setBulkCampaignerId("");
    setBulkSupportStatus("");
    setPendingBulkAction(null);

    await loadVoters();
    setBulkSaving(false);
  }

  function openManageModal(voter: Voter) {
    setManageVoter(voter);
    setManageContact(voter.contact_no || voter.phone || "");
    setManageZone(voter.zone || "");
    setManagePollingArea(voter.polling_area || voter.polling_station || "");
    setManageNotes(voter.notes || "");
    setManagePickupNeeded(Boolean(voter.pickup_needed));
    setManagePickupStatus(
      voter.pickup_needed
        ? voter.pickup_status && voter.pickup_status !== "No Pickup Needed"
          ? voter.pickup_status
          : "Not Contacted"
        : "No Pickup Needed"
    );
    setManageSupportStatus(voter.support_status || "Unknown");
    setManageCampaignerId(voter.campaigner_id || "");
  }

  async function saveManageModal() {
    if (!manageVoter || savingManage) return;

    setSavingManage(true);

    const saved = await updateVoter(manageVoter.id, {
      contact_no: manageContact.trim() || null,
      phone: manageContact.trim() || null,
      zone: manageZone || null,
      polling_area: managePollingArea || null,
      polling_station: managePollingArea || null,
      support_status: manageSupportStatus || "Unknown",
      campaigner_id: manageCampaignerId || null,
      notes: manageNotes.trim() || null,
      pickup_needed: managePickupNeeded,
      pickup_status: managePickupNeeded
        ? managePickupStatus && managePickupStatus !== "No Pickup Needed"
          ? managePickupStatus
          : "Not Contacted"
        : "No Pickup Needed",
    });

    setSavingManage(false);

    if (saved) {
      setManageVoter(null);
      setMessage("Voter saved.");
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 p-4 sm:p-6">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-3xl bg-white p-6 text-center shadow-sm">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-blue-700" />
            <h1 className="mt-5 text-xl font-black text-slate-900">
              Loading voters...
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
            Voters Access Restricted
          </h1>
          <p className="mt-3 text-slate-600">
            Only the Campaign Manager and Zone Leaders can view the voter page.
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
                Voters
              </h1>

              <p className="mt-2 max-w-3xl text-sm text-slate-500 sm:text-base">
                {profile?.role === "Zone Leader"
                  ? `Zone Leader view for ${
                      profile.zone || "your assigned zone"
                    }.`
                  : "Search, classify, assign, and manage voter records."}
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
            <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm font-bold text-blue-900">
              {message}
            </div>
          )}

          {!canManage && (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">
              View-only access. Only the Campaign Manager can update voter records.
            </div>
          )}

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            <SummaryCard label="Total Results" value={formatNumber(voterStats.total)} />
            <SummaryCard
              label="Loaded Page"
              value={formatNumber(voterStats.loaded)}
              detail={`Page ${page} of ${totalPages}`}
              tone="blue"
            />
            <SummaryCard
              label="Confirmed"
              value={formatNumber(voterStats.confirmed)}
              detail={`${formatNumber(voterStats.leaning)} leaning`}
              tone="green"
            />
            <SummaryCard
              label="Opponent"
              value={formatNumber(voterStats.opponent)}
              detail="Not Supporting"
              tone="red"
            />
            <SummaryCard
              label="Unassigned"
              value={formatNumber(voterStats.unassigned)}
              detail="No campaigner"
              tone={voterStats.unassigned > 0 ? "amber" : "green"}
            />
            <SummaryCard
              label="Pickup"
              value={formatNumber(voterStats.pickupNeeded)}
              detail="Needed"
              tone="purple"
            />
          </div>
        </div>
      </section>

      <section className="px-4 py-5 sm:px-6 sm:py-8">
        <div className="mx-auto max-w-7xl">
          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="grid gap-3 lg:grid-cols-[1.5fr_repeat(5,1fr)_auto] lg:items-end">
              <div>
                <FieldLabel>Search</FieldLabel>
                <input
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    resetToFirstPage();
                  }}
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-700 focus:ring-4 focus:ring-blue-100"
                  placeholder="Search exact name, reg no., phone..."
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
                <FieldLabel>Polling</FieldLabel>
                <SelectField
                  value={pollingAreaFilter}
                  onChange={(value) => {
                    setPollingAreaFilter(value);
                    resetToFirstPage();
                  }}
                >
                  <option>All</option>
                  {pollingAreaOptions.map((area) => (
                    <option key={area} value={area}>
                      {getPollingAreaLabel(area)}
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
                <FieldLabel>Campaigner</FieldLabel>
                <SelectField
                  value={campaignerFilter}
                  onChange={(value) => {
                    setCampaignerFilter(value);
                    resetToFirstPage();
                  }}
                >
                  <option>All</option>
                  <option value="Unassigned">Unassigned</option>
                  {campaignerOptions.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.full_name}
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

          {canManage && (
            <section className="mt-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
                <div>
                  <h2 className="text-xl font-black text-slate-950">
                    Bulk Actions
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {selectedIds.length} selected on this page.
                  </p>
                </div>

                <div className="grid gap-3 md:grid-cols-[auto_1fr_auto_1fr_auto] xl:min-w-[820px]">
                  <button
                    onClick={toggleSelectVisible}
                    className="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-50"
                  >
                    {selectedIds.length === voters.length && voters.length > 0
                      ? "Clear Selection"
                      : "Select Visible"}
                  </button>

                  <SelectField
                    value={bulkCampaignerId}
                    onChange={setBulkCampaignerId}
                  >
                    <option value="">Assign Campaigner</option>
                    {campaignerOptions.map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.full_name}
                      </option>
                    ))}
                  </SelectField>

                  <button
                    disabled={bulkSaving}
                    onClick={() => {
                      if (!bulkCampaignerId) {
                        alert("Choose a campaigner first.");
                        return;
                      }

                      const campaigner = campaigners.find(
                        (person) => person.id === bulkCampaignerId
                      );

                      requestBulkUpdate(
                        `Assign selected voters to ${campaigner?.full_name || "campaigner"}`,
                        { campaigner_id: bulkCampaignerId }
                      );
                    }}
                    className="rounded-2xl bg-blue-700 px-4 py-3 text-sm font-black text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Apply
                  </button>

                  <SelectField
                    value={bulkSupportStatus}
                    onChange={setBulkSupportStatus}
                  >
                    <option value="">Set Support</option>
                    {supportStatuses.map((status) => (
                      <option key={status} value={status}>
                        {getSupportStatusLabel(status)}
                      </option>
                    ))}
                  </SelectField>

                  <button
                    disabled={bulkSaving}
                    onClick={() => {
                      if (!bulkSupportStatus) {
                        alert("Choose a support status first.");
                        return;
                      }

                      requestBulkUpdate(
                        `Set selected voters to ${getSupportStatusLabel(bulkSupportStatus)}`,
                        { support_status: bulkSupportStatus }
                      );
                    }}
                    className="rounded-2xl bg-green-700 px-4 py-3 text-sm font-black text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Apply
                  </button>
                </div>
              </div>
            </section>
          )}

          <section className="mt-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-black text-slate-950">
                  Voter Records
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Showing {formatNumber(voters.length)} of{" "}
                  {formatNumber(totalCount)} result(s).
                </p>
              </div>

              {loadingVoters && (
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">
                  Loading...
                </span>
              )}
            </div>

            <div className="mt-4 grid gap-3 lg:hidden">
              {voters.map((voter) => {
                const contact = compactContact(voter.contact_no || voter.phone);
                const isSelected = selectedIdSet.has(voter.id);

                return (
                  <article
                    key={voter.id}
                    className={`rounded-3xl border p-4 ${
                      isSelected
                        ? "border-blue-300 bg-blue-50"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                          {getRegNo(voter)}
                        </p>
                        <h3 className="mt-1 break-words text-lg font-black text-slate-950">
                          {getDisplayName(voter)}
                        </h3>
                        <p className="mt-1 text-sm text-slate-500">
                          {voter.street_name || voter.address || "No street"}
                        </p>
                      </div>

                      {canManage && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelected(voter.id)}
                          className="mt-1 h-5 w-5 shrink-0"
                        />
                      )}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-black ${getSupportPillClass(
                          voter.support_status
                        )}`}
                      >
                        {getSupportStatusLabel(voter.support_status)}
                      </span>

<VotedBadge voted={voter.voted} />

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
                          {voter.polling_area ||
                            voter.polling_station ||
                            "No polling"}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-black uppercase text-slate-400">
                          Campaigner
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

                    {canManage && (
                      <button
                        onClick={() => openManageModal(voter)}
                        className="mt-4 w-full rounded-2xl bg-blue-700 px-4 py-3 text-sm font-black text-white hover:bg-blue-800"
                      >
                        Manage Voter
                      </button>
                    )}
                  </article>
                );
              })}

              {voters.length === 0 && (
                <div className="rounded-3xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                  No voters found.
                </div>
              )}
            </div>

            <div className="mt-4 hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[1180px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                    {canManage && <th className="py-3 pr-3 font-black">Select</th>}
                    <th className="px-3 py-3 font-black">Voter</th>
                    <th className="px-3 py-3 font-black">Reg No.</th>
                    <th className="px-3 py-3 font-black">Address</th>
                    <th className="px-3 py-3 font-black">Zone</th>
                    <th className="px-3 py-3 font-black">Polling</th>
                    <th className="px-3 py-3 font-black">Support</th>
                    <th className="px-3 py-3 font-black">Campaigner</th>
                    <th className="px-3 py-3 font-black">Contact</th>
                    <th className="px-3 py-3 font-black">Pickup</th>
                    <th className="px-3 py-3 font-black">Voted</th>
                    {canManage && <th className="px-3 py-3 font-black">Action</th>}
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {voters.map((voter) => (
                    <tr key={voter.id} className="align-top">
                      {canManage && (
                        <td className="py-3 pr-3">
                          <input
                            type="checkbox"
                            checked={selectedIdSet.has(voter.id)}
                            onChange={() => toggleSelected(voter.id)}
                            className="h-5 w-5"
                          />
                        </td>
                      )}

                      <td className="px-3 py-3">
                        <p className="font-black text-slate-950">
                          {getDisplayName(voter)}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {voter.age ? `${voter.age} yrs` : "No age"}
                          {voter.vocation ? ` · ${voter.vocation}` : ""}
                        </p>
                      </td>

                      <td className="px-3 py-3 font-bold text-slate-700">
                        {getRegNo(voter)}
                      </td>

                      <td className="px-3 py-3 text-slate-700">
                        {voter.street_name || voter.address || "No street"}
                      </td>

                      <td className="px-3 py-3 text-slate-700">
                        {voter.zone || "No zone"}
                      </td>

                      <td className="px-3 py-3 text-slate-700">
                        {voter.polling_area ||
                          voter.polling_station ||
                          "No polling"}
                      </td>

                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex items-center justify-center rounded-full px-3 py-2 text-xs font-black leading-none whitespace-nowrap ${getSupportPillClass(
                            voter.support_status
                          )}`}
                        >
                          {getSupportStatusLabel(voter.support_status)}
                        </span>
                      </td>

                      <td className="px-3 py-3">
                        <span className="font-bold text-slate-700">
                          {voter.campaigners?.full_name || "Unassigned"}
                        </span>
                      </td>

                      <td className="px-3 py-3 font-bold text-slate-700">
                        {compactContact(voter.contact_no || voter.phone) || "No contact"}
                      </td>

                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex items-center justify-center rounded-full px-3 py-2 text-xs font-black leading-none whitespace-nowrap ${
                            voter.pickup_needed
                              ? "bg-amber-100 text-amber-800"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {voter.pickup_needed ? "Needed" : "Not Needed"}
                        </span>
                        <p className="mt-2 text-xs text-slate-500">
                          {voter.pickup_status || "Not Contacted"}
                        </p>
                      </td>

                      <td className="px-3 py-3">
                        <div>
                          <VotedBadge voted={voter.voted} />
                          {voter.voted && voter.voted_at && (
                            <p className="mt-2 text-xs font-bold text-green-700">
                              {formatTime(voter.voted_at)}
                            </p>
                          )}
                        </div>
                      </td>

                      {canManage && (
                        <td className="px-3 py-3">
                          <button
                            onClick={() => openManageModal(voter)}
                            className="rounded-xl bg-blue-700 px-3 py-2 text-xs font-black text-white hover:bg-blue-800"
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
                        colSpan={canManage ? 12 : 10}
                        className="p-10 text-center text-slate-500"
                      >
                        No voters found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
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

          {pendingBulkAction && (
            <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
              <div className="w-full rounded-t-3xl bg-white p-5 shadow-xl sm:max-w-lg sm:rounded-3xl sm:p-6">
                <h2 className="text-2xl font-black text-slate-900">
                  Confirm Bulk Update
                </h2>

                <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
                  {pendingBulkAction.label} for {pendingBulkAction.ids.length} selected
                  voter(s). This update will apply to the selected records on this page.
                </p>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <button
                    disabled={bulkSaving}
                    onClick={() => setPendingBulkAction(null)}
                    className="rounded-2xl border border-slate-300 px-4 py-3 font-black text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Cancel
                  </button>

                  <button
                    disabled={bulkSaving}
                    onClick={runPendingBulkUpdate}
                    className="rounded-2xl bg-green-700 px-4 py-3 font-black text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {bulkSaving ? "Applying..." : "Confirm Update"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {manageVoter && (
            <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
              <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-xl sm:max-w-2xl sm:rounded-3xl sm:p-6">
                <div className="mb-5 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-black text-slate-900">
                      Manage Voter
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      {getDisplayName(manageVoter)} · {getRegNo(manageVoter)}
                    </p>
                  </div>

                  <button
                    onClick={() => setManageVoter(null)}
                    className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-xl font-black text-slate-800"
                  >
                    ×
                  </button>
                </div>

                <div className="grid gap-4">
                  <div>
                    <FieldLabel>Contact Number</FieldLabel>
                    <input
                      value={manageContact}
                      onChange={(event) => setManageContact(event.target.value)}
                      className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm outline-none transition focus:border-blue-700 focus:ring-4 focus:ring-blue-100"
                      placeholder="Contact number"
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <FieldLabel>Support Status</FieldLabel>
                      <SelectField
                        value={manageSupportStatus}
                        onChange={setManageSupportStatus}
                      >
                        {supportStatuses.map((status) => (
                          <option key={status} value={status}>
                            {getSupportStatusLabel(status)}
                          </option>
                        ))}
                      </SelectField>
                    </div>

                    <div>
                      <FieldLabel>Campaigner Assigned</FieldLabel>
                      <SelectField
                        value={manageCampaignerId}
                        onChange={setManageCampaignerId}
                      >
                        <option value="">Unassigned</option>
                        {campaignerOptions.map((person) => (
                          <option key={person.id} value={person.id}>
                            {person.full_name}
                          </option>
                        ))}
                      </SelectField>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <FieldLabel>Zone</FieldLabel>
                      <SelectField value={manageZone} onChange={setManageZone}>
                        <option value="">No zone</option>
                        {zoneOptions.map((zone) => (
                          <option key={zone} value={zone}>
                            {zone}
                          </option>
                        ))}
                      </SelectField>
                    </div>

                    <div>
                      <FieldLabel>Polling Area</FieldLabel>
                      <SelectField
                        value={managePollingArea}
                        onChange={setManagePollingArea}
                      >
                        <option value="">No polling area</option>
                        {pollingAreaOptions.map((area) => (
                          <option key={area} value={area}>
                            {getPollingAreaLabel(area)}
                          </option>
                        ))}
                      </SelectField>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 px-4 py-3 shadow-sm">
                      <span>
                        <span className="block text-xs font-black uppercase tracking-wide text-slate-500">
                          Pickup Needed
                        </span>
                        <span className="mt-1 block text-sm font-semibold text-slate-600">
                          Mark this voter for pickup follow-up.
                        </span>
                      </span>
                      <input
                        type="checkbox"
                        checked={managePickupNeeded}
                        onChange={(event) => {
                          const checked = event.target.checked;
                          setManagePickupNeeded(checked);
                          setManagePickupStatus(
                            checked ? "Not Contacted" : "No Pickup Needed"
                          );
                        }}
                        className="h-6 w-6 shrink-0"
                      />
                    </label>

                    <div>
                      <FieldLabel>Pickup Status</FieldLabel>
                      <SelectField
                        value={managePickupNeeded ? managePickupStatus : "No Pickup Needed"}
                        onChange={setManagePickupStatus}
                        disabled={!managePickupNeeded}
                      >
                        {pickupStatuses.map((status) => (
                          <option key={status}>{status}</option>
                        ))}
                      </SelectField>
                    </div>
                  </div>

                  <div>
                    <FieldLabel>Notes</FieldLabel>
                    <textarea
                      value={manageNotes}
                      onChange={(event) => setManageNotes(event.target.value)}
                      className="mt-2 min-h-28 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm outline-none transition focus:border-blue-700 focus:ring-4 focus:ring-blue-100"
                      placeholder="Notes"
                    />
                  </div>
                </div>

                <div className="mt-6 grid gap-3 md:grid-cols-2">
                  <button
                    onClick={() => setManageVoter(null)}
                    disabled={savingManage}
                    className="rounded-2xl border border-slate-300 px-4 py-3 font-black text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Cancel
                  </button>

                  <button
                    onClick={saveManageModal}
                    disabled={savingManage}
                    className="rounded-2xl bg-blue-700 px-4 py-3 font-black text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {savingManage ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
