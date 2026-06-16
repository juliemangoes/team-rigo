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

type VoterSnapshot = {
  id: string;
  zone: string | null;
  polling_area: string | null;
  support_status: string | null;
  pickup_needed: boolean;
  pickup_status: string | null;
  voted: boolean;
  campaigner_id: string | null;
};

type Campaigner = {
  id: string;
  full_name: string;
  role: string | null;
  zone: string | null;
};

type IssueVoter = {
  id: string;
  voter_reg_no: string | null;
  voter_number: string | null;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  full_name: string;
  zone: string | null;
  polling_area: string | null;
  pickup_status: string | null;
  notes: string | null;
};

type ZoneSummary = {
  zone: string;
  total: number;
  confirmed: number;
  leaning: number;
  projected: number;
  confirmedVoted: number;
  confirmedRemaining: number;
  pickupNeeded: number;
  pickupIssues: number;
};

type PollingSummary = {
  pollingArea: string;
  total: number;
  confirmed: number;
  voted: number;
  pickupNeeded: number;
};

type CampaignerSummary = {
  id: string;
  name: string;
  zone: string | null;
  assigned: number;
  confirmed: number;
  votedConfirmed: number;
  pickupNeeded: number;
};

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

function getDisplayName(voter: IssueVoter) {
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

function getRegNo(voter: IssueVoter) {
  return voter.voter_reg_no || voter.voter_number || "No reg no.";
}

function getVictoryStatus(
  projectedVotes: number,
  confirmed: number,
  target: number
) {
  if (!target || target <= 0) {
    return {
      label: "Set Target",
      description: "Add your vote target in Campaign Setup.",
      tone: "slate",
    };
  }

  const projectedRate = projectedVotes / target;
  const confirmedRate = confirmed / target;

  if (confirmedRate >= 1) {
    return {
      label: "Strong Position",
      description: "Confirmed supporters meet or exceed the target.",
      tone: "green",
    };
  }

  if (projectedRate >= 1.15) {
    return {
      label: "Strong Lead",
      description: "Projected support is comfortably above the target.",
      tone: "green",
    };
  }

  if (projectedRate >= 1) {
    return {
      label: "On Track",
      description: "Projected support meets the target.",
      tone: "blue",
    };
  }

  if (projectedRate >= 0.9) {
    return {
      label: "Close Race",
      description: "Projected support is close, but still below target.",
      tone: "amber",
    };
  }

  if (projectedRate >= 0.75) {
    return {
      label: "At Risk",
      description: "The campaign needs more confirmed supporters.",
      tone: "orange",
    };
  }

  return {
    label: "Critical Gap",
    description: "Confirmed and projected support are far below target.",
    tone: "red",
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
  if (tone === "green") return "bg-green-500";
  if (tone === "blue") return "bg-blue-500";
  if (tone === "amber") return "bg-amber-500";
  if (tone === "orange") return "bg-orange-500";
  if (tone === "red") return "bg-red-500";

  return "bg-slate-500";
}

function textClass(tone: string) {
  if (tone === "green") return "text-green-700";
  if (tone === "blue") return "text-blue-700";
  if (tone === "amber") return "text-amber-700";
  if (tone === "orange") return "text-orange-700";
  if (tone === "red") return "text-red-700";
  if (tone === "purple") return "text-purple-700";

  return "text-slate-700";
}

function bgClass(tone: string) {
  if (tone === "green") return "bg-green-50";
  if (tone === "blue") return "bg-blue-50";
  if (tone === "amber") return "bg-amber-50";
  if (tone === "orange") return "bg-orange-50";
  if (tone === "red") return "bg-red-50";
  if (tone === "purple") return "bg-purple-50";

  return "bg-slate-50";
}

function ProgressBar({ value, tone = "blue" }: { value: number; tone?: string }) {
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
  action?: React.ReactNode;
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
  tone?: string;
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
  tone: string;
}) {
  return (
    <div
      className={`min-w-0 rounded-3xl border border-slate-200 p-5 shadow-sm ${bgClass(
        tone
      )}`}
    >
      <p className={`text-sm font-semibold ${textClass(tone)}`}>{title}</p>
      <h3 className="mt-2 break-words text-4xl font-black text-slate-900">
        {value}
      </h3>
      <p className="mt-2 text-sm text-slate-500">{subtitle}</p>
    </div>
  );
}

function ActionChip({
  href,
  label,
  primary,
}: {
  href: string;
  label: string;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`shrink-0 rounded-full px-4 py-2 text-sm font-black ${
        primary
          ? "bg-blue-700 text-white"
          : "border border-slate-200 bg-white text-slate-700"
      }`}
    >
      {label}
    </Link>
  );
}

