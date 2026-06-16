"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type TeamProfile = {
  id: string;
  full_name: string;
  email: string | null;
  role: string | null;
  zone: string | null;
};

type CampaignSettings = {
  id: number;
  election_name: string | null;
  vote_target_to_win: number | null;
};

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
  support_status: string | null;
  pickup_needed: boolean;
  pickup_status: string | null;
  voted: boolean;
  voted_at: string | null;
  campaigner_id: string | null;
  notes: string | null;
};

type Campaigner = {
  id: string;
  full_name: string;
  role: string | null;
  zone: string | null;
};

type ZoneReport = {
  zone: string;
  total: number;
  confirmed: number;
  leaning: number;
  undecided: number;
  unknown: number;
  projected: number;
  voted: number;
  confirmedVoted: number;
  confirmedRemaining: number;
  pickupNeeded: number;
  pickupIssues: number;
  unassigned: number;
};

type PollingReport = {
  pollingArea: string;
  total: number;
  confirmed: number;
  leaning: number;
  projected: number;
  voted: number;
  confirmedVoted: number;
  confirmedRemaining: number;
  pickupNeeded: number;
  pickupIssues: number;
};

type CampaignerReport = {
  id: string;
  name: string;
  zone: string | null;
  assigned: number;
  confirmed: number;
  leaning: number;
  projected: number;
  voted: number;
  confirmedVoted: number;
  pickupNeeded: number;
  pickupIssues: number;
};

type Tone = "slate" | "blue" | "green" | "amber" | "red" | "purple" | "orange";

const supportOrder = [
  "Confirmed Supporter",
  "Leaning Supporter",
  "Undecided",
  "Unknown",
  "Not Supporting",
  "Do Not Contact",
];

const pickupOrder = [
  "Not Contacted",
  "Confirmed Pickup",
  "On Route",
  "Picked Up",
  "At Polling Station",
  "Completed",
  "Issue",
  "No Pickup Needed",
];

function percentage(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((value / total) * 100);
}

function clampPercentage(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(value, 0), 100);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value || 0);
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

function getSupportStatus(voter: Voter) {
  return voter.support_status || "Unknown";
}

function getPickupStatus(voter: Voter) {
  return voter.pickup_status || "Not Contacted";
}

function getVictoryStatus(projectedVotes: number, confirmed: number, target: number) {
  if (!target || target <= 0) {
    return {
      label: "Set Target",
      tone: "slate" as Tone,
      description: "Add a vote target in Campaign Setup.",
    };
  }

  const projectedRate = projectedVotes / target;
  const confirmedRate = confirmed / target;

  if (confirmedRate >= 1) {
    return {
      label: "Strong Position",
      tone: "green" as Tone,
      description: "Confirmed supporters meet or exceed the target.",
    };
  }

  if (projectedRate >= 1.15) {
    return {
      label: "Strong Lead",
      tone: "green" as Tone,
      description: "Projected vote strength is comfortably above target.",
    };
  }

  if (projectedRate >= 1) {
    return {
      label: "On Track",
      tone: "blue" as Tone,
      description: "Projected vote strength meets the target.",
    };
  }

  if (projectedRate >= 0.9) {
    return {
      label: "Close Race",
      tone: "amber" as Tone,
      description: "Projected vote strength is close but below target.",
    };
  }

  if (projectedRate >= 0.75) {
    return {
      label: "At Risk",
      tone: "orange" as Tone,
      description: "More confirmed supporters are needed.",
    };
  }

  return {
    label: "Critical Gap",
    tone: "red" as Tone,
    description: "Confirmed and projected support are far below target.",
  };
}

function textClass(tone: Tone | string) {
  if (tone === "green") return "text-green-700";
  if (tone === "blue") return "text-blue-700";
  if (tone === "amber") return "text-amber-700";
  if (tone === "orange") return "text-orange-700";
  if (tone === "red") return "text-red-700";
  if (tone === "purple") return "text-purple-700";

  return "text-slate-700";
}

function bgClass(tone: Tone | string) {
  if (tone === "green") return "bg-green-50";
  if (tone === "blue") return "bg-blue-50";
  if (tone === "amber") return "bg-amber-50";
  if (tone === "orange") return "bg-orange-50";
  if (tone === "red") return "bg-red-50";
  if (tone === "purple") return "bg-purple-50";

  return "bg-slate-50";
}

function borderClass(tone: Tone | string) {
  if (tone === "green") return "border-green-100";
  if (tone === "blue") return "border-blue-100";
  if (tone === "amber") return "border-amber-100";
  if (tone === "orange") return "border-orange-100";
  if (tone === "red") return "border-red-100";
  if (tone === "purple") return "border-purple-100";

  return "border-slate-200";
}

function badgeClass(tone: Tone | string) {
  if (tone === "green") return "bg-green-100 text-green-800";
  if (tone === "blue") return "bg-blue-100 text-blue-800";
  if (tone === "amber") return "bg-amber-100 text-amber-800";
  if (tone === "orange") return "bg-orange-100 text-orange-800";
  if (tone === "red") return "bg-red-100 text-red-800";
  if (tone === "purple") return "bg-purple-100 text-purple-800";

  return "bg-slate-100 text-slate-800";
}

