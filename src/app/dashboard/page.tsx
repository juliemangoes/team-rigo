"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

const OUR_NAME = "Team Rigo";

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

type Competitor = {
  id: string;
  name: string;
  description: string | null;
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

type ZoneSummary = {
  zone: string;
  total: number;
  confirmed: number;
  leaning: number;
  projected: number;
  opponent: number;
  undecidedUnknown: number;
  margin: number;
  votedTeam: number;
  votedOpponent: number;
  confirmedLeft: number;
  pickupNeeded: number;
  issues: number;
};

type PollingSummary = {
  pollingArea: string;
  total: number;
  projected: number;
  opponent: number;
  voted: number;
  confirmedLeft: number;
};

type Tone = "sky" | "green" | "red" | "amber" | "purple" | "slate";

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(Math.round(value) || 0);
}

function formatSigned(value: number) {
  return value >= 0
    ? `+${formatNumber(value)}`
    : `-${formatNumber(Math.abs(value))}`;
}

function percentage(value: number, total: number) {
  if (!total || total <= 0) return 0;
  return Math.round((value / total) * 100);
}

function clamp(value: number, min = 0, max = 100) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function isConfirmed(status: string | null) {
  return status === "Confirmed Supporter";
}

function isLeaning(status: string | null) {
  return status === "Leaning Supporter";
}

function isTeamSupport(status: string | null) {
  return isConfirmed(status) || isLeaning(status);
}

function isOpponent(status: string | null) {
  return status === "Not Supporting";
}

function isUndecidedUnknown(status: string | null) {
  return !status || status === "Unknown" || status === "Undecided";
}

function toneClass(tone: Tone) {
  if (tone === "sky") {
    return {
      card: "border-sky-100 bg-sky-50 text-sky-800",
      text: "text-sky-700",
      bar: "bg-sky-500",
      icon: "bg-sky-100 text-sky-700",
    };
  }

  if (tone === "green") {
    return {
      card: "border-green-100 bg-green-50 text-green-800",
      text: "text-green-700",
      bar: "bg-green-500",
      icon: "bg-green-100 text-green-700",
    };
  }

  if (tone === "red") {
    return {
      card: "border-red-100 bg-red-50 text-red-800",
      text: "text-red-700",
      bar: "bg-red-500",
      icon: "bg-red-100 text-red-700",
    };
  }

  if (tone === "amber") {
    return {
      card: "border-amber-100 bg-amber-50 text-amber-800",
      text: "text-amber-700",
      bar: "bg-amber-400",
      icon: "bg-amber-100 text-amber-700",
    };
  }

  if (tone === "purple") {
    return {
      card: "border-purple-100 bg-purple-50 text-purple-800",
      text: "text-purple-700",
      bar: "bg-purple-500",
      icon: "bg-purple-100 text-purple-700",
    };
  }

  return {
    card: "border-slate-200 bg-white text-slate-900",
    text: "text-slate-700",
    bar: "bg-slate-500",
    icon: "bg-slate-100 text-slate-700",
  };
}

function getStatus(projected: number, confirmed: number, opponent: number, target: number) {
  if (!target || target <= 0) {
    return {
      label: "Set Target",
      tone: "amber" as Tone,
      headline: "Vote target is not set",
      note: "Add a target in Campaign Setup so the dashboard can show a clear win position.",
    };
  }

  const margin = projected - opponent;

  if (confirmed >= target && margin > 0) {
    return {
      label: "Strong",
      tone: "green" as Tone,
      headline: `Confirmed support is above target`,
      note: `Confirmed voters are already ${formatSigned(confirmed - target)} against the target.`,
    };
  }

  if (projected >= target && margin > 0) {
    return {
      label: "Ahead",
      tone: "green" as Tone,
      headline: `Projected lead of ${formatSigned(margin)}`,
      note: `${OUR_NAME} is projected above target and ahead of the opponent estimate.`,
    };
  }

  if (margin < 0) {
    return {
      label: "Behind",
      tone: "red" as Tone,
      headline: `Behind by ${formatNumber(Math.abs(margin))}`,
      note: "Opponent estimate is ahead. Focus on confirming supporters and turnout.",
    };
  }

  if (projected >= target * 0.9) {
    return {
      label: "Close",
      tone: "amber" as Tone,
      headline: `${formatNumber(Math.max(0, target - projected))} more projected votes needed`,
      note: "The campaign is close to the target. Keep confirming leaning and undecided voters.",
    };
  }

  return {
    label: "Needs Work",
    tone: "amber" as Tone,
    headline: `${formatNumber(Math.max(0, target - projected))} projected votes short`,
    note: "More confirmed supporters are needed to reach the win target.",
  };
}