export default function DashboardPage() {
  const [profile, setProfile] = useState<TeamProfile | null>(null);
  const [settings, setSettings] = useState<CampaignSettings | null>(null);
  const [setupZones, setSetupZones] = useState<CampaignZone[]>([]);
  const [setupPollingAreas, setSetupPollingAreas] = useState<PollingArea[]>([]);

  const [voters, setVoters] = useState<VoterSnapshot[]>([]);
  const [campaigners, setCampaigners] = useState<Campaigner[]>([]);
  const [issueVoters, setIssueVoters] = useState<IssueVoter[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
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

    const [
      settingsResult,
      zonesResult,
      pollingAreasResult,
      voterResult,
      campaignerResult,
      issueResult,
    ] = await Promise.all([
      supabase
        .from("campaign_settings")
        .select("id, election_name, vote_target_to_win")
        .eq("id", 1)
        .maybeSingle(),

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
        .from("voters")
        .select(
          `
          id,
          zone,
          polling_area,
          support_status,
          pickup_needed,
          pickup_status,
          voted,
          campaigner_id
        `
        )
        .range(0, 49999),

      supabase
        .from("campaigners")
        .select("id, full_name, role, zone")
        .order("full_name", { ascending: true }),

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
          zone,
          polling_area,
          pickup_status,
          notes
        `
        )
        .eq("pickup_status", "Issue")
        .order("last_name", { ascending: true, nullsFirst: false })
        .limit(8),
    ]);

    if (settingsResult.error) {
      console.error("Settings error:", settingsResult.error);
      setSettings(null);
    } else {
      setSettings(settingsResult.data || null);
    }

    if (zonesResult.error) {
      console.error("Zones error:", zonesResult.error);
      setSetupZones([]);
    } else {
      setSetupZones(zonesResult.data || []);
    }

    if (pollingAreasResult.error) {
      console.error("Polling areas error:", pollingAreasResult.error);
      setSetupPollingAreas([]);
    } else {
      setSetupPollingAreas(pollingAreasResult.data || []);
    }

    if (voterResult.error) {
      console.error("Dashboard voter error:", voterResult.error);
      setMessage("Error loading voter dashboard data.");
      setVoters([]);
    } else {
      setVoters(voterResult.data || []);
    }

    if (campaignerResult.error) {
      console.error("Dashboard campaigner error:", campaignerResult.error);
      setCampaigners([]);
    } else {
      setCampaigners(campaignerResult.data || []);
    }

    if (issueResult.error) {
      console.error("Issue voters error:", issueResult.error);
      setIssueVoters([]);
    } else {
      setIssueVoters(issueResult.data || []);
    }

    setLoading(false);
    setRefreshing(false);
  }

  const stats = useMemo(() => {
    const total = voters.length;
    const target = settings?.vote_target_to_win || 0;

    const confirmed = voters.filter(
      (voter) => voter.support_status === "Confirmed Supporter"
    ).length;

    const leaning = voters.filter(
      (voter) => voter.support_status === "Leaning Supporter"
    ).length;

    const undecided = voters.filter(
      (voter) => voter.support_status === "Undecided"
    ).length;

    const unknown = voters.filter(
      (voter) => !voter.support_status || voter.support_status === "Unknown"
    ).length;

    const pickupIssues = voters.filter(
      (voter) => voter.pickup_status === "Issue"
    ).length;

    const confirmedVoted = voters.filter(
      (voter) => voter.voted && voter.support_status === "Confirmed Supporter"
    ).length;

    const confirmedNotVoted = voters.filter(
      (voter) => !voter.voted && voter.support_status === "Confirmed Supporter"
    ).length;

    const confirmedPickupNotVoted = voters.filter(
      (voter) =>
        !voter.voted &&
        voter.pickup_needed &&
        voter.support_status === "Confirmed Supporter"
    ).length;

    const assigned = voters.filter((voter) => voter.campaigner_id).length;

    const projectedVotes = Math.round(confirmed + leaning * 0.5);
    const votesNeededFromConfirmed = Math.max(0, target - confirmed);
    const votesNeededFromProjected = Math.max(0, target - projectedVotes);
    const confirmedCushion = confirmed - target;
    const projectedCushion = projectedVotes - target;

    const victoryStatus = getVictoryStatus(projectedVotes, confirmed, target);

    return {
      total,
      target,
      confirmed,
      leaning,
      undecided,
      unknown,
      pickupIssues,
      confirmedVoted,
      confirmedNotVoted,
      confirmedPickupNotVoted,
      assigned,
      unassigned: total - assigned,
      projectedVotes,
      votesNeededFromConfirmed,
      votesNeededFromProjected,
      confirmedCushion,
      projectedCushion,
      victoryStatus,
      targetProgress: percentage(projectedVotes, target),
      confirmedProgress: percentage(confirmed, target),
      confirmedTurnoutRate: percentage(confirmedVoted, confirmed),
      assignmentRate: percentage(assigned, total),
    };
  }, [voters, settings]);

  const zoneSummary = useMemo(() => {
    const map = new Map<string, ZoneSummary>();

    setupZones.forEach((zone) => {
      map.set(zone.name, {
        zone: zone.name,
        total: 0,
        confirmed: 0,
        leaning: 0,
        projected: 0,
        confirmedVoted: 0,
        confirmedRemaining: 0,
        pickupNeeded: 0,
        pickupIssues: 0,
      });
    });

    voters.forEach((voter) => {
      const zone = voter.zone || "No Zone";

      if (!map.has(zone)) {
        map.set(zone, {
          zone,
          total: 0,
          confirmed: 0,
          leaning: 0,
          projected: 0,
          confirmedVoted: 0,
          confirmedRemaining: 0,
          pickupNeeded: 0,
          pickupIssues: 0,
        });
      }

      const item = map.get(zone)!;

      item.total += 1;

      if (voter.support_status === "Confirmed Supporter") {
        item.confirmed += 1;

        if (voter.voted) {
          item.confirmedVoted += 1;
        } else {
          item.confirmedRemaining += 1;
        }
      }

      if (voter.support_status === "Leaning Supporter") {
        item.leaning += 1;
      }

      if (voter.pickup_needed) {
        item.pickupNeeded += 1;
      }

      if (voter.pickup_status === "Issue") {
        item.pickupIssues += 1;
      }
    });

    const items = Array.from(map.values()).map((item) => ({
      ...item,
      projected: Math.round(item.confirmed + item.leaning * 0.5),
    }));

    return items.sort((a, b) => a.zone.localeCompare(b.zone));
  }, [voters, setupZones]);

  const pollingSummary = useMemo(() => {
    const map = new Map<string, PollingSummary>();

    setupPollingAreas.forEach((area) => {
      map.set(area.code, {
        pollingArea: area.code,
        total: 0,
        confirmed: 0,
        voted: 0,
        pickupNeeded: 0,
      });
    });

    voters.forEach((voter) => {
      const pollingArea = voter.polling_area || "No Polling Area";

      if (!map.has(pollingArea)) {
        map.set(pollingArea, {
          pollingArea,
          total: 0,
          confirmed: 0,
          voted: 0,
          pickupNeeded: 0,
        });
      }

      const item = map.get(pollingArea)!;

      item.total += 1;

      if (voter.support_status === "Confirmed Supporter") {
        item.confirmed += 1;
      }

      if (voter.voted) {
        item.voted += 1;
      }

      if (voter.pickup_needed) {
        item.pickupNeeded += 1;
      }
    });

    return Array.from(map.values()).sort((a, b) =>
      a.pollingArea.localeCompare(b.pollingArea)
    );
  }, [voters, setupPollingAreas]);

  const campaignerSummary = useMemo(() => {
    return campaigners
      .filter((person) => person.role === "Campaigner")
      .map((person) => {
        const assignedVoters = voters.filter(
          (voter) => voter.campaigner_id === person.id
        );

        const confirmed = assignedVoters.filter(
          (voter) => voter.support_status === "Confirmed Supporter"
        ).length;

        const votedConfirmed = assignedVoters.filter(
          (voter) =>
            voter.voted && voter.support_status === "Confirmed Supporter"
        ).length;

        const pickupNeeded = assignedVoters.filter(
          (voter) => voter.pickup_needed
        ).length;

        return {
          id: person.id,
          name: person.full_name,
          zone: person.zone,
          assigned: assignedVoters.length,
          confirmed,
          votedConfirmed,
          pickupNeeded,
        };
      })
      .sort((a, b) => b.confirmed - a.confirmed)
      .slice(0, 10);
  }, [campaigners, voters]);

  const teamStats = useMemo(() => {
    return {
      total: campaigners.length,
      managers: campaigners.filter(
        (person) => person.role === "Campaign Manager"
      ).length,
      zoneLeaders: campaigners.filter(
        (person) => person.role === "Zone Leader"
      ).length,
      campaigners: campaigners.filter((person) => person.role === "Campaigner")
        .length,
      drivers: campaigners.filter((person) => person.role === "Driver").length,
      scrutineers: campaigners.filter((person) => person.role === "Scrutineer")
        .length,
    };
  }, [campaigners]);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 p-4 sm:p-6">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-3xl bg-white p-6 text-center shadow">
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
              Team Rigo
            </p>

            <h1 className="mt-3 text-xl font-bold text-slate-900">
              Loading path to victory...
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
            This dashboard is restricted to the Campaign Manager.
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
                Path to Victory
              </h1>

              <p className="mt-2 max-w-3xl text-sm text-slate-300 sm:mt-3 sm:text-base">
                {settings?.election_name || "Team Rigo Campaign"} ·{" "}
                {profile?.full_name}
              </p>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1 sm:grid sm:w-auto sm:grid-cols-3 sm:overflow-visible sm:pb-0 xl:flex">
              <button
                onClick={loadDashboard}
                disabled={refreshing}
                className="shrink-0 rounded-full bg-white px-4 py-2 text-sm font-black text-slate-950 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60 sm:rounded-2xl sm:px-5 sm:py-3"
              >
                {refreshing ? "..." : "Refresh"}
              </button>

              <Link
                href="/campaign-setup"
                className="shrink-0 rounded-full border border-white/20 px-4 py-2 text-center text-sm font-black text-white hover:bg-white/10 sm:rounded-2xl sm:px-5 sm:py-3"
              >
                Setup
              </Link>

              <Link
                href="/voters"
                className="shrink-0 rounded-full bg-blue-600 px-4 py-2 text-center text-sm font-black text-white hover:bg-blue-700 sm:rounded-2xl sm:px-5 sm:py-3"
              >
                Voters
              </Link>
            </div>
          </div>

          {message && (
            <div className="mt-4 rounded-2xl border border-red-400/40 bg-red-500/10 p-3 text-sm font-semibold text-red-100 sm:mt-6">
              {message}
            </div>
          )}

          {stats.target <= 0 && (
            <div className="mt-4 rounded-2xl border border-amber-400/40 bg-amber-500/10 p-3 text-sm font-semibold text-amber-100 sm:mt-6">
              Vote target is not set. Go to Campaign Setup and enter the Vote
              Target to Win.
            </div>
          )}

          <div className="mt-4 rounded-3xl border border-white/10 bg-white/10 p-4 shadow-xl sm:mt-8 sm:p-6">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-300 sm:text-sm">
                  Win Status
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
                label="Need"
                value={formatNumber(stats.votesNeededFromProjected)}
                tone={stats.votesNeededFromProjected > 0 ? "red" : "green"}
              />

              <CompactMetric
                label="Leaning"
                value={formatNumber(stats.leaning)}
                tone="purple"
              />

              <CompactMetric
                label="Not Voted"
                value={formatNumber(stats.confirmedNotVoted)}
                tone="amber"
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
              subtitle={
                stats.confirmedCushion >= 0
                  ? `${formatNumber(stats.confirmedCushion)} above target`
                  : `${formatNumber(
                      stats.votesNeededFromConfirmed
                    )} more confirmed needed`
              }
            />

            <DesktopStatCard
              title="Projected Votes"
              value={formatNumber(stats.projectedVotes)}
              tone="blue"
              subtitle={
                stats.votesNeededFromProjected > 0
                  ? `${formatNumber(
                      stats.votesNeededFromProjected
                    )} projected votes short`
                  : "Projection meets the target"
              }
            />

            <DesktopStatCard
              title="Vote Target"
              value={formatNumber(stats.target)}
              tone="slate"
              subtitle="Set by Campaign Manager."
            />

            <DesktopStatCard
              title="Confirmed Not Voted"
              value={formatNumber(stats.confirmedNotVoted)}
              tone="amber"
              subtitle="Key turnout follow-up group."
            />
          </div>
        </div>
      </section>

      <section className="px-4 py-4 sm:px-6 sm:py-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-4 -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:hidden sm:px-0">
            <ActionChip href="/voters" label="Voters" primary />
            <ActionChip href="/campaigners" label="Field" />
            <ActionChip href="/team" label="Team" />
            <ActionChip href="/upload" label="Upload" />
            <ActionChip href="/campaign-setup" label="Setup" />
          </div>

          <div className="grid gap-4 xl:grid-cols-3 xl:gap-6">
            <section className="rounded-3xl bg-white p-4 shadow sm:p-6 xl:col-span-2">
              <SectionHeader
                title="Risk Snapshot"
                subtitle="Compact view of what needs attention."
                action={
                  <Link
                    href="/reports"
                    className="hidden rounded-xl border border-slate-300 px-4 py-3 text-center text-sm font-bold text-slate-700 hover:bg-slate-50 sm:block"
                  >
                    View Reports
                  </Link>
                }
              />

              <div className="mt-3 divide-y divide-slate-100 sm:hidden">
                <CompactMetric
                  label="Unassigned Voters"
                  value={formatNumber(stats.unassigned)}
                  tone={stats.unassigned > 0 ? "red" : "green"}
                />

                <CompactMetric
                  label="Pickup Issues"
                  value={formatNumber(stats.pickupIssues)}
                  tone={stats.pickupIssues > 0 ? "red" : "green"}
                />

                <CompactMetric
                  label="Pickup Not Voted"
                  value={formatNumber(stats.confirmedPickupNotVoted)}
                  tone="orange"
                />

                <CompactMetric
                  label="Unknown Status"
                  value={formatNumber(stats.unknown)}
                  tone="slate"
                />

                <CompactMetric
                  label="Undecided"
                  value={formatNumber(stats.undecided)}
                  tone="purple"
                />

                <CompactMetric
                  label="Assignment"
                  value={`${stats.assignmentRate}%`}
                  tone="blue"
                />
              </div>

              <div className="mt-6 hidden gap-4 sm:grid sm:grid-cols-2 lg:grid-cols-3">
                <DesktopStatCard
                  title="Unassigned Voters"
                  value={formatNumber(stats.unassigned)}
                  subtitle="Not assigned to a campaigner."
                  tone="red"
                />

                <DesktopStatCard
                  title="Pickup Issues"
                  value={formatNumber(stats.pickupIssues)}
                  subtitle="Requires immediate attention."
                  tone="amber"
                />

                <DesktopStatCard
                  title="Pickup Not Voted"
                  value={formatNumber(stats.confirmedPickupNotVoted)}
                  subtitle="Confirmed supporters needing transport."
                  tone="orange"
                />

                <DesktopStatCard
                  title="Unknown Status"
                  value={formatNumber(stats.unknown)}
                  subtitle="Needs classification."
                  tone="slate"
                />

                <DesktopStatCard
                  title="Undecided"
                  value={formatNumber(stats.undecided)}
                  subtitle="Not counted in projection."
                  tone="purple"
                />

                <DesktopStatCard
                  title="Assignment Coverage"
                  value={`${stats.assignmentRate}%`}
                  subtitle={`${formatNumber(stats.assigned)} assigned of ${formatNumber(
                    stats.total
                  )}.`}
                  tone="blue"
                />
              </div>
            </section>

            <section className="hidden rounded-3xl bg-white p-5 shadow sm:block sm:p-6">
              <h2 className="text-2xl font-black text-slate-900">
                Quick Actions
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Go directly to the work that affects the win number.
              </p>

              <div className="mt-6 grid gap-3">
                {[
                  ["Review voter support status", "/voters"],
                  ["Open field operation view", "/campaigners"],
                  ["Manage team access", "/team"],
                  ["Upload updated voter CSV", "/upload"],
                  ["Update vote target, zones, polling areas", "/campaign-setup"],
                ].map(([label, href]) => (
                  <Link
                    key={href}
                    href={href}
                    className="rounded-2xl border border-slate-200 p-4 font-bold text-slate-800 hover:border-blue-300 hover:bg-blue-50"
                  >
                    {label}
                  </Link>
                ))}
              </div>
            </section>
          </div>

          <section className="mt-4 rounded-3xl bg-white p-4 shadow sm:mt-6 sm:p-6">
            <SectionHeader
              title="Zone Battle Map"
              subtitle="Where support, turnout, and pickup risks are located."
            />

            <div className="mt-4 grid gap-3 lg:hidden">
              {zoneSummary.map((item) => (
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
                        Pick.
                      </p>
                      <p className="text-lg font-black text-orange-700">
                        {formatNumber(item.pickupNeeded)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}

              {zoneSummary.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
                  No zone data available.
                </div>
              )}
            </div>

            <div className="mt-6 hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-slate-600">
                    <th className="p-3">Zone</th>
                    <th className="p-3">Total</th>
                    <th className="p-3">Confirmed</th>
                    <th className="p-3">Leaning</th>
                    <th className="p-3">Projected</th>
                    <th className="p-3">Confirmed Voted</th>
                    <th className="p-3">Confirmed Remaining</th>
                    <th className="p-3">Pickup Needed</th>
                    <th className="p-3">Issues</th>
                  </tr>
                </thead>

                <tbody>
                  {zoneSummary.map((item) => (
                    <tr key={item.zone} className="border-b align-top">
                      <td className="p-3 font-black text-slate-900">
                        {item.zone}
                      </td>

                      <td className="p-3 text-slate-700">
                        {formatNumber(item.total)}
                      </td>

                      <td className="p-3 font-bold text-green-700">
                        {formatNumber(item.confirmed)}
                      </td>

                      <td className="p-3 font-bold text-purple-700">
                        {formatNumber(item.leaning)}
                      </td>

                      <td className="p-3 font-bold text-blue-700">
                        {formatNumber(item.projected)}
                      </td>

                      <td className="p-3 text-slate-700">
                        {formatNumber(item.confirmedVoted)}
                      </td>

                      <td className="p-3 font-bold text-amber-700">
                        {formatNumber(item.confirmedRemaining)}
                      </td>

                      <td className="p-3 font-bold text-orange-700">
                        {formatNumber(item.pickupNeeded)}
                      </td>

                      <td className="p-3">
                        {item.pickupIssues > 0 ? (
                          <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-black text-red-800">
                            {formatNumber(item.pickupIssues)}
                          </span>
                        ) : (
                          <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-black text-green-800">
                            0
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}

                  {zoneSummary.length === 0 && (
                    <tr>
                      <td
                        colSpan={9}
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
                subtitle="Turnout and pickup needs by polling area."
              />

              <div className="mt-4 space-y-3 sm:mt-6 sm:space-y-4">
                {pollingSummary.map((item) => {
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
                            {formatNumber(item.pickupNeeded)} pickup
                          </p>
                        </div>

                        <p className="shrink-0 text-xl font-black text-green-700 sm:text-2xl">
                          {turnout}%
                        </p>
                      </div>

                      <div className="mt-2 sm:mt-3">
                        <ProgressBar value={turnout} tone="green" />
                      </div>
                    </div>
                  );
                })}

                {pollingSummary.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
                    No polling area data available.
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-3xl bg-white p-4 shadow sm:p-6">
              <SectionHeader
                title="Campaigners"
                subtitle="Ranked by confirmed supporters assigned."
              />

              <div className="mt-4 space-y-3 sm:mt-6">
                {campaignerSummary.map((item, index) => (
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
                          {formatNumber(item.votedConfirmed)} voted ·{" "}
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

                {campaignerSummary.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
                    No campaigner assignments found.
                  </div>
                )}
              </div>
            </section>
          </div>

          <div className="mt-4 grid gap-4 sm:mt-6 xl:grid-cols-2 xl:gap-6">
            <section className="rounded-3xl bg-white p-4 shadow sm:p-6">
              <SectionHeader
                title="Pickup Issues"
                subtitle="Voters currently marked with pickup issues."
                action={
                  <Link
                    href="/campaigners"
                    className="hidden rounded-xl border border-slate-300 px-4 py-3 text-center text-sm font-bold text-slate-700 hover:bg-slate-50 sm:block"
                  >
                    Open Field View
                  </Link>
                }
              />

              <div className="mt-4 space-y-3 sm:mt-6">
                {issueVoters.map((voter) => (
                  <div
                    key={voter.id}
                    className="rounded-2xl border border-amber-200 bg-amber-50 p-3 sm:p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
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
                      </div>

                      <span className="w-fit shrink-0 rounded-full bg-amber-200 px-2.5 py-1 text-[11px] font-black text-amber-900">
                        Issue
                      </span>
                    </div>
                  </div>
                ))}

                {issueVoters.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 sm:p-8">
                    No pickup issues at this time.
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-3xl bg-white p-4 shadow sm:p-6">
              <SectionHeader
                title="Team"
                subtitle="Active team members by role."
              />

              <div className="mt-4 grid grid-cols-3 gap-2 sm:mt-6 sm:grid-cols-2 sm:gap-4">
                {[
                  ["Total", teamStats.total, "slate"],
                  ["Leaders", teamStats.zoneLeaders, "purple"],
                  ["Field", teamStats.campaigners, "green"],
                  ["Drivers", teamStats.drivers, "amber"],
                  ["Scrut.", teamStats.scrutineers, "red"],
                  ["Mgrs.", teamStats.managers, "blue"],
                ].map(([label, value, tone]) => (
                  <div
                    key={label as string}
                    className={`rounded-2xl p-3 text-center sm:p-5 ${bgClass(
                      tone as string
                    )}`}
                  >
                    <p className={`text-xs font-bold ${textClass(tone as string)}`}>
                      {label}
                    </p>
                    <h3 className="mt-1 text-2xl font-black text-slate-900 sm:text-3xl">
                      {formatNumber(value as number)}
                    </h3>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </section>
    </main>
  );
}