function progressClass(tone: Tone | string) {
  if (tone === "green") return "bg-green-600";
  if (tone === "blue") return "bg-blue-600";
  if (tone === "amber") return "bg-amber-500";
  if (tone === "orange") return "bg-orange-500";
  if (tone === "red") return "bg-red-600";
  if (tone === "purple") return "bg-purple-600";

  return "bg-slate-600";
}

function csvValue(value: unknown) {
  if (value === null || value === undefined) return "";

  const stringValue = String(value).replace(/"/g, '""');

  if (
    stringValue.includes(",") ||
    stringValue.includes("\n") ||
    stringValue.includes('"')
  ) {
    return `"${stringValue}"`;
  }

  return stringValue;
}

function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) {
    alert("No data available to export.");
    return;
  }

  const headers = Object.keys(rows[0]);

  const csv = [
    headers.map(csvValue).join(","),
    ...rows.map((row) => headers.map((header) => csvValue(row[header])).join(",")),
  ].join("\n");

  const blob = new Blob([csv], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}

function ProgressBar({ value, tone = "blue" }: { value: number; tone?: Tone | string }) {
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
      <div
        className={`h-2.5 rounded-full ${progressClass(tone)}`}
        style={{ width: `${clampPercentage(value)}%` }}
      />
    </div>
  );
}

function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h2 className="break-words text-xl font-black text-slate-900 sm:text-2xl">
          {title}
        </h2>
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      </div>

      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

function CompactMetric({
  label,
  value,
  tone = "slate",
  detail,
}: {
  label: string;
  value: string | number;
  tone?: Tone;
  detail?: string;
}) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 border-b border-slate-100 py-3 last:border-b-0">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-600">{label}</p>
        {detail && <p className="mt-0.5 text-xs text-slate-400">{detail}</p>}
      </div>

      <p className={`shrink-0 text-xl font-black ${textClass(tone)}`}>
        {value}
      </p>
    </div>
  );
}

function DesktopStatCard({
  title,
  value,
  subtitle,
  tone,
}: {
  title: string;
  value: string | number;
  subtitle: string;
  tone: Tone;
}) {
  return (
    <div
      className={`min-w-0 rounded-3xl border p-5 shadow-sm ${bgClass(
        tone
      )} ${borderClass(tone)}`}
    >
      <p className={`text-sm font-semibold ${textClass(tone)}`}>{title}</p>
      <h3 className="mt-2 break-words text-4xl font-black text-slate-900">
        {value}
      </h3>
      <p className="mt-2 text-sm text-slate-500">{subtitle}</p>
    </div>
  );
}

function ReportRow({
  label,
  value,
  percent,
  tone,
}: {
  label: string;
  value: number;
  percent: number;
  tone: Tone;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 p-3 sm:p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-black text-slate-900">{label}</p>
          <p className="text-xs text-slate-500 sm:text-sm">
            {formatNumber(value)} voters
          </p>
        </div>

        <p className={`shrink-0 text-xl font-black sm:text-2xl ${textClass(tone)}`}>
          {percent}%
        </p>
      </div>

      <div className="mt-2 sm:mt-3">
        <ProgressBar value={percent} tone={tone} />
      </div>
    </div>
  );
}