function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5 ${className}`}
    >
      {children}
    </section>
  );
}

function MiniMetric({
  label,
  value,
  detail,
  tone = "slate",
  icon,
}: {
  label: string;
  value: string | number;
  detail?: string;
  tone?: Tone;
  icon?: string;
}) {
  const t = toneClass(tone);

  return (
    <div className="rounded-[1.6rem] border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-wide text-slate-400">
            {label}
          </p>
          <p className={`mt-2 text-2xl font-black tracking-tight ${t.text}`}>
            {value}
          </p>
        </div>

        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-lg font-black ${t.icon}`}
        >
          {icon || "•"}
        </div>
      </div>

      {detail && <p className="mt-2 text-xs font-semibold text-slate-500">{detail}</p>}
    </div>
  );
}

function ProgressBar({
  value,
  total,
  tone = "sky",
}: {
  value: number;
  total: number;
  tone?: Tone;
}) {
  const width = clamp(percentage(value, total));
  const t = toneClass(tone);

  return (
    <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
      <div className={`h-2.5 rounded-full ${t.bar}`} style={{ width: `${width}%` }} />
    </div>
  );
}

function SectionHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div>
      <h2 className="text-xl font-black tracking-tight text-slate-950">{title}</h2>
      {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
    </div>
  );
}

