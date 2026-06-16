"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

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

type ReportType =
  | "filtered"
  | "support_status"
  | "zone"
  | "polling_area"
  | "campaigner"
  | "unassigned"
  | "voted_status";

type SummaryRow = {
  label: string;
  total: number;
  confirmed: number;
  leaning: number;
  notSupporting: number;
  undecidedUnknown: number;
  voted: number;
  notVoted: number;
  pickupNeeded: number;
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
  voted,
  voted_at,
  notes,
  campaigners:campaigner_id (
    id,
    full_name
  )
`;

const reportTypes: { value: ReportType; label: string; description: string }[] = [
  {
    value: "filtered",
    label: "Filtered Voter List",
    description: "Export the current filtered voter list.",
  },
  {
    value: "support_status",
    label: "By Support Status",
    description: "Group voters by support status.",
  },
  {
    value: "zone",
    label: "By Zone",
    description: "Group voters by campaign zone.",
  },
  {
    value: "polling_area",
    label: "By Polling Area",
    description: "Group voters by polling area.",
  },
  {
    value: "campaigner",
    label: "By Campaigner",
    description: "Group voters by assigned campaigner.",
  },
  {
    value: "unassigned",
    label: "Unassigned Voters",
    description: "Export voters not assigned to a campaigner.",
  },
  {
    value: "voted_status",
    label: "Voted / Not Voted",
    description: "Group voters by voted status.",
  },
];

const defaultSupportStatuses = [
  "Unknown",
  "Confirmed Supporter",
  "Leaning Supporter",
  "Undecided",
  "Not Supporting",
  "Do Not Contact",
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

function escapeHtml(value: string | number | null | undefined) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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

function supportPillClass(value: string | null) {
  if (value === "Confirmed Supporter") return "bg-green-100 text-green-800";
  if (value === "Leaning Supporter") return "bg-purple-100 text-purple-800";
  if (value === "Undecided") return "bg-amber-100 text-amber-800";
  if (value === "Not Supporting" || value === "Do Not Contact") {
    return "bg-red-100 text-red-800";
  }

  return "bg-slate-100 text-slate-700";
}

function groupSummary(voters: Voter[], keyGetter: (voter: Voter) => string) {
  const map = new Map<string, SummaryRow>();

  voters.forEach((voter) => {
    const label = keyGetter(voter) || "Not Set";

    if (!map.has(label)) {
      map.set(label, {
        label,
        total: 0,
        confirmed: 0,
        leaning: 0,
        notSupporting: 0,
        undecidedUnknown: 0,
        voted: 0,
        notVoted: 0,
        pickupNeeded: 0,
      });
    }

    const item = map.get(label)!;

    item.total += 1;

    if (voter.support_status === "Confirmed Supporter") item.confirmed += 1;
    if (voter.support_status === "Leaning Supporter") item.leaning += 1;
    if (voter.support_status === "Not Supporting") item.notSupporting += 1;
    if (
      !voter.support_status ||
      voter.support_status === "Unknown" ||
      voter.support_status === "Undecided"
    ) {
      item.undecidedUnknown += 1;
    }

    if (voter.voted) item.voted += 1;
    else item.notVoted += 1;

    if (voter.pickup_needed) item.pickupNeeded += 1;
  });

  return Array.from(map.values()).sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    return a.label.localeCompare(b.label);
  });
}

function downloadText(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
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
}: {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm outline-none transition focus:border-blue-700 focus:ring-4 focus:ring-blue-100"
    >
      {children}
    </select>
  );
}

export default function ReportsPage() {
  const [profile, setProfile] = useState<TeamProfile | null>(null);
  const [campaigners, setCampaigners] = useState<Campaigner[]>([]);
  const [campaignZones, setCampaignZones] = useState<CampaignZone[]>([]);
  const [pollingAreas, setPollingAreas] = useState<PollingArea[]>([]);
  const [supportStatusOptions, setSupportStatusOptions] = useState<
    SupportStatusOption[]
  >([]);
  const [voters, setVoters] = useState<Voter[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadingReport, setLoadingReport] = useState(false);
  const [message, setMessage] = useState("");

  const [reportType, setReportType] = useState<ReportType>("filtered");
  const [search, setSearch] = useState("");
  const [supportFilter, setSupportFilter] = useState("All");
  const [zoneFilter, setZoneFilter] = useState("All");
  const [pollingFilter, setPollingFilter] = useState("All");
  const [campaignerFilter, setCampaignerFilter] = useState("All");
  const [assignmentFilter, setAssignmentFilter] = useState("All");
  const [votedFilter, setVotedFilter] = useState("All");
  const [includeVoterList, setIncludeVoterList] = useState(true);

  const canAccess = profile?.role === "Campaign Manager";

  useEffect(() => {
    loadPage();
  }, []);

  useEffect(() => {
    if (profile && canAccess) {
      loadReportData();
    }
  }, [profile, canAccess]);

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
      console.error("Zones error:", zoneResult.error);
      setCampaignZones([]);
    } else {
      setCampaignZones(zoneResult.data || []);
    }

    if (pollingResult.error) {
      console.error("Polling areas error:", pollingResult.error);
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

  async function loadReportData() {
    setLoadingReport(true);
    setMessage("");

    const { data, error } = await supabase
      .from("voters")
      .select(voterSelect)
      .order("last_name", { ascending: true, nullsFirst: false })
      .order("first_name", { ascending: true, nullsFirst: false })
      .range(0, 49999);

    if (error) {
      console.error("Reports voter load error:", error);
      setMessage(error.message || "Error loading report data.");
      setVoters([]);
      setLoadingReport(false);
      return;
    }

    const normalized = ((data || []) as RawVoter[]).map(normalizeVoter);
    setVoters(normalized);
    setLoadingReport(false);
  }

  const supportStatuses = useMemo(() => {
    const activeOptions = supportStatusOptions
      .filter((item) => item.is_active !== false)
      .map((item) => item.value);

    return activeOptions.length > 0 ? activeOptions : defaultSupportStatuses;
  }, [supportStatusOptions]);

  function getSupportLabel(value: string | null) {
    const cleanValue = value || "Unknown";
    const option = supportStatusOptions.find((item) => item.value === cleanValue);

    return option?.label || cleanValue;
  }

  const zoneOptions = useMemo(() => {
    const zones = new Set<string>();

    campaignZones.forEach((zone) => {
      if (zone.name) zones.add(zone.name);
    });

    voters.forEach((voter) => {
      if (voter.zone) zones.add(voter.zone);
    });

    return Array.from(zones).sort();
  }, [campaignZones, voters]);

  const pollingOptions = useMemo(() => {
    const areas = new Set<string>();

    pollingAreas.forEach((area) => {
      if (area.code) areas.add(area.code);
    });

    voters.forEach((voter) => {
      const value = getPollingArea(voter);
      if (value) areas.add(value);
    });

    return Array.from(areas).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true })
    );
  }, [pollingAreas, voters]);

  function pollingLabel(code: string) {
    const area = pollingAreas.find((item) => item.code === code);
    if (!area) return code;

    return area.name ? `${area.code} - ${area.name}` : area.code;
  }

  const campaignerOptions = useMemo(() => {
    return campaigners.filter((person) => person.role === "Campaigner");
  }, [campaigners]);

  const filteredVoters = useMemo(() => {
    const cleanSearch = search.trim().toLowerCase();

    return voters.filter((voter) => {
      const campaignerName = voter.campaigners?.full_name || "";

      const matchesSearch =
        !cleanSearch ||
        getDisplayName(voter).toLowerCase().includes(cleanSearch) ||
        getRegNo(voter).toLowerCase().includes(cleanSearch) ||
        cleanText(voter.contact_no || voter.phone)
          .toLowerCase()
          .includes(cleanSearch) ||
        getAddress(voter).toLowerCase().includes(cleanSearch) ||
        (voter.zone || "").toLowerCase().includes(cleanSearch) ||
        getPollingArea(voter).toLowerCase().includes(cleanSearch) ||
        campaignerName.toLowerCase().includes(cleanSearch);

      const matchesSupport =
        supportFilter === "All" || (voter.support_status || "Unknown") === supportFilter;

      const matchesZone = zoneFilter === "All" || voter.zone === zoneFilter;

      const matchesPolling =
        pollingFilter === "All" || getPollingArea(voter) === pollingFilter;

      const matchesCampaigner =
        campaignerFilter === "All" || voter.campaigner_id === campaignerFilter;

      const matchesAssignment =
        assignmentFilter === "All" ||
        (assignmentFilter === "Assigned" && !!voter.campaigner_id) ||
        (assignmentFilter === "Unassigned" && !voter.campaigner_id);

      const matchesVoted =
        votedFilter === "All" ||
        (votedFilter === "Voted" && voter.voted) ||
        (votedFilter === "Not Voted" && !voter.voted);

      return (
        matchesSearch &&
        matchesSupport &&
        matchesZone &&
        matchesPolling &&
        matchesCampaigner &&
        matchesAssignment &&
        matchesVoted
      );
    });
  }, [
    voters,
    search,
    supportFilter,
    zoneFilter,
    pollingFilter,
    campaignerFilter,
    assignmentFilter,
    votedFilter,
  ]);

  const reportVoters = useMemo(() => {
    if (reportType === "unassigned") {
      return filteredVoters.filter((voter) => !voter.campaigner_id);
    }

    return filteredVoters;
  }, [filteredVoters, reportType]);

  const summaryRows = useMemo(() => {
    if (reportType === "support_status") {
      return groupSummary(reportVoters, (voter) =>
        getSupportLabel(voter.support_status)
      );
    }

    if (reportType === "zone") {
      return groupSummary(reportVoters, (voter) => voter.zone || "No Zone");
    }

    if (reportType === "polling_area") {
      return groupSummary(reportVoters, (voter) => getPollingArea(voter) || "No Polling Area");
    }

    if (reportType === "campaigner") {
      return groupSummary(
        reportVoters,
        (voter) => voter.campaigners?.full_name || "Unassigned"
      );
    }

    if (reportType === "unassigned") {
      return groupSummary(reportVoters, () => "Unassigned");
    }

    if (reportType === "voted_status") {
      return groupSummary(reportVoters, (voter) =>
        voter.voted ? "Voted" : "Not Voted"
      );
    }

    return groupSummary(reportVoters, () => "Filtered Voters");
  }, [reportType, reportVoters, supportStatusOptions]);

  const totals = useMemo(() => {
    const confirmed = reportVoters.filter(
      (voter) => voter.support_status === "Confirmed Supporter"
    ).length;
    const leaning = reportVoters.filter(
      (voter) => voter.support_status === "Leaning Supporter"
    ).length;
    const notSupporting = reportVoters.filter(
      (voter) => voter.support_status === "Not Supporting"
    ).length;
    const voted = reportVoters.filter((voter) => voter.voted).length;
    const pickupNeeded = reportVoters.filter((voter) => voter.pickup_needed).length;
    const unassigned = reportVoters.filter((voter) => !voter.campaigner_id).length;

    return {
      total: reportVoters.length,
      confirmed,
      leaning,
      notSupporting,
      voted,
      notVoted: reportVoters.length - voted,
      pickupNeeded,
      unassigned,
    };
  }, [reportVoters]);

  const selectedReport =
    reportTypes.find((item) => item.value === reportType) || reportTypes[0];

  function clearFilters() {
    setSearch("");
    setSupportFilter("All");
    setZoneFilter("All");
    setPollingFilter("All");
    setCampaignerFilter("All");
    setAssignmentFilter("All");
    setVotedFilter("All");
  }

  function activeFilterText() {
    const parts = [
      `Report: ${selectedReport.label}`,
      supportFilter !== "All" ? `Support: ${getSupportLabel(supportFilter)}` : "",
      zoneFilter !== "All" ? `Zone: ${zoneFilter}` : "",
      pollingFilter !== "All" ? `Polling: ${pollingLabel(pollingFilter)}` : "",
      campaignerFilter !== "All"
        ? `Campaigner: ${
            campaignerOptions.find((item) => item.id === campaignerFilter)
              ?.full_name || campaignerFilter
          }`
        : "",
      assignmentFilter !== "All" ? `Assignment: ${assignmentFilter}` : "",
      votedFilter !== "All" ? `Voted: ${votedFilter}` : "",
      search.trim() ? `Search: ${search.trim()}` : "",
    ].filter(Boolean);

    return parts.join(" | ");
  }

  function summaryTableHtml() {
    return `
      <table>
        <thead>
          <tr>
            <th>Group</th>
            <th>Total</th>
            <th>Confirmed</th>
            <th>Leaning</th>
            <th>Not Supporting</th>
            <th>Undecided/Unknown</th>
            <th>Voted</th>
            <th>Not Voted</th>
            <th>Pickup</th>
          </tr>
        </thead>
        <tbody>
          ${summaryRows
            .map(
              (row) => `
                <tr>
                  <td>${escapeHtml(row.label)}</td>
                  <td>${formatNumber(row.total)}</td>
                  <td>${formatNumber(row.confirmed)}</td>
                  <td>${formatNumber(row.leaning)}</td>
                  <td>${formatNumber(row.notSupporting)}</td>
                  <td>${formatNumber(row.undecidedUnknown)}</td>
                  <td>${formatNumber(row.voted)}</td>
                  <td>${formatNumber(row.notVoted)}</td>
                  <td>${formatNumber(row.pickupNeeded)}</td>
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
    `;
  }

  function voterListTableHtml() {
    const rows = reportVoters.slice(0, 2000);

    return `
      <h2>Voter List</h2>
      <p class="note">Showing ${formatNumber(rows.length)} of ${formatNumber(
        reportVoters.length
      )} voter(s). For very large reports, export CSV for the full data list.</p>
      <table>
        <thead>
          <tr>
            <th>Reg No.</th>
            <th>Name</th>
            <th>Zone</th>
            <th>Polling</th>
            <th>Support</th>
            <th>Campaigner</th>
            <th>Voted</th>
            <th>Pickup</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (voter) => `
                <tr>
                  <td>${escapeHtml(getRegNo(voter))}</td>
                  <td>${escapeHtml(getDisplayName(voter))}</td>
                  <td>${escapeHtml(voter.zone || "No Zone")}</td>
                  <td>${escapeHtml(getPollingArea(voter) || "No Polling")}</td>
                  <td>${escapeHtml(getSupportLabel(voter.support_status))}</td>
                  <td>${escapeHtml(voter.campaigners?.full_name || "Unassigned")}</td>
                  <td>${voter.voted ? "Voted" : "Not Voted"}</td>
                  <td>${voter.pickup_needed ? "Needed" : "Not Needed"}</td>
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
    `;
  }

  function exportPdf() {
    const generatedAt = new Date().toLocaleString();

    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(selectedReport.label)} - Team Rigo Report</title>
          <style>
            * { box-sizing: border-box; }
            body {
              font-family: Arial, Helvetica, sans-serif;
              color: #0f172a;
              margin: 28px;
              line-height: 1.35;
            }
            .header {
              border-bottom: 3px solid #1d4ed8;
              padding-bottom: 14px;
              margin-bottom: 20px;
            }
            .brand {
              font-size: 12px;
              font-weight: 900;
              letter-spacing: 0.14em;
              text-transform: uppercase;
              color: #1d4ed8;
            }
            h1 {
              margin: 6px 0 4px;
              font-size: 28px;
              line-height: 1.1;
            }
            h2 {
              font-size: 18px;
              margin: 24px 0 10px;
            }
            .meta, .note {
              color: #475569;
              font-size: 12px;
              margin: 4px 0;
            }
            .grid {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 10px;
              margin: 18px 0;
            }
            .stat {
              border: 1px solid #e2e8f0;
              border-radius: 12px;
              padding: 10px;
              background: #f8fafc;
            }
            .stat-label {
              font-size: 10px;
              text-transform: uppercase;
              letter-spacing: 0.08em;
              color: #64748b;
              font-weight: 900;
            }
            .stat-value {
              margin-top: 4px;
              font-size: 20px;
              font-weight: 900;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 8px;
              page-break-inside: auto;
              font-size: 11px;
            }
            tr { page-break-inside: avoid; page-break-after: auto; }
            th {
              text-align: left;
              background: #eff6ff;
              border: 1px solid #cbd5e1;
              padding: 7px;
              font-size: 10px;
              text-transform: uppercase;
            }
            td {
              border: 1px solid #e2e8f0;
              padding: 7px;
              vertical-align: top;
            }
            .disclaimer {
              margin-top: 18px;
              padding: 10px;
              border-radius: 10px;
              background: #fff7ed;
              color: #9a3412;
              font-size: 11px;
              font-weight: 700;
            }
            @page { size: A4 landscape; margin: 14mm; }
            @media print {
              body { margin: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="brand">Team Rigo Campaign Operations</div>
            <h1>${escapeHtml(selectedReport.label)}</h1>
            <p class="meta">${escapeHtml(selectedReport.description)}</p>
            <p class="meta">Generated: ${escapeHtml(generatedAt)}</p>
            <p class="meta">${escapeHtml(activeFilterText())}</p>
          </div>

          <div class="grid">
            <div class="stat"><div class="stat-label">Total Voters</div><div class="stat-value">${formatNumber(
              totals.total
            )}</div></div>
            <div class="stat"><div class="stat-label">Confirmed</div><div class="stat-value">${formatNumber(
              totals.confirmed
            )}</div></div>
            <div class="stat"><div class="stat-label">Not Supporting</div><div class="stat-value">${formatNumber(
              totals.notSupporting
            )}</div></div>
            <div class="stat"><div class="stat-label">Voted</div><div class="stat-value">${formatNumber(
              totals.voted
            )}</div></div>
          </div>

          <h2>Summary</h2>
          ${summaryTableHtml()}

          ${includeVoterList ? voterListTableHtml() : ""}

          <div class="disclaimer">
            Reports are based on recorded campaign support status and operational voter records.
            Voted status means a voter was marked by the election-day workflow; it is not a record of anyone's private ballot.
          </div>

          <script>
            window.onload = function () {
              window.focus();
              window.print();
            };
          </script>
        </body>
      </html>
    `;

    const reportWindow = window.open("", "_blank", "noopener,noreferrer");

    if (!reportWindow) {
      setMessage("Your browser blocked the PDF window. Allow pop-ups and try again.");
      return;
    }

    reportWindow.document.open();
    reportWindow.document.write(html);
    reportWindow.document.close();
  }

  function exportCsv() {
    const header = [
      "voter_reg_no",
      "full_name",
      "zone",
      "polling_area",
      "support_status",
      "campaigner",
      "contact_no",
      "address",
      "voted",
      "pickup_needed",
      "pickup_status",
      "notes",
    ];

    const lines = [
      header.join(","),
      ...reportVoters.map((voter) =>
        [
          getRegNo(voter),
          getDisplayName(voter),
          voter.zone || "",
          getPollingArea(voter),
          getSupportLabel(voter.support_status),
          voter.campaigners?.full_name || "Unassigned",
          voter.contact_no || voter.phone || "",
          getAddress(voter),
          voter.voted ? "Voted" : "Not Voted",
          voter.pickup_needed ? "Yes" : "No",
          voter.pickup_status || "",
          voter.notes || "",
        ]
          .map((value) => `"${String(value).replaceAll('"', '""')}"`)
          .join(",")
      ),
    ];

    const safeName = selectedReport.label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    downloadText(`${safeName || "report"}.csv`, lines.join("\n"), "text/csv");
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 p-4 sm:p-6">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-3xl bg-white p-6 text-center shadow-sm">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-blue-700" />
            <h1 className="mt-5 text-xl font-black text-slate-900">
              Loading reports...
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
            Campaign Manager Access Only
          </h1>

          <p className="mt-3 text-slate-600">
            PDF reports are restricted to the Campaign Manager.
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
                Reports
              </h1>

              <p className="mt-2 max-w-3xl text-sm text-slate-500 sm:text-base">
                Build and export PDF reports by support status, zone, polling
                area, campaigner, unassigned voters, and voted status.
              </p>
            </div>

            <button
              onClick={loadReportData}
              className="w-full rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white hover:bg-slate-800 sm:w-auto"
            >
              {loadingReport ? "Refreshing..." : "Refresh Data"}
            </button>
          </div>

          {message && (
            <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm font-bold text-blue-900">
              {message}
            </div>
          )}

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            <SummaryCard label="Total" value={formatNumber(totals.total)} />
            <SummaryCard
              label="Confirmed"
              value={formatNumber(totals.confirmed)}
              detail={`${formatNumber(totals.leaning)} leaning`}
              tone="green"
            />
            <SummaryCard
              label="Opponent"
              value={formatNumber(totals.notSupporting)}
              detail="Not Supporting"
              tone="red"
            />
            <SummaryCard
              label="Voted"
              value={formatNumber(totals.voted)}
              detail={`${formatNumber(totals.notVoted)} not voted`}
              tone="blue"
            />
            <SummaryCard
              label="Pickup"
              value={formatNumber(totals.pickupNeeded)}
              detail="Needed"
              tone="purple"
            />
            <SummaryCard
              label="Unassigned"
              value={formatNumber(totals.unassigned)}
              detail="No campaigner"
              tone={totals.unassigned > 0 ? "amber" : "slate"}
            />
          </div>
        </div>
      </section>

      <section className="px-4 py-5 sm:px-6 sm:py-8">
        <div className="mx-auto max-w-7xl">
          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="grid gap-4 xl:grid-cols-[1.1fr_1.5fr]">
              <div>
                <FieldLabel>Report Type</FieldLabel>
                <SelectField
                  value={reportType}
                  onChange={(value) => setReportType(value as ReportType)}
                >
                  {reportTypes.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </SelectField>

                <p className="mt-3 rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-600">
                  {selectedReport.description}
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <div>
                  <FieldLabel>Search</FieldLabel>
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-700 focus:ring-4 focus:ring-blue-100"
                    placeholder="Name, reg no., phone..."
                  />
                </div>

                <div>
                  <FieldLabel>Support Status</FieldLabel>
                  <SelectField value={supportFilter} onChange={setSupportFilter}>
                    <option>All</option>
                    {supportStatuses.map((status) => (
                      <option key={status} value={status}>
                        {getSupportLabel(status)}
                      </option>
                    ))}
                  </SelectField>
                </div>

                <div>
                  <FieldLabel>Zone</FieldLabel>
                  <SelectField value={zoneFilter} onChange={setZoneFilter}>
                    <option>All</option>
                    {zoneOptions.map((zone) => (
                      <option key={zone}>{zone}</option>
                    ))}
                  </SelectField>
                </div>

                <div>
                  <FieldLabel>Polling Area</FieldLabel>
                  <SelectField value={pollingFilter} onChange={setPollingFilter}>
                    <option>All</option>
                    {pollingOptions.map((polling) => (
                      <option key={polling} value={polling}>
                        {pollingLabel(polling)}
                      </option>
                    ))}
                  </SelectField>
                </div>

                <div>
                  <FieldLabel>Campaigner</FieldLabel>
                  <SelectField
                    value={campaignerFilter}
                    onChange={setCampaignerFilter}
                  >
                    <option>All</option>
                    {campaignerOptions.map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.full_name}
                      </option>
                    ))}
                  </SelectField>
                </div>

                <div>
                  <FieldLabel>Assignment</FieldLabel>
                  <SelectField
                    value={assignmentFilter}
                    onChange={setAssignmentFilter}
                  >
                    <option>All</option>
                    <option>Assigned</option>
                    <option>Unassigned</option>
                  </SelectField>
                </div>

                <div>
                  <FieldLabel>Voted Status</FieldLabel>
                  <SelectField value={votedFilter} onChange={setVotedFilter}>
                    <option>All</option>
                    <option>Voted</option>
                    <option>Not Voted</option>
                  </SelectField>
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-5 lg:flex-row lg:items-center lg:justify-between">
              <label className="flex items-start gap-3 text-sm font-bold text-slate-700">
                <input
                  type="checkbox"
                  checked={includeVoterList}
                  onChange={(event) => setIncludeVoterList(event.target.checked)}
                  className="mt-1 h-5 w-5"
                />
                Include voter list in PDF report.
              </label>

              <div className="grid gap-3 sm:grid-cols-3">
                <button
                  onClick={clearFilters}
                  className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-black text-slate-700 hover:bg-slate-50"
                >
                  Clear Filters
                </button>

                <button
                  onClick={exportCsv}
                  disabled={reportVoters.length === 0}
                  className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-black text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Export CSV
                </button>

                <button
                  onClick={exportPdf}
                  disabled={reportVoters.length === 0}
                  className="rounded-2xl bg-blue-700 px-5 py-3 text-sm font-black text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-blue-300"
                >
                  Export PDF
                </button>
              </div>
            </div>
          </section>

          <section className="mt-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-black text-slate-950">
                  Report Preview
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {activeFilterText()}
                </p>
              </div>

              {loadingReport && (
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">
                  Loading...
                </span>
              )}
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-3 pr-3 font-black">Group</th>
                    <th className="px-3 py-3 font-black">Total</th>
                    <th className="px-3 py-3 font-black">Confirmed</th>
                    <th className="px-3 py-3 font-black">Leaning</th>
                    <th className="px-3 py-3 font-black">Not Supporting</th>
                    <th className="px-3 py-3 font-black">Undecided/Unknown</th>
                    <th className="px-3 py-3 font-black">Voted</th>
                    <th className="px-3 py-3 font-black">Not Voted</th>
                    <th className="px-3 py-3 font-black">Pickup</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {summaryRows.map((row) => (
                    <tr key={row.label} className="align-top">
                      <td className="py-3 pr-3 font-black text-slate-950">
                        {row.label}
                      </td>
                      <td className="px-3 py-3 font-bold text-slate-700">
                        {formatNumber(row.total)}
                      </td>
                      <td className="px-3 py-3 font-bold text-green-700">
                        {formatNumber(row.confirmed)}
                      </td>
                      <td className="px-3 py-3 font-bold text-purple-700">
                        {formatNumber(row.leaning)}
                      </td>
                      <td className="px-3 py-3 font-bold text-red-700">
                        {formatNumber(row.notSupporting)}
                      </td>
                      <td className="px-3 py-3 font-bold text-amber-700">
                        {formatNumber(row.undecidedUnknown)}
                      </td>
                      <td className="px-3 py-3 font-bold text-blue-700">
                        {formatNumber(row.voted)}
                      </td>
                      <td className="px-3 py-3 font-bold text-slate-700">
                        {formatNumber(row.notVoted)}
                      </td>
                      <td className="px-3 py-3 font-bold text-purple-700">
                        {formatNumber(row.pickupNeeded)}
                      </td>
                    </tr>
                  ))}

                  {summaryRows.length === 0 && (
                    <tr>
                      <td colSpan={9} className="p-10 text-center text-slate-500">
                        No records match this report.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-black text-slate-950">
                  Voter List Preview
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Showing first {formatNumber(Math.min(reportVoters.length, 100))} of{" "}
                  {formatNumber(reportVoters.length)} voter(s).
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 lg:hidden">
              {reportVoters.slice(0, 100).map((voter) => (
                <article
                  key={voter.id}
                  className="rounded-3xl border border-slate-200 p-4"
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
                        {voter.zone || "No zone"} ·{" "}
                        {getPollingArea(voter) || "No polling"}
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

                  <div className="mt-3 flex flex-wrap gap-2">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-black ${supportPillClass(
                        voter.support_status
                      )}`}
                    >
                      {getSupportLabel(voter.support_status)}
                    </span>

                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">
                      {voter.campaigners?.full_name || "Unassigned"}
                    </span>
                  </div>
                </article>
              ))}

              {reportVoters.length === 0 && (
                <div className="rounded-3xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                  No voters match this report.
                </div>
              )}
            </div>

            <div className="mt-4 hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[1050px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-3 pr-3 font-black">Reg No.</th>
                    <th className="px-3 py-3 font-black">Name</th>
                    <th className="px-3 py-3 font-black">Zone</th>
                    <th className="px-3 py-3 font-black">Polling</th>
                    <th className="px-3 py-3 font-black">Support</th>
                    <th className="px-3 py-3 font-black">Campaigner</th>
                    <th className="px-3 py-3 font-black">Voted</th>
                    <th className="px-3 py-3 font-black">Pickup</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {reportVoters.slice(0, 100).map((voter) => (
                    <tr key={voter.id} className="align-top">
                      <td className="py-3 pr-3 font-bold text-slate-700">
                        {getRegNo(voter)}
                      </td>
                      <td className="px-3 py-3 font-black text-slate-950">
                        {getDisplayName(voter)}
                      </td>
                      <td className="px-3 py-3 text-slate-700">
                        {voter.zone || "No Zone"}
                      </td>
                      <td className="px-3 py-3 text-slate-700">
                        {getPollingArea(voter) || "No Polling"}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-black ${supportPillClass(
                            voter.support_status
                          )}`}
                        >
                          {getSupportLabel(voter.support_status)}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-slate-700">
                        {voter.campaigners?.full_name || "Unassigned"}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-black ${
                            voter.voted
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {voter.voted ? "Voted" : "Not Voted"}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-slate-700">
                        {voter.pickup_needed ? "Needed" : "Not Needed"}
                      </td>
                    </tr>
                  ))}

                  {reportVoters.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-10 text-center text-slate-500">
                        No voters match this report.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