function ExportChip({
  label,
  onClick,
  primary,
}: {
  label: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full px-4 py-2 text-sm font-black ${
        primary
          ? "bg-blue-700 text-white"
          : "border border-slate-200 bg-white text-slate-700"
      }`}
    >
      {label}
    </button>
  );
}

export default function ReportsPage() {
  const [profile, setProfile] = useState<TeamProfile | null>(null);
  const [settings, setSettings] = useState<CampaignSettings | null>(null);
  const [voters, setVoters] = useState<Voter[]>([]);
  const [campaigners, setCampaigners] = useState<Campaigner[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadReports();
  }, []);

  async function loadReports() {
    setRefreshing(true);
    setMessage("");

    const { data: sessionData } = await supabase.auth.getSession();
    const email = sessionData.session?.user.email;

    if (!email) {
      setMessage("No login email found.");
      setLoading(false);
      setRefreshing(false);
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
      setRefreshing(false);
      return;
    }

    if (!profileData) {
      setMessage("No Team Rigo profile found for this login email.");
      setLoading(false);
      setRefreshing(false);
      return;
    }

    setProfile(profileData);

    const [settingsResult, votersResult, campaignersResult] = await Promise.all([
      supabase
        .from("campaign_settings")
        .select("id, election_name, vote_target_to_win")
        .eq("id", 1)
        .maybeSingle(),

      supabase
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
          contact_no,
          phone,
          street_name,
          address,
          zone,
          polling_area,
          support_status,
          pickup_needed,
          pickup_status,
          voted,
          voted_at,
          campaigner_id,
          notes
        `
        )
        .order("last_name", { ascending: true, nullsFirst: false })
        .order("first_name", { ascending: true, nullsFirst: false })
        .range(0, 49999),

      supabase
        .from("campaigners")
        .select("id, full_name, role, zone")
        .order("full_name", { ascending: true }),
    ]);

    if (settingsResult.error) {
      console.error("Settings error:", settingsResult.error);
      setSettings(null);
    } else {
      setSettings(settingsResult.data || null);
    }

    if (votersResult.error) {
      console.error("Voters report error:", votersResult.error);
      setMessage("Error loading voter report data.");
      setVoters([]);
    } else {
      setVoters(votersResult.data || []);
    }

    if (campaignersResult.error) {
      console.error("Campaigners report error:", campaignersResult.error);
      setCampaigners([]);
    } else {
      setCampaigners(campaignersResult.data || []);
    }

    setLoading(false);
    setRefreshing(false);
  }

  const campaignerNameMap = useMemo(() => {
    const map = new Map<string, string>();

    campaigners.forEach((person) => {
      map.set(person.id, person.full_name);
    });

    return map;
  }, [campaigners]);

  const stats = useMemo(() => {
    const total = voters.length;
    const target = settings?.vote_target_to_win || 0;

    const confirmed = voters.filter(
      (voter) => getSupportStatus(voter) === "Confirmed Supporter"
    ).length;

    const leaning = voters.filter(
      (voter) => getSupportStatus(voter) === "Leaning Supporter"
    ).length;

    const undecided = voters.filter(
      (voter) => getSupportStatus(voter) === "Undecided"
    ).length;

    const unknown = voters.filter(
      (voter) => getSupportStatus(voter) === "Unknown"
    ).length;

    const pickupIssues = voters.filter(
      (voter) => getPickupStatus(voter) === "Issue"
    ).length;

    const voted = voters.filter((voter) => voter.voted).length;

    const confirmedVoted = voters.filter(
      (voter) => voter.voted && getSupportStatus(voter) === "Confirmed Supporter"
    ).length;

    const confirmedNotVoted = voters.filter(
      (voter) => !voter.voted && getSupportStatus(voter) === "Confirmed Supporter"
    ).length;

    const confirmedPickupNotVoted = voters.filter(
      (voter) =>
        !voter.voted &&
        voter.pickup_needed &&
        getSupportStatus(voter) === "Confirmed Supporter"
    ).length;

    const assigned = voters.filter((voter) => voter.campaigner_id).length;
    const projectedVotes = Math.round(confirmed + leaning * 0.5);

    const victoryStatus = getVictoryStatus(projectedVotes, confirmed, target);

    return {
      total,
      target,
      confirmed,
      leaning,
      undecided,
      unknown,
      pickupIssues,
      voted,
      confirmedVoted,
      confirmedNotVoted,
      confirmedPickupNotVoted,
      assigned,
      unassigned: total - assigned,
      projectedVotes,
      targetProgress: percentage(projectedVotes, target),
      confirmedProgress: percentage(confirmed, target),
      turnoutRate: percentage(voted, total),
      confirmedTurnoutRate: percentage(confirmedVoted, confirmed),
      assignmentRate: percentage(assigned, total),
      votesNeededFromProjected: Math.max(0, target - projectedVotes),
      votesNeededFromConfirmed: Math.max(0, target - confirmed),
      projectedCushion: projectedVotes - target,
      victoryStatus,
    };
  }, [voters, settings]);

  const supportReport = useMemo(() => {
    const map = new Map<string, number>();

    voters.forEach((voter) => {
      const status = getSupportStatus(voter);
      map.set(status, (map.get(status) || 0) + 1);
    });

    const knownRows = supportOrder.map((status) => ({
      status,
      total: map.get(status) || 0,
      percentage: percentage(map.get(status) || 0, voters.length),
    }));

    const otherRows = Array.from(map.entries())
      .filter(([status]) => !supportOrder.includes(status))
      .map(([status, total]) => ({
        status,
        total,
        percentage: percentage(total, voters.length),
      }));

    return [...knownRows, ...otherRows].filter((row) => row.total > 0);
  }, [voters]);

  const pickupReport = useMemo(() => {
    const map = new Map<string, number>();

    voters.forEach((voter) => {
      const status = getPickupStatus(voter);
      map.set(status, (map.get(status) || 0) + 1);
    });

    const knownRows = pickupOrder.map((status) => ({
      status,
      total: map.get(status) || 0,
      percentage: percentage(map.get(status) || 0, voters.length),
    }));

    const otherRows = Array.from(map.entries())
      .filter(([status]) => !pickupOrder.includes(status))
      .map(([status, total]) => ({
        status,
        total,
        percentage: percentage(total, voters.length),
      }));

    return [...knownRows, ...otherRows].filter((row) => row.total > 0);
  }, [voters]);

  const zoneReport = useMemo(() => {
    const map = new Map<string, ZoneReport>();

    voters.forEach((voter) => {
      const zone = voter.zone || "No Zone";

      if (!map.has(zone)) {
        map.set(zone, {
          zone,
          total: 0,
          confirmed: 0,
          leaning: 0,
          undecided: 0,
          unknown: 0,
          projected: 0,
          voted: 0,
          confirmedVoted: 0,
          confirmedRemaining: 0,
          pickupNeeded: 0,
          pickupIssues: 0,
          unassigned: 0,
        });
      }

      const item = map.get(zone)!;
      const supportStatus = getSupportStatus(voter);
      const pickupStatus = getPickupStatus(voter);

      item.total += 1;

      if (supportStatus === "Confirmed Supporter") {
        item.confirmed += 1;

        if (voter.voted) {
          item.confirmedVoted += 1;
        } else {
          item.confirmedRemaining += 1;
        }
      }

      if (supportStatus === "Leaning Supporter") item.leaning += 1;
      if (supportStatus === "Undecided") item.undecided += 1;
      if (supportStatus === "Unknown") item.unknown += 1;
      if (voter.voted) item.voted += 1;
      if (voter.pickup_needed) item.pickupNeeded += 1;
      if (pickupStatus === "Issue") item.pickupIssues += 1;
      if (!voter.campaigner_id) item.unassigned += 1;
    });

    return Array.from(map.values())
      .map((item) => ({
        ...item,
        projected: Math.round(item.confirmed + item.leaning * 0.5),
      }))
      .sort((a, b) => a.zone.localeCompare(b.zone));
  }, [voters]);

  const pollingReport = useMemo(() => {
    const map = new Map<string, PollingReport>();

    voters.forEach((voter) => {
      const pollingArea = voter.polling_area || "No Polling Area";

      if (!map.has(pollingArea)) {
        map.set(pollingArea, {
          pollingArea,
          total: 0,
          confirmed: 0,
          leaning: 0,
          projected: 0,
          voted: 0,
          confirmedVoted: 0,
          confirmedRemaining: 0,
          pickupNeeded: 0,
          pickupIssues: 0,
        });
      }

      const item = map.get(pollingArea)!;
      const supportStatus = getSupportStatus(voter);
      const pickupStatus = getPickupStatus(voter);

      item.total += 1;

      if (supportStatus === "Confirmed Supporter") {
        item.confirmed += 1;

        if (voter.voted) {
          item.confirmedVoted += 1;
        } else {
          item.confirmedRemaining += 1;
        }
      }

      if (supportStatus === "Leaning Supporter") item.leaning += 1;
      if (voter.voted) item.voted += 1;
      if (voter.pickup_needed) item.pickupNeeded += 1;
      if (pickupStatus === "Issue") item.pickupIssues += 1;
    });

    return Array.from(map.values())
      .map((item) => ({
        ...item,
        projected: Math.round(item.confirmed + item.leaning * 0.5),
      }))
      .sort((a, b) => a.pollingArea.localeCompare(b.pollingArea));
  }, [voters]);

  const campaignerReport = useMemo(() => {
    return campaigners
      .filter((person) => person.role === "Campaigner")
      .map((person) => {
        const assignedVoters = voters.filter(
          (voter) => voter.campaigner_id === person.id
        );

        const confirmed = assignedVoters.filter(
          (voter) => getSupportStatus(voter) === "Confirmed Supporter"
        ).length;

        const leaning = assignedVoters.filter(
          (voter) => getSupportStatus(voter) === "Leaning Supporter"
        ).length;

        const voted = assignedVoters.filter((voter) => voter.voted).length;

        const confirmedVoted = assignedVoters.filter(
          (voter) =>
            voter.voted && getSupportStatus(voter) === "Confirmed Supporter"
        ).length;

        const pickupNeeded = assignedVoters.filter(
          (voter) => voter.pickup_needed
        ).length;

        const pickupIssues = assignedVoters.filter(
          (voter) => getPickupStatus(voter) === "Issue"
        ).length;

        return {
          id: person.id,
          name: person.full_name,
          zone: person.zone,
          assigned: assignedVoters.length,
          confirmed,
          leaning,
          projected: Math.round(confirmed + leaning * 0.5),
          voted,
          confirmedVoted,
          pickupNeeded,
          pickupIssues,
        };
      })
      .sort((a, b) => b.confirmed - a.confirmed);
  }, [campaigners, voters]);

  const confirmedNotVotedList = useMemo(() => {
    return voters
      .filter(
        (voter) =>
          !voter.voted && getSupportStatus(voter) === "Confirmed Supporter"
      )
      .slice(0, 10);
  }, [voters]);

  const pickupRiskList = useMemo(() => {
    return voters
      .filter(
        (voter) =>
          !voter.voted &&
          voter.pickup_needed &&
          getSupportStatus(voter) === "Confirmed Supporter"
      )
      .slice(0, 10);
  }, [voters]);

  function exportFullVoterReport() {
    downloadCsv(
      "team-rigo-voter-report.csv",
      voters.map((voter) => ({
        reg_no: getRegNo(voter),
        name: getDisplayName(voter),
        contact: voter.contact_no || voter.phone || "",
        street: voter.street_name || voter.address || "",
        zone: voter.zone || "",
        polling_area: voter.polling_area || "",
        support_status: getSupportStatus(voter),
        campaigner: voter.campaigner_id
          ? campaignerNameMap.get(voter.campaigner_id) || ""
          : "",
        pickup_needed: voter.pickup_needed ? "Yes" : "No",
        pickup_status: getPickupStatus(voter),
        voted: voter.voted ? "Yes" : "No",
        voted_at: voter.voted_at || "",
        notes: voter.notes || "",
      }))
    );
  }

  function exportZoneReport() {
    downloadCsv(
      "team-rigo-zone-report.csv",
      zoneReport.map((item) => ({
        zone: item.zone,
        total: item.total,
        confirmed: item.confirmed,
        leaning: item.leaning,
        projected: item.projected,
        confirmed_voted: item.confirmedVoted,
        confirmed_remaining: item.confirmedRemaining,
        pickup_needed: item.pickupNeeded,
        pickup_issues: item.pickupIssues,
        unassigned: item.unassigned,
      }))
    );
  }

  function exportPollingReport() {
    downloadCsv(
      "team-rigo-polling-report.csv",
      pollingReport.map((item) => ({
        polling_area: item.pollingArea,
        total: item.total,
        confirmed: item.confirmed,
        leaning: item.leaning,
        projected: item.projected,
        voted: item.voted,
        confirmed_voted: item.confirmedVoted,
        confirmed_remaining: item.confirmedRemaining,
        pickup_needed: item.pickupNeeded,
        pickup_issues: item.pickupIssues,
      }))
    );
  }

  function exportCampaignerReport() {
    downloadCsv(
      "team-rigo-campaigner-report.csv",
      campaignerReport.map((item) => ({
        campaigner: item.name,
        zone: item.zone || "",
        assigned: item.assigned,
        confirmed: item.confirmed,
        leaning: item.leaning,
        projected: item.projected,
        voted: item.voted,
        confirmed_voted: item.confirmedVoted,
        pickup_needed: item.pickupNeeded,
        pickup_issues: item.pickupIssues,
      }))
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 p-4 sm:p-6">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-3xl bg-white p-6 text-center shadow">
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
              Team Rigo
            </p>

            <h1 className="mt-3 text-xl font-bold text-slate-900">
              Loading reports...
            </h1>
          </div>
        </div>
      </main>
    );
  }

  if (profile?.role !== "Campaign Manager") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4 sm:p-6">
        <div className="w-full max-w-xl rounded-2xl bg-white p-6 text-center shadow sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
            Team Rigo
          </p>

          <h1 className="mt-3 text-2xl font-bold text-slate-900">
            Campaign Manager Access Only
          </h1>

          <p className="mt-3 text-slate-600">
            Reports are restricted to the Campaign Manager.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-slate-100">
      <section className="bg-slate-950 px-4 py-4 text-white sm:px-6 sm:py-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex min-w-0 flex-col gap-3 sm:gap-6 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-300 sm:text-sm sm:tracking-[0.3em]">
                Team Rigo
              </p>

              <h1 className="mt-2 break-words text-2xl font-black tracking-tight sm:mt-3 sm:text-4xl md:text-5xl">
                Campaign Reports
              </h1>

              <p className="mt-2 max-w-3xl text-sm text-slate-300 sm:mt-3 sm:text-base">
                {settings?.election_name || "Team Rigo Campaign"} ·{" "}
                {profile?.full_name}
              </p>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1 sm:grid sm:w-auto sm:grid-cols-3 sm:overflow-visible sm:pb-0 xl:flex">
              <button
                onClick={loadReports}
                disabled={refreshing}
                className="shrink-0 rounded-full bg-white px-4 py-2 text-sm font-black text-slate-950 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60 sm:rounded-2xl sm:px-5 sm:py-3"
              >
                {refreshing ? "..." : "Refresh"}
              </button>

              <Link
                href="/dashboard"
                className="shrink-0 rounded-full border border-white/20 px-4 py-2 text-center text-sm font-black text-white hover:bg-white/10 sm:rounded-2xl sm:px-5 sm:py-3"
              >
                Dashboard
              </Link>

              <button
                onClick={exportFullVoterReport}
                className="shrink-0 rounded-full bg-blue-600 px-4 py-2 text-sm font-black text-white hover:bg-blue-700 sm:rounded-2xl sm:px-5 sm:py-3"
              >
                Export
              </button>
            </div>
          </div>

          {message && (
            <div className="mt-4 rounded-2xl border border-red-400/40 bg-red-500/10 p-3 text-sm font-semibold text-red-100 sm:mt-6">
              {message}
            </div>
          )}

          <div className="mt-4 rounded-3xl border border-white/10 bg-white/10 p-4 shadow-xl sm:mt-8 sm:p-6">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-300 sm:text-sm">
                  Victory Report
                </p>

                <h2 className="mt-1 break-words text-3xl font-black sm:mt-3 sm:text-5xl">
                  {stats.victoryStatus.label}
                </h2>
              </div>

              <span
                className={`w-fit shrink-0 rounded-full px-3 py-1.5 text-xs font-black sm:px-4 sm:py-2 sm:text-sm ${badgeClass(
                  stats.victoryStatus.tone
                )}`}
              >
                {stats.projectedCushion >= 0
                  ? `+${formatNumber(stats.projectedCushion)}`
                  : `${formatNumber(stats.projectedCushion)}`}
              </span>
            </div>

            <p className="mt-2 text-sm text-slate-300 sm:mt-3">
              {stats.victoryStatus.description}
            </p>

            <div className="mt-4">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-slate-300">Projected</span>
                <span className="font-black text-white">
                  {formatNumber(stats.projectedVotes)} /{" "}
                  {formatNumber(stats.target)}
                </span>
              </div>

              <div className="mt-2 h-3 overflow-hidden rounded-full bg-white/10 sm:h-4">
                <div
                  className={`h-3 rounded-full sm:h-4 ${progressClass(
                    stats.victoryStatus.tone
                  )}`}
                  style={{
                    width: `${clampPercentage(stats.targetProgress)}%`,
                  }}
                />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-1 rounded-2xl bg-slate-950/30 p-3 sm:hidden">
              <CompactMetric
                label="Confirmed"
                value={formatNumber(stats.confirmed)}
                tone="green"
              />

              <CompactMetric
                label="Projected Need"
                value={formatNumber(stats.votesNeededFromProjected)}
                tone={stats.votesNeededFromProjected > 0 ? "red" : "green"}
              />

              <CompactMetric
                label="Not Voted"
                value={formatNumber(stats.confirmedNotVoted)}
                tone="amber"
              />

              <CompactMetric
                label="Pickup Risk"
                value={formatNumber(stats.confirmedPickupNotVoted)}
                tone="orange"
              />
            </div>

            <p className="mt-3 hidden text-xs text-slate-400 sm:block">
              Projection uses confirmed supporters plus 50% of leaning
              supporters. This is an estimate, not a record of how anyone voted.
            </p>
          </div>

          <div className="mt-4 hidden gap-4 sm:grid sm:grid-cols-2 xl:grid-cols-4">
            <DesktopStatCard
              title="Confirmed Supporters"
              value={formatNumber(stats.confirmed)}
              tone="green"
              subtitle={`${formatNumber(
                stats.votesNeededFromConfirmed
              )} more confirmed needed.`}
            />

            <DesktopStatCard
              title="Projected Votes"
              value={formatNumber(stats.projectedVotes)}
              tone="blue"
              subtitle={`${formatNumber(
                stats.votesNeededFromProjected
              )} projected votes short.`}
            />

            <DesktopStatCard
              title="Confirmed Not Voted"
              value={formatNumber(stats.confirmedNotVoted)}
              tone="amber"
              subtitle="Main turnout follow-up group."
            />

            <DesktopStatCard
              title="Assignment Coverage"
              value={`${stats.assignmentRate}%`}
              tone="purple"
              subtitle={`${formatNumber(stats.assigned)} assigned voters.`}
            />
          </div>
        </div>
      </section>

      <section className="px-4 py-4 sm:px-6 sm:py-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-4 -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
            <ExportChip label="Export Voters" onClick={exportFullVoterReport} primary />
            <ExportChip label="Zone CSV" onClick={exportZoneReport} />
            <ExportChip label="Polling CSV" onClick={exportPollingReport} />
            <ExportChip label="Campaigner CSV" onClick={exportCampaignerReport} />
          </div>

          <section className="rounded-3xl bg-white p-4 shadow sm:p-6">
            <SectionHeader
              title="Core Report Snapshot"
              subtitle="Compact view of the most important numbers."
            />

            <div className="mt-3 divide-y divide-slate-100 sm:hidden">
              <CompactMetric
                label="Total Voters"
                value={formatNumber(stats.total)}
                tone="slate"
              />

              <CompactMetric
                label="Vote Target"
                value={formatNumber(stats.target)}
                tone="blue"
              />

              <CompactMetric
                label="Confirmed Voted"
                value={formatNumber(stats.confirmedVoted)}
                tone="green"
              />

              <CompactMetric
                label="Turnout Rate"
                value={`${stats.turnoutRate}%`}
                tone="green"
              />

              <CompactMetric
                label="Unassigned"
                value={formatNumber(stats.unassigned)}
                tone={stats.unassigned > 0 ? "red" : "green"}
              />

              <CompactMetric
                label="Pickup Issues"
                value={formatNumber(stats.pickupIssues)}
                tone={stats.pickupIssues > 0 ? "red" : "green"}
              />
            </div>

            <div className="mt-6 hidden gap-4 sm:grid sm:grid-cols-2 xl:grid-cols-4">
              <DesktopStatCard
                title="Total Voters"
                value={formatNumber(stats.total)}
                subtitle="Full register loaded."
                tone="slate"
              />

              <DesktopStatCard
                title="Confirmed Voted"
                value={formatNumber(stats.confirmedVoted)}
                subtitle={`${stats.confirmedTurnoutRate}% of confirmed supporters.`}
                tone="green"
              />

              <DesktopStatCard
                title="Pickup Not Voted"
                value={formatNumber(stats.confirmedPickupNotVoted)}
                subtitle="Confirmed supporters needing transport."
                tone="orange"
              />

              <DesktopStatCard
                title="Pickup Issues"
                value={formatNumber(stats.pickupIssues)}
                subtitle="Needs immediate attention."
                tone="red"
              />
            </div>
          </section>

          <div className="mt-4 grid gap-4 sm:mt-6 xl:grid-cols-2 xl:gap-6">
            <section className="rounded-3xl bg-white p-4 shadow sm:p-6">
              <SectionHeader
                title="Support Status"
                subtitle="Breakdown by current support status."
              />

              <div className="mt-4 space-y-3 sm:mt-6">
                {supportReport.map((item) => (
                  <ReportRow
                    key={item.status}
                    label={item.status}
                    value={item.total}
                    percent={item.percentage}
                    tone={
                      item.status === "Confirmed Supporter"
                        ? "green"
                        : item.status === "Leaning Supporter"
                        ? "purple"
                        : item.status === "Undecided"
                        ? "amber"
                        : item.status === "Not Supporting"
                        ? "red"
                        : "slate"
                    }
                  />
                ))}

                {supportReport.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 sm:p-8">
                    No support status data available.
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-3xl bg-white p-4 shadow sm:p-6">
              <SectionHeader
                title="Pickup Status"
                subtitle="Transportation and pickup breakdown."
              />

              <div className="mt-4 space-y-3 sm:mt-6">
                {pickupReport.map((item) => (
                  <ReportRow
                    key={item.status}
                    label={item.status}
                    value={item.total}
                    percent={item.percentage}
                    tone={
                      item.status === "Issue"
                        ? "red"
                        : item.status === "Completed"
                        ? "green"
                        : item.status === "No Pickup Needed"
                        ? "slate"
                        : "amber"
                    }
                  />
                ))}

                {pickupReport.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 sm:p-8">
                    No pickup status data available.
                  </div>
                )}
              </div>
            </section>
          </div>

          <section className="mt-4 rounded-3xl bg-white p-4 shadow sm:mt-6 sm:p-6">
            <SectionHeader
              title="Zone Report"
              subtitle="Compact zone performance on mobile, full table on desktop."
              action={
                <button
                  onClick={exportZoneReport}
                  className="hidden rounded-xl border border-slate-300 px-4 py-3 text-center text-sm font-bold text-slate-700 hover:bg-slate-50 sm:block"
                >
                  Export Zone CSV
                </button>
              }
            />

            <div className="mt-4 grid gap-3 lg:hidden">
              {zoneReport.map((item) => (
                <div
                  key={item.zone}
                  className="min-w-0 rounded-2xl border border-slate-200 p-3"
                >
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="break-words text-base font-black text-slate-900">
                        {item.zone}
                      </h3>
                      <p className="text-xs text-slate-500">
                        Total: {formatNumber(item.total)}
                      </p>
                    </div>

                    <span
                      className={`w-fit shrink-0 rounded-full px-2.5 py-1 text-[11px] font-black ${
                        item.pickupIssues > 0
                          ? "bg-red-100 text-red-800"
                          : "bg-green-100 text-green-800"
                      }`}
                    >
                      {item.pickupIssues > 0 ? `${item.pickupIssues} issue` : "OK"}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                    <div>
                      <p className="text-[11px] font-semibold text-slate-400">
                        Conf.
                      </p>
                      <p className="text-lg font-black text-green-700">
                        {formatNumber(item.confirmed)}
                      </p>
                    </div>

                    <div>
                      <p className="text-[11px] font-semibold text-slate-400">
                        Proj.
                      </p>
                      <p className="text-lg font-black text-blue-700">
                        {formatNumber(item.projected)}
                      </p>
                    </div>

                    <div>
                      <p className="text-[11px] font-semibold text-slate-400">
                        Rem.
                      </p>
                      <p className="text-lg font-black text-amber-700">
                        {formatNumber(item.confirmedRemaining)}
                      </p>
                    </div>

                    <div>
                      <p className="text-[11px] font-semibold text-slate-400">
                        Unasn.
                      </p>
                      <p className="text-lg font-black text-red-700">
                        {formatNumber(item.unassigned)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}

              {zoneReport.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
                  No zone data available.
                </div>
              )}
            </div>

            <div className="mt-6 hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[1050px] text-left text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-slate-600">
                    <th className="p-3">Zone</th>
                    <th className="p-3">Total</th>
                    <th className="p-3">Confirmed</th>
                    <th className="p-3">Leaning</th>
                    <th className="p-3">Projected</th>
                    <th className="p-3">Confirmed Voted</th>
                    <th className="p-3">Remaining</th>
                    <th className="p-3">Pickup</th>
                    <th className="p-3">Issues</th>
                    <th className="p-3">Unassigned</th>
                  </tr>
                </thead>

                <tbody>
                  {zoneReport.map((item) => (
                    <tr key={item.zone} className="border-b align-top">
                      <td className="p-3 font-black text-slate-900">
                        {item.zone}
                      </td>
                      <td className="p-3">{formatNumber(item.total)}</td>
                      <td className="p-3 font-bold text-green-700">
                        {formatNumber(item.confirmed)}
                      </td>
                      <td className="p-3 font-bold text-purple-700">
                        {formatNumber(item.leaning)}
                      </td>
                      <td className="p-3 font-bold text-blue-700">
                        {formatNumber(item.projected)}
                      </td>
                      <td className="p-3">{formatNumber(item.confirmedVoted)}</td>
                      <td className="p-3 font-bold text-amber-700">
                        {formatNumber(item.confirmedRemaining)}
                      </td>
                      <td className="p-3 font-bold text-orange-700">
                        {formatNumber(item.pickupNeeded)}
                      </td>
                      <td className="p-3 font-bold text-red-700">
                        {formatNumber(item.pickupIssues)}
                      </td>
                      <td className="p-3 font-bold text-red-700">
                        {formatNumber(item.unassigned)}
                      </td>
                    </tr>
                  ))}

                  {zoneReport.length === 0 && (
                    <tr>
                      <td
                        colSpan={10}
                        className="p-8 text-center text-slate-500"
                      >
                        No zone data available.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <div className="mt-4 grid gap-4 sm:mt-6 xl:grid-cols-2 xl:gap-6">
            <section className="rounded-3xl bg-white p-4 shadow sm:p-6">
              <SectionHeader
                title="Polling Areas"
                subtitle="Performance by polling area."
                action={
                  <button
                    onClick={exportPollingReport}
                    className="hidden rounded-xl border border-slate-300 px-4 py-3 text-center text-sm font-bold text-slate-700 hover:bg-slate-50 sm:block"
                  >
                    Export Polling CSV
                  </button>
                }
              />

              <div className="mt-4 space-y-3 sm:mt-6">
                {pollingReport.map((item) => {
                  const turnout = percentage(item.voted, item.total);

                  return (
                    <div
                      key={item.pollingArea}
                      className="rounded-2xl border border-slate-200 p-3 sm:p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-black text-slate-900">
                            Polling {item.pollingArea}
                          </p>
                          <p className="text-xs text-slate-500 sm:text-sm">
                            {formatNumber(item.confirmed)} confirmed ·{" "}
                            {formatNumber(item.confirmedRemaining)} remaining
                          </p>
                        </div>

                        <p className="shrink-0 text-xl font-black text-green-700 sm:text-2xl">
                          {turnout}%
                        </p>
                      </div>

                      <div className="mt-2 sm:mt-3">
                        <ProgressBar value={turnout} tone="green" />
                      </div>

                      <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs sm:mt-3">
                        <div className="rounded-xl bg-blue-50 p-2 text-blue-800">
                          Proj.{" "}
                          <span className="font-black">
                            {formatNumber(item.projected)}
                          </span>
                        </div>

                        <div className="rounded-xl bg-orange-50 p-2 text-orange-800">
                          Pick.{" "}
                          <span className="font-black">
                            {formatNumber(item.pickupNeeded)}
                          </span>
                        </div>

                        <div className="rounded-xl bg-red-50 p-2 text-red-800">
                          Issue{" "}
                          <span className="font-black">
                            {formatNumber(item.pickupIssues)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {pollingReport.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 sm:p-8">
                    No polling area data available.
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-3xl bg-white p-4 shadow sm:p-6">
              <SectionHeader
                title="Campaigners"
                subtitle="Campaigner contribution by assigned list."
                action={
                  <button
                    onClick={exportCampaignerReport}
                    className="hidden rounded-xl border border-slate-300 px-4 py-3 text-center text-sm font-bold text-slate-700 hover:bg-slate-50 sm:block"
                  >
                    Export Campaigner CSV
                  </button>
                }
              />

              <div className="mt-4 space-y-3 sm:mt-6">
                {campaignerReport.map((item, index) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-slate-200 p-3 sm:p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-black text-slate-900">
                          {index + 1}. {item.name}
                        </p>

                        <p className="text-xs text-slate-500 sm:text-sm">
                          {item.zone || "No zone"} ·{" "}
                          {formatNumber(item.assigned)} assigned ·{" "}
                          {formatNumber(item.pickupNeeded)} pickup
                        </p>
                      </div>

                      <div className="shrink-0 rounded-2xl bg-blue-50 px-3 py-2 text-right">
                        <p className="text-xl font-black text-blue-800">
                          {formatNumber(item.confirmed)}
                        </p>
                        <p className="text-[10px] font-bold uppercase text-blue-700">
                          Conf.
                        </p>
                      </div>
                    </div>
                  </div>
                ))}

                {campaignerReport.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 sm:p-8">
                    No campaigner report data available.
                  </div>
                )}
              </div>
            </section>
          </div>

          <div className="mt-4 grid gap-4 sm:mt-6 xl:grid-cols-2 xl:gap-6">
            <section className="rounded-3xl bg-white p-4 shadow sm:p-6">
              <SectionHeader
                title="Confirmed Not Voted"
                subtitle="Top records requiring turnout follow-up."
              />

              <div className="mt-4 space-y-3 sm:mt-6">
                {confirmedNotVotedList.map((voter) => (
                  <div
                    key={voter.id}
                    className="rounded-2xl border border-amber-200 bg-amber-50 p-3 sm:p-4"
                  >
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700">
                        {getRegNo(voter)}
                      </p>

                      <p className="mt-1 truncate text-base font-black text-slate-900 sm:text-lg">
                        {getDisplayName(voter)}
                      </p>

                      <p className="mt-1 text-xs text-slate-600 sm:text-sm">
                        Zone: {voter.zone || "No zone"} · Polling:{" "}
                        {voter.polling_area || "No polling area"}
                      </p>

                      <p className="mt-1 text-xs text-slate-600 sm:text-sm">
                        Campaigner:{" "}
                        {voter.campaigner_id
                          ? campaignerNameMap.get(voter.campaigner_id) ||
                            "Assigned"
                          : "Unassigned"}
                      </p>
                    </div>
                  </div>
                ))}

                {confirmedNotVotedList.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 sm:p-8">
                    No confirmed supporters pending turnout.
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-3xl bg-white p-4 shadow sm:p-6">
              <SectionHeader
                title="Pickup Risk"
                subtitle="Confirmed supporters needing pickup and not yet voted."
              />

              <div className="mt-4 space-y-3 sm:mt-6">
                {pickupRiskList.map((voter) => (
                  <div
                    key={voter.id}
                    className="rounded-2xl border border-orange-200 bg-orange-50 p-3 sm:p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-orange-700">
                          {getRegNo(voter)}
                        </p>

                        <p className="mt-1 truncate text-base font-black text-slate-900 sm:text-lg">
                          {getDisplayName(voter)}
                        </p>

                        <p className="mt-1 text-xs text-slate-600 sm:text-sm">
                          Zone: {voter.zone || "No zone"} · Polling:{" "}
                          {voter.polling_area || "No polling area"}
                        </p>
                      </div>

                      <span className="w-fit shrink-0 rounded-full bg-orange-200 px-2.5 py-1 text-[11px] font-black text-orange-900">
                        {getPickupStatus(voter)}
                      </span>
                    </div>
                  </div>
                ))}

                {pickupRiskList.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 sm:p-8">
                    No pickup risks at this time.
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </section>
    </main>
  );
}