function AppListItem({
  icon,
  title,
  subtitle,
  value,
  tone = "slate",
}: {
  icon: string;
  title: string;
  subtitle: string;
  value: string | number;
  tone?: Tone;
}) {
  const t = toneClass(tone);

  return (
    <div className="flex items-center gap-3 rounded-[1.5rem] bg-white p-3 shadow-sm ring-1 ring-slate-100">
      <div
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-lg font-black ${t.icon}`}
      >
        {icon}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate font-black text-slate-950">{title}</p>
        <p className="truncate text-xs font-semibold text-slate-500">{subtitle}</p>
      </div>

      <p className={`shrink-0 text-lg font-black ${t.text}`}>{value}</p>
    </div>
  );
}

function DonutMetric({
  percentageValue,
  center,
  label,
}: {
  percentageValue: number;
  center: string;
  label: string;
}) {
  const safeValue = clamp(percentageValue);

  return (
    <div className="relative mx-auto flex h-48 w-48 items-center justify-center">
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(#0ea5e9 ${safeValue}%, #e2e8f0 ${safeValue}% 100%)`,
        }}
      />
      <div className="absolute inset-5 rounded-full bg-white shadow-inner" />
      <div className="relative text-center">
        <p className="text-3xl font-black tracking-tight text-slate-950">{center}</p>
        <p className="mt-1 text-xs font-bold text-slate-500">{label}</p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [profile, setProfile] = useState<TeamProfile | null>(null);
  const [settings, setSettings] = useState<CampaignSettings | null>(null);
  const [zones, setZones] = useState<CampaignZone[]>([]);
  const [pollingAreas, setPollingAreas] = useState<PollingArea[]>([]);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [voters, setVoters] = useState<VoterSnapshot[]>([]);
  const [campaigners, setCampaigners] = useState<Campaigner[]>([]);

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
      pollingResult,
      competitorsResult,
      votersResult,
      campaignersResult,
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
        .from("competitors")
        .select("id, name, description, display_order")
        .order("display_order", { ascending: true })
        .order("name", { ascending: true }),

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
    ]);

    if (settingsResult.error) {
      console.error("Settings error:", settingsResult.error);
      setSettings(null);
    } else {
      setSettings(settingsResult.data || null);
    }

    if (zonesResult.error) {
      console.error("Zones error:", zonesResult.error);
      setZones([]);
    } else {
      setZones(zonesResult.data || []);
    }

    if (pollingResult.error) {
      console.error("Polling areas error:", pollingResult.error);
      setPollingAreas([]);
    } else {
      setPollingAreas(pollingResult.data || []);
    }

    if (competitorsResult.error) {
      console.error("Competitors error:", competitorsResult.error);
      setCompetitors([]);
    } else {
      setCompetitors(competitorsResult.data || []);
    }

    if (votersResult.error) {
      console.error("Voters error:", votersResult.error);
      setMessage("Error loading voter dashboard data.");
      setVoters([]);
    } else {
      setVoters(votersResult.data || []);
    }

    if (campaignersResult.error) {
      console.error("Campaigners error:", campaignersResult.error);
      setCampaigners([]);
    } else {
      setCampaigners(campaignersResult.data || []);
    }

    setLoading(false);
    setRefreshing(false);
  }

  const opponentName = competitors[0]?.name || "Opponent";
  const electionName = settings?.election_name || `${OUR_NAME} Campaign`;

  const stats = useMemo(() => {
    const total = voters.length;
    const target = settings?.vote_target_to_win || 0;

    const confirmed = voters.filter((voter) =>
      isConfirmed(voter.support_status)
    ).length;
    const leaning = voters.filter((voter) => isLeaning(voter.support_status)).length;
    const opponent = voters.filter((voter) =>
      isOpponent(voter.support_status)
    ).length;
    const undecidedUnknown = voters.filter((voter) =>
      isUndecidedUnknown(voter.support_status)
    ).length;

    const projected = Math.round(confirmed + leaning * 0.5);
    const margin = projected - opponent;

    const teamVoted = voters.filter(
      (voter) => voter.voted && isTeamSupport(voter.support_status)
    ).length;
    const opponentVoted = voters.filter(
      (voter) => voter.voted && isOpponent(voter.support_status)
    ).length;
    const undecidedVoted = voters.filter(
      (voter) =>
        voter.voted &&
        !isTeamSupport(voter.support_status) &&
        !isOpponent(voter.support_status)
    ).length;
    const totalVoted = voters.filter((voter) => voter.voted).length;

    const confirmedLeft = voters.filter(
      (voter) => !voter.voted && isConfirmed(voter.support_status)
    ).length;
    const teamLeft = voters.filter(
      (voter) => !voter.voted && isTeamSupport(voter.support_status)
    ).length;

    const pickupNeeded = voters.filter((voter) => voter.pickup_needed).length;
    const pickupIssues = voters.filter(
      (voter) => voter.pickup_status === "Issue"
    ).length;
    const unassigned = voters.filter((voter) => !voter.campaigner_id).length;

    return {
      total,
      target,
      confirmed,
      leaning,
      opponent,
      undecidedUnknown,
      projected,
      margin,
      teamVoted,
      opponentVoted,
      undecidedVoted,
      totalVoted,
      confirmedLeft,
      teamLeft,
      pickupNeeded,
      pickupIssues,
      unassigned,
      targetProgress: percentage(projected, target),
      turnoutProgress: percentage(totalVoted, total),
      voteNeed: Math.max(0, target - projected),
      status: getStatus(projected, confirmed, opponent, target),
    };
  }, [voters, settings]);

  const zoneSummary = useMemo(() => {
    const map = new Map<string, ZoneSummary>();

    function emptyZone(zone: string): ZoneSummary {
      return {
        zone,
        total: 0,
        confirmed: 0,
        leaning: 0,
        projected: 0,
        opponent: 0,
        undecidedUnknown: 0,
        margin: 0,
        votedTeam: 0,
        votedOpponent: 0,
        confirmedLeft: 0,
        pickupNeeded: 0,
        issues: 0,
      };
    }

    zones.forEach((zone) => map.set(zone.name, emptyZone(zone.name)));

    voters.forEach((voter) => {
      const zone = voter.zone || "No Zone";

      if (!map.has(zone)) map.set(zone, emptyZone(zone));

      const item = map.get(zone)!;

      item.total += 1;

      if (isConfirmed(voter.support_status)) {
        item.confirmed += 1;
        if (!voter.voted) item.confirmedLeft += 1;
      }

      if (isLeaning(voter.support_status)) item.leaning += 1;
      if (isOpponent(voter.support_status)) item.opponent += 1;
      if (isUndecidedUnknown(voter.support_status)) item.undecidedUnknown += 1;

      if (voter.voted && isTeamSupport(voter.support_status)) item.votedTeam += 1;
      if (voter.voted && isOpponent(voter.support_status)) item.votedOpponent += 1;

      if (voter.pickup_needed) item.pickupNeeded += 1;
      if (voter.pickup_status === "Issue") item.issues += 1;
    });

    return Array.from(map.values())
      .map((item) => {
        const projected = Math.round(item.confirmed + item.leaning * 0.5);
        return {
          ...item,
          projected,
          margin: projected - item.opponent,
        };
      })
      .sort((a, b) => b.margin - a.margin);
  }, [voters, zones]);

  const pollingSummary = useMemo(() => {
    const map = new Map<string, PollingSummary>();

    pollingAreas.forEach((area) => {
      map.set(area.code, {
        pollingArea: area.code,
        total: 0,
        projected: 0,
        opponent: 0,
        voted: 0,
        confirmedLeft: 0,
      });
    });

    voters.forEach((voter) => {
      const pollingArea = voter.polling_area || "No Polling";

      if (!map.has(pollingArea)) {
        map.set(pollingArea, {
          pollingArea,
          total: 0,
          projected: 0,
          opponent: 0,
          voted: 0,
          confirmedLeft: 0,
        });
      }

      const item = map.get(pollingArea)!;

      item.total += 1;

      if (isConfirmed(voter.support_status)) {
        item.projected += 1;
        if (!voter.voted) item.confirmedLeft += 1;
      }

      if (isLeaning(voter.support_status)) item.projected += 0.5;
      if (isOpponent(voter.support_status)) item.opponent += 1;
      if (voter.voted) item.voted += 1;
    });

    return Array.from(map.values())
      .map((item) => ({
        ...item,
        projected: Math.round(item.projected),
      }))
      .sort((a, b) => b.confirmedLeft - a.confirmedLeft);
  }, [voters, pollingAreas]);

  const topZones = zoneSummary.slice(0, 4);
  const riskZones = [...zoneSummary]
    .sort((a, b) => a.margin - b.margin)
    .slice(0, 4);
  const topPollingAttention = pollingSummary.slice(0, 5);

  const teamStats = useMemo(() => {
    return {
      total: campaigners.length,
      campaigners: campaigners.filter((person) => person.role === "Campaigner")
        .length,
      drivers: campaigners.filter((person) => person.role === "Driver").length,
      scrutineers: campaigners.filter((person) => person.role === "Scrutineer")
        .length,
      zoneLeaders: campaigners.filter((person) => person.role === "Zone Leader")
        .length,
    };
  }, [campaigners]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#eef2f6] p-6">
        <div className="rounded-[2rem] bg-white p-6 text-center shadow-sm">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-sky-600" />
          <h1 className="mt-5 text-lg font-black text-slate-900">
            Loading dashboard...
          </h1>
        </div>
      </main>
    );
  }

  if (profile?.role !== "Campaign Manager") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#eef2f6] p-4 sm:p-6">
        <div className="w-full max-w-xl rounded-[2rem] bg-white p-6 text-center shadow-sm sm:p-8">
          <h1 className="text-2xl font-black text-slate-900">
            Campaign Manager Access Only
          </h1>
          <p className="mt-3 text-slate-500">
            This dashboard is restricted to the Campaign Manager.
          </p>
        </div>
      </main>
    );
  }

  const statusTone = toneClass(stats.status.tone);

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#eef2f6]">
      <section className="px-4 py-5 sm:px-6 sm:py-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                Campaign Dashboard
              </p>
              <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950 sm:text-5xl">
                Dashboard
              </h1>
              <p className="mt-1 truncate text-sm font-semibold text-slate-500">
                {electionName} · {profile.full_name}
              </p>
            </div>

            <button
              onClick={loadDashboard}
              disabled={refreshing}
              className="shrink-0 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {refreshing ? "..." : "Refresh"}
            </button>
          </div>

          {message && (
            <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">
              {message}
            </div>
          )}

          <div className="grid gap-4 xl:grid-cols-[1fr_0.95fr]">
            <section className="overflow-hidden rounded-[2rem] bg-slate-950 p-5 text-white shadow-xl shadow-slate-300 sm:p-7">
              <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-black ${statusTone.card}`}
                    >
                      {stats.status.label}
                    </span>

                    <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black text-white/80">
                      Target {formatNumber(stats.target)}
                    </span>
                  </div>

                  <h2 className="mt-5 text-3xl font-black tracking-tight sm:text-5xl">
                    {stats.status.headline}
                  </h2>

                  <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-white/65">
                    {stats.status.note}
                  </p>
                </div>

                <div className="rounded-[1.5rem] bg-white/10 p-4 ring-1 ring-white/10">
                  <p className="text-xs font-black uppercase tracking-wide text-white/50">
                    Projected Margin
                  </p>
                  <p
                    className={`mt-2 text-4xl font-black ${
                      stats.margin >= 0 ? "text-green-300" : "text-red-300"
                    }`}
                  >
                    {formatSigned(stats.margin)}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-white/50">
                    vs {opponentName}
                  </p>
                </div>
              </div>

              <div className="mt-8">
                <div className="flex items-center justify-between text-xs font-bold text-white/60">
                  <span>Progress to target</span>
                  <span>{clamp(stats.targetProgress)}%</span>
                </div>

                <div className="mt-2 h-3 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-3 rounded-full bg-sky-400"
                    style={{ width: `${clamp(stats.targetProgress)}%` }}
                  />
                </div>
              </div>

              <div className="mt-6 grid grid-cols-3 gap-3">
                <div className="rounded-[1.2rem] bg-white/10 p-3">
                  <p className="text-xs font-bold text-white/45">{OUR_NAME}</p>
                  <p className="mt-1 text-xl font-black">
                    {formatNumber(stats.projected)}
                  </p>
                </div>

                <div className="rounded-[1.2rem] bg-white/10 p-3">
                  <p className="text-xs font-bold text-white/45">Opponent</p>
                  <p className="mt-1 text-xl font-black">
                    {formatNumber(stats.opponent)}
                  </p>
                </div>

                <div className="rounded-[1.2rem] bg-white/10 p-3">
                  <p className="text-xs font-bold text-white/45">Need</p>
                  <p className="mt-1 text-xl font-black">
                    {formatNumber(stats.voteNeed)}
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <SectionHeader
                title="Campaign Pulse"
                subtitle="Projected support, turnout and field pressure."
              />

              <DonutMetric
                percentageValue={stats.targetProgress}
                center={`${clamp(stats.targetProgress)}%`}
                label="of vote target"
              />

              <div className="mt-4 grid gap-3">
                <AppListItem
                  icon="✓"
                  title="Confirmed Supporters"
                  subtitle={`${formatNumber(stats.leaning)} leaning supporters`}
                  value={formatNumber(stats.confirmed)}
                  tone="green"
                />
                <AppListItem
                  icon="•"
                  title="Undecided / Unknown"
                  subtitle="Still needs follow-up"
                  value={formatNumber(stats.undecidedUnknown)}
                  tone="amber"
                />
                <AppListItem
                  icon="!"
                  title="Pickup Issues"
                  subtitle={`${formatNumber(stats.pickupNeeded)} pickups needed`}
                  value={formatNumber(stats.pickupIssues)}
                  tone={stats.pickupIssues > 0 ? "red" : "green"}
                />
              </div>
            </section>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MiniMetric
              label="Projected"
              value={formatNumber(stats.projected)}
              detail="Confirmed + 50% leaning"
              tone="sky"
              icon="↑"
            />
            <MiniMetric
              label="Opponent"
              value={formatNumber(stats.opponent)}
              detail="Not Supporting"
              tone="red"
              icon="↘"
            />
            <MiniMetric
              label="Voted Today"
              value={formatNumber(stats.totalVoted)}
              detail={`${formatNumber(stats.confirmedLeft)} confirmed left`}
              tone="green"
              icon="●"
            />
            <MiniMetric
              label="Unassigned"
              value={formatNumber(stats.unassigned)}
              detail="No campaigner"
              tone={stats.unassigned > 0 ? "amber" : "slate"}
              icon="?"
            />
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
            <Card>
              <SectionHeader
                title="Live Voting Comparison"
                subtitle="Election-day turnout by recorded support status."
              />

              <div className="mt-5 space-y-4">
                <div>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="font-black text-slate-900">{OUR_NAME}</span>
                    <span className="font-black text-sky-700">
                      {formatNumber(stats.teamVoted)}
                    </span>
                  </div>
                  <ProgressBar value={stats.teamVoted} total={stats.totalVoted} tone="sky" />
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="font-black text-slate-900">{opponentName}</span>
                    <span className="font-black text-red-700">
                      {formatNumber(stats.opponentVoted)}
                    </span>
                  </div>
                  <ProgressBar
                    value={stats.opponentVoted}
                    total={stats.totalVoted}
                    tone="red"
                  />
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="font-black text-slate-900">
                      Undecided / Unknown
                    </span>
                    <span className="font-black text-amber-700">
                      {formatNumber(stats.undecidedVoted)}
                    </span>
                  </div>
                  <ProgressBar
                    value={stats.undecidedVoted}
                    total={stats.totalVoted}
                    tone="amber"
                  />
                </div>
              </div>

              <p className="mt-5 rounded-2xl bg-amber-50 p-3 text-xs font-semibold text-amber-900">
                Voted status is an operational turnout marker. It is not a record
                of anyone’s private ballot.
              </p>
            </Card>

            <Card>
              <SectionHeader
                title="Support Breakdown"
                subtitle="Strategic picture before and during election day."
              />

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <AppListItem
                  icon="✓"
                  title="Confirmed"
                  subtitle="Recorded supporters"
                  value={formatNumber(stats.confirmed)}
                  tone="green"
                />
                <AppListItem
                  icon="~"
                  title="Leaning"
                  subtitle="Counted at 50% projection"
                  value={formatNumber(stats.leaning)}
                  tone="purple"
                />
                <AppListItem
                  icon="?"
                  title="Undecided"
                  subtitle="Unknown or undecided"
                  value={formatNumber(stats.undecidedUnknown)}
                  tone="amber"
                />
                <AppListItem
                  icon="×"
                  title="Not Supporting"
                  subtitle={`Estimated ${opponentName}`}
                  value={formatNumber(stats.opponent)}
                  tone="red"
                />
              </div>
            </Card>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-3">
            <Card>
              <SectionHeader
                title="Field Operations"
                subtitle="What needs action now."
              />

              <div className="mt-5 space-y-3">
                <AppListItem
                  icon="🚐"
                  title="Pickup Needed"
                  subtitle="Voters requiring transport"
                  value={formatNumber(stats.pickupNeeded)}
                  tone="purple"
                />
                <AppListItem
                  icon="!"
                  title="Pickup Issues"
                  subtitle="Needs field follow-up"
                  value={formatNumber(stats.pickupIssues)}
                  tone={stats.pickupIssues > 0 ? "red" : "green"}
                />
                <AppListItem
                  icon="○"
                  title="Team Support Left"
                  subtitle="Supporters not marked voted"
                  value={formatNumber(stats.teamLeft)}
                  tone="amber"
                />
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <Link
                  href="/campaigners"
                  className="rounded-2xl bg-slate-950 px-4 py-3 text-center text-sm font-black text-white hover:bg-slate-800"
                >
                  Field View
                </Link>
                <Link
                  href="/voters"
                  className="rounded-2xl border border-slate-300 px-4 py-3 text-center text-sm font-black text-slate-800 hover:bg-slate-50"
                >
                  Voters
                </Link>
              </div>
            </Card>

            <Card className="xl:col-span-2">
              <SectionHeader
                title="Zone Performance"
                subtitle="Strongest zones and zones needing attention."
              />

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div>
                  <h3 className="mb-3 text-sm font-black uppercase tracking-wide text-slate-400">
                    Strongest
                  </h3>

                  <div className="space-y-3">
                    {topZones.map((zone) => (
                      <div
                        key={zone.zone}
                        className="rounded-[1.5rem] border border-slate-200 p-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-black text-slate-950">
                              {zone.zone}
                            </p>
                            <p className="text-xs font-semibold text-slate-500">
                              Projected {formatNumber(zone.projected)} · Opp.{" "}
                              {formatNumber(zone.opponent)}
                            </p>
                          </div>
                          <p
                            className={`shrink-0 font-black ${
                              zone.margin >= 0 ? "text-green-700" : "text-red-700"
                            }`}
                          >
                            {formatSigned(zone.margin)}
                          </p>
                        </div>
                      </div>
                    ))}

                    {topZones.length === 0 && (
                      <div className="rounded-3xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                        No zone data available.
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="mb-3 text-sm font-black uppercase tracking-wide text-slate-400">
                    Needs Attention
                  </h3>

                  <div className="space-y-3">
                    {riskZones.map((zone) => (
                      <div
                        key={zone.zone}
                        className="rounded-[1.5rem] border border-slate-200 p-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-black text-slate-950">
                              {zone.zone}
                            </p>
                            <p className="text-xs font-semibold text-slate-500">
                              Left {formatNumber(zone.confirmedLeft)} · Issues{" "}
                              {formatNumber(zone.issues)}
                            </p>
                          </div>
                          <p
                            className={`shrink-0 font-black ${
                              zone.margin >= 0 ? "text-green-700" : "text-red-700"
                            }`}
                          >
                            {formatSigned(zone.margin)}
                          </p>
                        </div>
                      </div>
                    ))}

                    {riskZones.length === 0 && (
                      <div className="rounded-3xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                        No risk zone data available.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <Card>
              <SectionHeader
                title="Polling Area Attention"
                subtitle="Polling areas with confirmed supporters still left."
              />

              <div className="mt-5 space-y-3">
                {topPollingAttention.map((item) => (
                  <div
                    key={item.pollingArea}
                    className="rounded-[1.5rem] border border-slate-200 p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-black text-slate-950">
                          Polling {item.pollingArea}
                        </p>
                        <p className="text-xs font-semibold text-slate-500">
                          Total {formatNumber(item.total)} · Voted{" "}
                          {formatNumber(item.voted)}
                        </p>
                      </div>

                      <p className="shrink-0 text-lg font-black text-amber-700">
                        {formatNumber(item.confirmedLeft)}
                      </p>
                    </div>

                    <div className="mt-3">
                      <ProgressBar value={item.voted} total={item.total} tone="green" />
                    </div>
                  </div>
                ))}

                {topPollingAttention.length === 0 && (
                  <div className="rounded-3xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                    No polling area data available.
                  </div>
                )}
              </div>
            </Card>

            <Card>
              <SectionHeader
                title="Team Roster"
                subtitle="Operational staffing snapshot."
              />

              <div className="mt-5 grid grid-cols-2 gap-3">
                <MiniMetric
                  label="Team"
                  value={formatNumber(teamStats.total)}
                  detail="All users"
                  tone="slate"
                  icon="T"
                />
                <MiniMetric
                  label="Leaders"
                  value={formatNumber(teamStats.zoneLeaders)}
                  detail="Zone leaders"
                  tone="purple"
                  icon="L"
                />
                <MiniMetric
                  label="Field"
                  value={formatNumber(teamStats.campaigners)}
                  detail="Campaigners"
                  tone="green"
                  icon="F"
                />
                <MiniMetric
                  label="Drivers"
                  value={formatNumber(teamStats.drivers)}
                  detail={`${formatNumber(teamStats.scrutineers)} scrutineers`}
                  tone="amber"
                  icon="D"
                />
              </div>

              <Link
                href="/team"
                className="mt-5 block rounded-2xl bg-sky-700 px-4 py-3 text-center text-sm font-black text-white hover:bg-sky-800"
              >
                Manage Team
              </Link>
            </Card>
          </div>
        </div>
      </section>
    </main>
  );
}
