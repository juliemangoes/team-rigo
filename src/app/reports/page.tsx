"use client";

import Link from "next/link";
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

type SupportReport = {
  status: string;
  total: number;
  percentage: number;
};

type PickupReport = {
  status: string;
  total: number;
  percentage: number;
};

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
      tone: "slate",
      description: "Add a vote target in Campaign Setup.",
    };
  }

  const projectedRate = projectedVotes / target;
  const confirmedRate = confirmed / target;

  if (confirmedRate >= 1) {
    return {
      label: "Strong Position",
      tone: "green",
      description: "Confirmed supporters meet or exceed the target.",
    };
  }

  if (projectedRate >= 1.15) {
    return {
      label: "Strong Lead",
      tone: "green",
      description: "Projected vote strength is comfortably above target.",
    };
  }

  if (projectedRate >= 1) {
    return {
      label: "On Track",
      tone: "blue",
      description: "Projected vote strength meets the target.",
    };
  }

  if (projectedRate >= 0.9) {
    return {
      label: "Close Race",
      tone: "amber",
      description: "Projected vote strength is close but below target.",
    };
  }

  if (projectedRate >= 0.75) {
    return {
      label: "At Risk",
      tone: "orange",
      description: "More confirmed supporters are needed.",
    };
  }

  return {
    label: "Critical Gap",
    tone: "red",
    description: "Confirmed and projected support are far below target.",
  };
}

function badgeClass(tone: string) {
  if (tone === "green") return "bg-green-100 text-green-800";
  if (tone === "blue") return "bg-blue-100 text-blue-800";
  if (tone === "amber") return "bg-amber-100 text-amber-800";
  if (tone === "orange") return "bg-orange-100 text-orange-800";
  if (tone === "red") return "bg-red-100 text-red-800";

  return "bg-slate-100 text-slate-800";
}

function progressClass(tone: string) {
  if (tone === "green") return "bg-green-600";
  if (tone === "blue") return "bg-blue-600";
  if (tone === "amber") return "bg-amber-500";
  if (tone === "orange") return "bg-orange-500";
  if (tone === "red") return "bg-red-600";

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

function ProgressBar({
  value,
  tone = "blue",
}: {
  value: number;
  tone?: string;
}) {
  return (
    <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200">
      <div
        className={`h-3 rounded-full ${progressClass(tone)}`}
        style={{ width: `${clampPercentage(value)}%` }}
      />
    </div>
  );
}

function SummaryCard({
  title,
  value,
  subtitle,
  tone,
}: {
  title: string;
  value: string | number;
  subtitle: string;
  tone: "slate" | "blue" | "green" | "amber" | "red" | "purple" | "orange";
}) {
  const colors = {
    slate: "bg-white text-slate-900 border-slate-200",
    blue: "bg-blue-50 text-blue-900 border-blue-100",
    green: "bg-green-50 text-green-900 border-green-100",
    amber: "bg-amber-50 text-amber-900 border-amber-100",
    red: "bg-red-50 text-red-900 border-red-100",
    purple: "bg-purple-50 text-purple-900 border-purple-100",
    orange: "bg-orange-50 text-orange-900 border-orange-100",
  };

  return (
    <div className={`min-w-0 rounded-3xl border p-5 shadow-sm ${colors[tone]}`}>
      <p className="text-sm opacity-80">{title}</p>
      <h3 className="mt-2 break-words text-3xl font-black sm:text-4xl">
        {value}
      </h3>
      <p className="mt-2 text-sm opacity-80">{subtitle}</p>
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
  action?: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h2 className="break-words text-2xl font-black text-slate-900">
          {title}
        </h2>
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      </div>

      {action && <div className="shrink-0">{action}</div>}
    </div>
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

    const pickupNeeded = voters.filter((voter) => voter.pickup_needed).length;

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
      pickupNeeded,
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
          <div className="rounded-3xl bg-white p-8 text-center shadow">
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
              Team Rigo
            </p>

            <h1 className="mt-3 text-2xl font-bold text-slate-900">
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
      <section className="bg-slate-950 px-4 py-6 text-white sm:px-6 sm:py-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex min-w-0 flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-300 sm:text-sm sm:tracking-[0.3em]">
                Team Rigo
              </p>

              <h1 className="mt-3 break-words text-3xl font-black tracking-tight sm:text-4xl md:text-5xl">
                Campaign Reports
              </h1>

              <p className="mt-3 max-w-3xl text-sm text-slate-300 sm:text-base">
                Review campaign performance by vote target, support status,
                zones, polling areas, campaigners, pickup needs, and turnout.
              </p>

              <p className="mt-3 break-words text-xs text-slate-400 sm:text-sm">
                {settings?.election_name || "Team Rigo Campaign"} · Logged in
                as {profile?.full_name}
              </p>
            </div>

            <div className="grid w-full gap-3 sm:w-auto sm:grid-cols-3 xl:flex xl:flex-wrap">
              <button
                onClick={loadReports}
                disabled={refreshing}
                className="rounded-2xl bg-white px-5 py-3 text-sm font-bold text-slate-950 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {refreshing ? "Refreshing..." : "Refresh"}
              </button>

              <Link
                href="/dashboard"
                className="rounded-2xl border border-white/20 px-5 py-3 text-center text-sm font-bold text-white hover:bg-white/10"
              >
                Dashboard
              </Link>

              <button
                onClick={exportFullVoterReport}
                className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-700"
              >
                Export Voters
              </button>
            </div>
          </div>

          {message && (
            <div className="mt-6 rounded-2xl border border-red-400/40 bg-red-500/10 p-4 text-sm font-semibold text-red-100">
              {message}
            </div>
          )}

          <div className="mt-8 grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
            <div className="min-w-0 rounded-3xl border border-white/10 bg-white/10 p-5 shadow-xl sm:p-6 lg:col-span-2">
              <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm text-slate-300">Victory Report</p>

                  <h2 className="mt-3 break-words text-4xl font-black sm:text-5xl">
                    {stats.victoryStatus.label}
                  </h2>

                  <p className="mt-3 max-w-xl text-sm text-slate-300">
                    {stats.victoryStatus.description}
                  </p>
                </div>

                <span
                  className={`w-fit shrink-0 rounded-full px-4 py-2 text-sm font-black ${badgeClass(
                    stats.victoryStatus.tone
                  )}`}
                >
                  {stats.projectedCushion >= 0
                    ? `+${formatNumber(stats.projectedCushion)}`
                    : `${formatNumber(stats.projectedCushion)}`}{" "}
                  projected
                </span>
              </div>

              <div className="mt-6">
                <div className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-slate-300">
                    Projected Vote Strength
                  </span>
                  <span className="font-bold text-white">
                    {formatNumber(stats.projectedVotes)} /{" "}
                    {formatNumber(stats.target)}
                  </span>
                </div>

                <div className="mt-3 h-4 overflow-hidden rounded-full bg-white/10">
                  <div
                    className={`h-4 rounded-full ${progressClass(
                      stats.victoryStatus.tone
                    )}`}
                    style={{
                      width: `${clampPercentage(stats.targetProgress)}%`,
                    }}
                  />
                </div>

                <p className="mt-3 text-xs text-slate-400">
                  Projection uses confirmed supporters plus 50% of leaning
                  supporters. This is an estimate, not a record of how anyone
                  voted.
                </p>
              </div>
            </div>

            <div className="rounded-3xl border border-green-400/30 bg-green-500/10 p-5 shadow-xl sm:p-6">
              <p className="text-sm text-green-200">Confirmed Supporters</p>
              <h2 className="mt-3 text-4xl font-black sm:text-5xl">
                {formatNumber(stats.confirmed)}
              </h2>
              <p className="mt-3 text-sm text-green-100">
                {formatNumber(stats.votesNeededFromConfirmed)} more confirmed
                needed.
              </p>
            </div>

            <div className="rounded-3xl border border-blue-400/30 bg-blue-500/10 p-5 shadow-xl sm:p-6">
              <p className="text-sm text-blue-200">Projected Votes</p>
              <h2 className="mt-3 text-4xl font-black sm:text-5xl">
                {formatNumber(stats.projectedVotes)}
              </h2>
              <p className="mt-3 text-sm text-blue-100">
                {formatNumber(stats.votesNeededFromProjected)} projected votes
                short.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-6 sm:px-6 sm:py-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              title="Total Voters"
              value={formatNumber(stats.total)}
              subtitle="Full register loaded."
              tone="slate"
            />

            <SummaryCard
              title="Confirmed Not Voted"
              value={formatNumber(stats.confirmedNotVoted)}
              subtitle="Main election-day follow-up group."
              tone="amber"
            />

            <SummaryCard
              title="Confirmed Pickup Not Voted"
              value={formatNumber(stats.confirmedPickupNotVoted)}
              subtitle="Needs transport follow-up."
              tone="orange"
            />

            <SummaryCard
              title="Assignment Coverage"
              value={`${stats.assignmentRate}%`}
              subtitle={`${formatNumber(stats.assigned)} assigned voters.`}
              tone="blue"
            />
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            <section className="rounded-3xl bg-white p-5 shadow sm:p-6">
              <SectionHeader
                title="Support Status Report"
                subtitle="Breakdown of voters by current campaign support status."
              />

              <div className="mt-6 space-y-4">
                {supportReport.map((item) => (
                  <div
                    key={item.status}
                    className="rounded-2xl border border-slate-200 p-4"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="break-words font-black text-slate-900">
                          {item.status}
                        </p>
                        <p className="text-sm text-slate-500">
                          {formatNumber(item.total)} voters
                        </p>
                      </div>

                      <p className="text-2xl font-black text-blue-700">
                        {item.percentage}%
                      </p>
                    </div>

                    <div className="mt-3">
                      <ProgressBar value={item.percentage} tone="blue" />
                    </div>
                  </div>
                ))}

                {supportReport.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
                    No support status data available.
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-3xl bg-white p-5 shadow sm:p-6">
              <SectionHeader
                title="Pickup Status Report"
                subtitle="Breakdown of voters by transportation and pickup status."
              />

              <div className="mt-6 space-y-4">
                {pickupReport.map((item) => (
                  <div
                    key={item.status}
                    className="rounded-2xl border border-slate-200 p-4"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="break-words font-black text-slate-900">
                          {item.status}
                        </p>
                        <p className="text-sm text-slate-500">
                          {formatNumber(item.total)} voters
                        </p>
                      </div>

                      <p
                        className={`text-2xl font-black ${
                          item.status === "Issue"
                            ? "text-red-700"
                            : "text-amber-700"
                        }`}
                      >
                        {item.percentage}%
                      </p>
                    </div>

                    <div className="mt-3">
                      <ProgressBar
                        value={item.percentage}
                        tone={item.status === "Issue" ? "red" : "amber"}
                      />
                    </div>
                  </div>
                ))}

                {pickupReport.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
                    No pickup status data available.
                  </div>
                )}
              </div>
            </section>
          </div>

          <section className="mt-6 rounded-3xl bg-white p-5 shadow sm:p-6">
            <SectionHeader
              title="Zone Report"
              subtitle="Mobile cards on phones, full table on desktop."
              action={
                <button
                  onClick={exportZoneReport}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-center text-sm font-bold text-slate-700 hover:bg-slate-50 sm:w-auto"
                >
                  Export Zone CSV
                </button>
              }
            />

            <div className="mt-6 grid gap-4 lg:hidden">
              {zoneReport.map((item) => (
                <div
                  key={item.zone}
                  className="rounded-2xl border border-slate-200 p-4"
                >
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="break-words text-xl font-black text-slate-900">
                        {item.zone}
                      </h3>
                      <p className="text-sm text-slate-500">
                        Total voters: {formatNumber(item.total)}
                      </p>
                    </div>

                    <span
                      className={`w-fit shrink-0 rounded-full px-3 py-1 text-xs font-black ${
                        item.pickupIssues > 0
                          ? "bg-red-100 text-red-800"
                          : "bg-green-100 text-green-800"
                      }`}
                    >
                      {item.pickupIssues > 0
                        ? `${item.pickupIssues} issue(s)`
                        : "No issues"}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-green-50 p-3">
                      <p className="text-xs font-semibold text-green-700">
                        Confirmed
                      </p>
                      <p className="mt-1 text-2xl font-black text-green-800">
                        {formatNumber(item.confirmed)}
                      </p>
                    </div>

                    <div className="rounded-xl bg-purple-50 p-3">
                      <p className="text-xs font-semibold text-purple-700">
                        Leaning
                      </p>
                      <p className="mt-1 text-2xl font-black text-purple-800">
                        {formatNumber(item.leaning)}
                      </p>
                    </div>

                    <div className="rounded-xl bg-blue-50 p-3">
                      <p className="text-xs font-semibold text-blue-700">
                        Projected
                      </p>
                      <p className="mt-1 text-2xl font-black text-blue-800">
                        {formatNumber(item.projected)}
                      </p>
                    </div>

                    <div className="rounded-xl bg-amber-50 p-3">
                      <p className="text-xs font-semibold text-amber-700">
                        Remaining
                      </p>
                      <p className="mt-1 text-2xl font-black text-amber-800">
                        {formatNumber(item.confirmedRemaining)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-2 text-sm text-slate-700">
                    <div className="flex justify-between gap-4">
                      <span>Confirmed Voted</span>
                      <span className="font-bold">
                        {formatNumber(item.confirmedVoted)}
                      </span>
                    </div>

                    <div className="flex justify-between gap-4">
                      <span>Pickup Needed</span>
                      <span className="font-bold text-orange-700">
                        {formatNumber(item.pickupNeeded)}
                      </span>
                    </div>

                    <div className="flex justify-between gap-4">
                      <span>Unassigned</span>
                      <span className="font-bold text-red-700">
                        {formatNumber(item.unassigned)}
                      </span>
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

          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            <section className="rounded-3xl bg-white p-5 shadow sm:p-6">
              <SectionHeader
                title="Polling Area Report"
                subtitle="Performance by polling area."
                action={
                  <button
                    onClick={exportPollingReport}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-center text-sm font-bold text-slate-700 hover:bg-slate-50 sm:w-auto"
                  >
                    Export Polling CSV
                  </button>
                }
              />

              <div className="mt-6 space-y-4">
                {pollingReport.map((item) => {
                  const turnout = percentage(item.voted, item.total);

                  return (
                    <div
                      key={item.pollingArea}
                      className="rounded-2xl border border-slate-200 p-4"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="break-words font-black text-slate-900">
                            Polling Area {item.pollingArea}
                          </p>
                          <p className="text-sm text-slate-500">
                            {formatNumber(item.confirmed)} confirmed ·{" "}
                            {formatNumber(item.pickupNeeded)} pickup needed
                          </p>
                        </div>

                        <p className="text-2xl font-black text-green-700">
                          {turnout}%
                        </p>
                      </div>

                      <div className="mt-3">
                        <ProgressBar value={turnout} tone="green" />
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                        <div className="rounded-xl bg-blue-50 p-3 text-blue-800">
                          Projected:{" "}
                          <span className="font-black">
                            {formatNumber(item.projected)}
                          </span>
                        </div>

                        <div className="rounded-xl bg-amber-50 p-3 text-amber-800">
                          Remaining:{" "}
                          <span className="font-black">
                            {formatNumber(item.confirmedRemaining)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {pollingReport.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
                    No polling area data available.
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-3xl bg-white p-5 shadow sm:p-6">
              <SectionHeader
                title="Campaigner Report"
                subtitle="Campaigner contribution by assigned voter list."
                action={
                  <button
                    onClick={exportCampaignerReport}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-center text-sm font-bold text-slate-700 hover:bg-slate-50 sm:w-auto"
                  >
                    Export Campaigner CSV
                  </button>
                }
              />

              <div className="mt-6 space-y-3">
                {campaignerReport.map((item, index) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-slate-200 p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="break-words font-black text-slate-900">
                          {index + 1}. {item.name}
                        </p>

                        <p className="text-sm text-slate-500">
                          {item.zone || "No zone assigned"}
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          {formatNumber(item.assigned)} assigned ·{" "}
                          {formatNumber(item.confirmedVoted)} confirmed voted ·{" "}
                          {formatNumber(item.pickupNeeded)} pickup needed
                        </p>
                      </div>

                      <div className="w-full rounded-2xl bg-blue-50 px-4 py-2 text-left sm:w-auto sm:text-right">
                        <p className="text-2xl font-black text-blue-800">
                          {formatNumber(item.confirmed)}
                        </p>
                        <p className="text-xs font-bold text-blue-700">
                          Confirmed
                        </p>
                      </div>
                    </div>
                  </div>
                ))}

                {campaignerReport.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
                    No campaigner report data available.
                  </div>
                )}
              </div>
            </section>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            <section className="rounded-3xl bg-white p-5 shadow sm:p-6">
              <SectionHeader
                title="Confirmed Supporters Not Yet Voted"
                subtitle="Top records requiring turnout follow-up."
              />

              <div className="mt-6 space-y-3">
                {confirmedNotVotedList.map((voter) => (
                  <div
                    key={voter.id}
                    className="rounded-2xl border border-amber-200 bg-amber-50 p-4"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold uppercase tracking-wide text-amber-700">
                        {getRegNo(voter)}
                      </p>

                      <p className="mt-1 break-words text-lg font-black text-slate-900">
                        {getDisplayName(voter)}
                      </p>

                      <p className="mt-1 text-sm text-slate-600">
                        Zone: {voter.zone || "No zone"} · Polling:{" "}
                        {voter.polling_area || "No polling area"}
                      </p>

                      <p className="mt-1 text-sm text-slate-600">
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
                  <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
                    No confirmed supporters pending turnout.
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-3xl bg-white p-5 shadow sm:p-6">
              <SectionHeader
                title="Pickup Risk List"
                subtitle="Confirmed supporters who need pickup and have not voted yet."
              />

              <div className="mt-6 space-y-3">
                {pickupRiskList.map((voter) => (
                  <div
                    key={voter.id}
                    className="rounded-2xl border border-orange-200 bg-orange-50 p-4"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-xs font-bold uppercase tracking-wide text-orange-700">
                          {getRegNo(voter)}
                        </p>

                        <p className="mt-1 break-words text-lg font-black text-slate-900">
                          {getDisplayName(voter)}
                        </p>

                        <p className="mt-1 text-sm text-slate-600">
                          Zone: {voter.zone || "No zone"} · Polling:{" "}
                          {voter.polling_area || "No polling area"}
                        </p>

                        <p className="mt-1 text-sm text-slate-600">
                          Status: {getPickupStatus(voter)}
                        </p>
                      </div>

                      <span className="w-fit shrink-0 rounded-full bg-orange-200 px-3 py-1 text-xs font-black text-orange-900">
                        Pickup
                      </span>
                    </div>
                  </div>
                ))}

                {pickupRiskList.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
                    No pickup risks at this time.
                  </div>
                )}
              </div>
            </section>
          </div>

          <section className="mt-6 rounded-3xl bg-white p-5 shadow sm:p-6">
            <SectionHeader
              title="Export Center"
              subtitle="Download CSV reports for external review, printing, or backup."
            />

            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <button
                onClick={exportFullVoterReport}
                className="rounded-2xl bg-blue-700 px-5 py-4 text-sm font-bold text-white hover:bg-blue-800"
              >
                Export Full Voter Report
              </button>

              <button
                onClick={exportZoneReport}
                className="rounded-2xl border border-slate-300 px-5 py-4 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                Export Zone Report
              </button>

              <button
                onClick={exportPollingReport}
                className="rounded-2xl border border-slate-300 px-5 py-4 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                Export Polling Report
              </button>

              <button
                onClick={exportCampaignerReport}
                className="rounded-2xl border border-slate-300 px-5 py-4 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                Export Campaigner Report
              </button>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
