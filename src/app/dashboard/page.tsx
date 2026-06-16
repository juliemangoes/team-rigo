"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
  ourProjected: number;
  opponentProjected: number;
  undecidedUnknown: number;
  margin: number;
  liveOur: number;
  liveOpponent: number;
  liveUndecided: number;
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

type Tone = "blue" | "green" | "red" | "amber" | "orange" | "purple" | "slate";

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(Math.round(value) || 0);
}

function formatSigned(value: number) {
  return value >= 0
    ? `+${formatNumber(value)}`
    : `-${formatNumber(Math.abs(value))}`;
}

function percentage(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((value / total) * 100);
}

function clampPercentage(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function getDisplayName(voter: IssueVoter) {
  const nameFromParts = [voter.first_name, voter.middle_name, voter.last_name]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  return nameFromParts || voter.full_name || "Unnamed voter";
}

function getRegNo(voter: IssueVoter) {
  return voter.voter_reg_no || voter.voter_number || "No reg no.";
}

function isConfirmedSupport(status: string | null) {
  return status === "Confirmed Supporter";
}

function isLeaningSupport(status: string | null) {
  return status === "Leaning Supporter";
}

function isOurSupport(status: string | null) {
  return isConfirmedSupport(status) || isLeaningSupport(status);
}

function isOpponentSupport(status: string | null) {
  return status === "Not Supporting";
}

function isUndecidedOrUnknown(status: string | null) {
  return !status || status === "Unknown" || status === "Undecided";
}

function getWinStatus(
  projected: number,
  confirmed: number,
  opponent: number,
  target: number
) {
  if (!target || target <= 0) {
    return {
      label: "Target Needed",
      description: "Set the vote target in Campaign Setup.",
      tone: "slate" as Tone,
    };
  }

  const margin = projected - opponent;
  const progress = projected / target;

  if (confirmed >= target && margin > 0) {
    return {
      label: "Strong",
      description: "Confirmed support is above the target.",
      tone: "green" as Tone,
    };
  }

  if (progress >= 1 && margin > 0) {
    return {
      label: "Ahead",
      description: "Projected support is above target and ahead of opponent.",
      tone: "green" as Tone,
    };
  }

  if (progress >= 0.9 && margin >= 0) {
    return {
      label: "Close",
      description: "Near the target. Keep confirming and turning out supporters.",
      tone: "amber" as Tone,
    };
  }

  if (margin < 0) {
    return {
      label: "Behind",
      description: "Opponent estimate is ahead. Review support and field follow-up.",
      tone: "red" as Tone,
    };
  }

  return {
    label: "Needs Work",
    description: "Below target. More confirmed supporters are needed.",
    tone: "orange" as Tone,
  };
}

function toneClasses(tone: Tone) {
  if (tone === "blue") {
    return {
      border: "border-blue-100",
      bg: "bg-blue-50",
      text: "text-blue-700",
      pill: "bg-blue-100 text-blue-800",
      bar: "bg-blue-600",
    };
  }

  if (tone === "green") {
    return {
      border: "border-green-100",
      bg: "bg-green-50",
      text: "text-green-700",
      pill: "bg-green-100 text-green-800",
      bar: "bg-green-600",
    };
  }

  if (tone === "red") {
    return {
      border: "border-red-100",
      bg: "bg-red-50",
      text: "text-red-700",
      pill: "bg-red-100 text-red-800",
      bar: "bg-red-600",
    };
  }

  if (tone === "amber") {
    return {
      border: "border-amber-100",
      bg: "bg-amber-50",
      text: "text-amber-700",
      pill: "bg-amber-100 text-amber-800",
      bar: "bg-amber-500",
    };
  }

  if (tone === "orange") {
    return {
      border: "border-orange-100",
      bg: "bg-orange-50",
      text: "text-orange-700",
      pill: "bg-orange-100 text-orange-800",
      bar: "bg-orange-500",
    };
  }

  if (tone === "purple") {
    return {
      border: "border-purple-100",
      bg: "bg-purple-50",
      text: "text-purple-700",
      pill: "bg-purple-100 text-purple-800",
      bar: "bg-purple-600",
    };
  }

  return {
    border: "border-slate-200",
    bg: "bg-white",
    text: "text-slate-700",
    pill: "bg-slate-100 text-slate-800",
    bar: "bg-slate-600",
  };
}

function PageCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 ${className}`}
    >
      {children}
    </section>
  );
}

function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h2 className="text-xl font-black tracking-tight text-slate-950 sm:text-2xl">
          {title}
        </h2>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>

      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

function MiniStat({
  label,
  value,
  detail,
  tone = "slate",
}: {
  label: string;
  value: string | number;
  detail?: string;
  tone?: Tone;
}) {
  const t = toneClasses(tone);

  return (
    <div className={`rounded-3xl border p-4 ${t.border} ${t.bg}`}>
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className={`mt-2 text-2xl font-black tracking-tight ${t.text}`}>
        {value}
      </p>
      {detail && <p className="mt-1 text-xs font-semibold text-slate-500">{detail}</p>}
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

function ProjectedBar({
  our,
  undecided,
  opponent,
  total,
  target,
}: {
  our: number;
  undecided: number;
  opponent: number;
  total: number;
  target: number;
}) {
  const safeTotal = Math.max(total, our + undecided + opponent, 1);
  const ourWidth = clampPercentage((our / safeTotal) * 100);
  const undecidedWidth = clampPercentage((undecided / safeTotal) * 100);
  const opponentWidth = clampPercentage((opponent / safeTotal) * 100);
  const targetWidth =
    target > 0 && safeTotal > 0 ? clampPercentage((target / safeTotal) * 100) : 0;

  return (
    <div className={`${target > 0 ? "pt-6" : ""} relative`}>
      <div className="flex h-5 overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200">
        <div className="h-5 bg-blue-600" style={{ width: `${ourWidth}%` }} />
        <div className="h-5 bg-amber-400" style={{ width: `${undecidedWidth}%` }} />
        <div className="h-5 bg-red-600" style={{ width: `${opponentWidth}%` }} />
      </div>

      {target > 0 && (
        <div
          className="absolute bottom-0 top-6"
          style={{ left: `${targetWidth}%` }}
        >
          <div className="h-full w-0.5 -translate-x-1/2 bg-slate-950" />
          <span className="absolute -top-6 left-0 -translate-x-1/2 whitespace-nowrap rounded-full bg-slate-950 px-2 py-1 text-[10px] font-black text-white">
            Target
          </span>
        </div>
      )}
    </div>
  );
}

function LiveBar({
  label,
  value,
  total,
  remaining,
  tone,
}: {
  label: string;
  value: number;
  total: number;
  remaining: number;
  tone: Tone;
}) {
  const t = toneClasses(tone);
  const width = clampPercentage(percentage(value, total));

  return (
    <div className="rounded-2xl border border-slate-200 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="font-black text-slate-900">{label}</p>
        <p className={`font-black ${t.text}`}>{formatNumber(value)}</p>
      </div>

      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-2.5 rounded-full ${t.bar}`} style={{ width: `${width}%` }} />
      </div>

      <p className="mt-2 text-xs font-semibold text-slate-500">
        Remaining: {formatNumber(remaining)}
      </p>
    </div>
  );
}

export default function DashboardPage() {
  const [profile, setProfile] = useState<TeamProfile | null>(null);
  const [settings, setSettings] = useState<CampaignSettings | null>(null);
  const [setupZones, setSetupZones] = useState<CampaignZone[]>([]);
  const [setupPollingAreas, setSetupPollingAreas] = useState<PollingArea[]>([]);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);

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
      competitorResult,
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

    if (competitorResult.error) {
      console.error("Competitors error:", competitorResult.error);
      setCompetitors([]);
    } else {
      setCompetitors(competitorResult.data || []);
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

  const opponentName = competitors[0]?.name || "Opponent";

  const stats = useMemo(() => {
    const total = voters.length;
    const target = settings?.vote_target_to_win || 0;

    const confirmed = voters.filter((voter) =>
      isConfirmedSupport(voter.support_status)
    ).length;
    const leaning = voters.filter((voter) =>
      isLeaningSupport(voter.support_status)
    ).length;
    const opponent = voters.filter((voter) =>
      isOpponentSupport(voter.support_status)
    ).length;
    const undecidedUnknown = voters.filter((voter) =>
      isUndecidedOrUnknown(voter.support_status)
    ).length;

    const projected = Math.round(confirmed + leaning * 0.5);
    const margin = projected - opponent;

    const ourVoted = voters.filter(
      (voter) => voter.voted && isOurSupport(voter.support_status)
    ).length;
    const opponentVoted = voters.filter(
      (voter) => voter.voted && isOpponentSupport(voter.support_status)
    ).length;
    const undecidedVoted = voters.filter(
      (voter) =>
        voter.voted &&
        !isOurSupport(voter.support_status) &&
        !isOpponentSupport(voter.support_status)
    ).length;

    const ourRemaining = voters.filter(
      (voter) => !voter.voted && isOurSupport(voter.support_status)
    ).length;
    const opponentRemaining = voters.filter(
      (voter) => !voter.voted && isOpponentSupport(voter.support_status)
    ).length;
    const undecidedRemaining = voters.filter(
      (voter) =>
        !voter.voted &&
        !isOurSupport(voter.support_status) &&
        !isOpponentSupport(voter.support_status)
    ).length;

    const confirmedRemaining = voters.filter(
      (voter) => !voter.voted && isConfirmedSupport(voter.support_status)
    ).length;
    const confirmedVoted = voters.filter(
      (voter) => voter.voted && isConfirmedSupport(voter.support_status)
    ).length;
    const confirmedPickupNotVoted = voters.filter(
      (voter) =>
        !voter.voted &&
        voter.pickup_needed &&
        isConfirmedSupport(voter.support_status)
    ).length;

    const liveTotal = ourVoted + opponentVoted + undecidedVoted;

    const pickupIssues = voters.filter(
      (voter) => voter.pickup_status === "Issue"
    ).length;
    const assigned = voters.filter((voter) => voter.campaigner_id).length;
    const unassigned = total - assigned;

    const winStatus = getWinStatus(projected, confirmed, opponent, target);

    return {
      total,
      target,
      confirmed,
      leaning,
      opponent,
      undecidedUnknown,
      projected,
      margin,
      ourVoted,
      opponentVoted,
      undecidedVoted,
      ourRemaining,
      opponentRemaining,
      undecidedRemaining,
      liveTotal,
      confirmedRemaining,
      confirmedVoted,
      confirmedPickupNotVoted,
      pickupIssues,
      assigned,
      unassigned,
      assignmentRate: percentage(assigned, total),
      turnoutRate: percentage(confirmedVoted, confirmed),
      votesNeeded: Math.max(0, target - projected),
      projectedCushion: projected - target,
      winStatus,
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
        ourProjected: 0,
        opponentProjected: 0,
        undecidedUnknown: 0,
        margin: 0,
        liveOur: 0,
        liveOpponent: 0,
        liveUndecided: 0,
        confirmedRemaining: 0,
        pickupNeeded: 0,
        pickupIssues: 0,
      };
    }

    setupZones.forEach((zone) => {
      map.set(zone.name, emptyZone(zone.name));
    });

    voters.forEach((voter) => {
      const zone = voter.zone || "No Zone";

      if (!map.has(zone)) {
        map.set(zone, emptyZone(zone));
      }

      const item = map.get(zone)!;

      item.total += 1;

      if (isConfirmedSupport(voter.support_status)) {
        item.confirmed += 1;
        if (!voter.voted) item.confirmedRemaining += 1;
      }

      if (isLeaningSupport(voter.support_status)) item.leaning += 1;
      if (isOpponentSupport(voter.support_status)) item.opponentProjected += 1;
      if (isUndecidedOrUnknown(voter.support_status)) item.undecidedUnknown += 1;

      if (voter.voted && isOurSupport(voter.support_status)) item.liveOur += 1;
      if (voter.voted && isOpponentSupport(voter.support_status)) {
        item.liveOpponent += 1;
      }
      if (
        voter.voted &&
        !isOurSupport(voter.support_status) &&
        !isOpponentSupport(voter.support_status)
      ) {
        item.liveUndecided += 1;
      }

      if (voter.pickup_needed) item.pickupNeeded += 1;
      if (voter.pickup_status === "Issue") item.pickupIssues += 1;
    });

    return Array.from(map.values())
      .map((item) => {
        const ourProjected = Math.round(item.confirmed + item.leaning * 0.5);

        return {
          ...item,
          ourProjected,
          margin: ourProjected - item.opponentProjected,
        };
      })
      .sort((a, b) => a.zone.localeCompare(b.zone));
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
      if (isConfirmedSupport(voter.support_status)) item.confirmed += 1;
      if (voter.voted) item.voted += 1;
      if (voter.pickup_needed) item.pickupNeeded += 1;
    });

    return Array.from(map.values()).sort((a, b) =>
      a.pollingArea.localeCompare(b.pollingArea, undefined, { numeric: true })
    );
  }, [voters, setupPollingAreas]);

  const campaignerSummary = useMemo(() => {
    return campaigners
      .filter((person) => person.role === "Campaigner")
      .map((person): CampaignerSummary => {
        const assignedVoters = voters.filter(
          (voter) => voter.campaigner_id === person.id
        );
        const confirmed = assignedVoters.filter((voter) =>
          isConfirmedSupport(voter.support_status)
        ).length;
        const votedConfirmed = assignedVoters.filter(
          (voter) => voter.voted && isConfirmedSupport(voter.support_status)
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
      .slice(0, 8);
  }, [campaigners, voters]);

  const teamStats = useMemo(() => {
    return {
      total: campaigners.length,
      zoneLeaders: campaigners.filter((person) => person.role === "Zone Leader")
        .length,
      campaigners: campaigners.filter((person) => person.role === "Campaigner")
        .length,
      drivers: campaigners.filter((person) => person.role === "Driver").length,
      scrutineers: campaigners.filter((person) => person.role === "Scrutineer")
        .length,
    };
  }, [campaigners]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <div className="rounded-3xl bg-white p-6 text-center shadow-sm">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-blue-700" />
          <h1 className="mt-5 text-lg font-black text-slate-900">
            Loading dashboard...
          </h1>
        </div>
      </main>
    );
  }

  if (profile?.role !== "Campaign Manager") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4 sm:p-6">
        <div className="w-full max-w-xl rounded-3xl bg-white p-6 text-center shadow-sm sm:p-8">
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

  const winTone = toneClasses(stats.winStatus.tone);
  const electionName = settings?.election_name || `${OUR_NAME} Campaign`;

  return (
    <main className="min-h-screen overflow-x-hidden bg-slate-100">
      <section className="bg-white px-4 py-5 shadow-sm sm:px-6 sm:py-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-5xl">
                Dashboard
              </h1>
              <p className="mt-2 truncate text-sm text-slate-500">
                {electionName} · {profile?.full_name}
              </p>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1 sm:overflow-visible sm:pb-0">
              <button
                onClick={loadDashboard}
                disabled={refreshing}
                className="shrink-0 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {refreshing ? "Refreshing..." : "Refresh"}
              </button>

              <Link
                href="/campaign-setup"
                className="shrink-0 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-black text-slate-800 hover:bg-slate-50"
              >
                Setup
              </Link>

              <Link
                href="/voters"
                className="shrink-0 rounded-2xl bg-blue-700 px-4 py-3 text-sm font-black text-white hover:bg-blue-800"
              >
                Voters
              </Link>
            </div>
          </div>

          {message && (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">
              {message}
            </div>
          )}

          <div className="mt-5 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <PageCard>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                    Win Status
                  </p>

                  <h2 className={`mt-2 text-4xl font-black ${winTone.text}`}>
                    {stats.winStatus.label}
                  </h2>

                  <p className="mt-2 max-w-xl text-sm font-semibold text-slate-600">
                    {stats.winStatus.description}
                  </p>
                </div>

                <div className={`rounded-3xl border p-4 ${winTone.border} ${winTone.bg}`}>
                  <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                    Margin
                  </p>
                  <p
                    className={`mt-2 text-3xl font-black ${
                      stats.margin >= 0 ? "text-green-700" : "text-red-700"
                    }`}
                  >
                    {formatSigned(stats.margin)}
                  </p>
                  <p className="mt-1 text-xs font-bold text-slate-500">
                    Projected vs {opponentName}
                  </p>
                </div>
              </div>

              <div className="mt-6">
                <ProjectedBar
                  our={stats.projected}
                  undecided={stats.undecidedUnknown}
                  opponent={stats.opponent}
                  total={stats.total}
                  target={stats.target}
                />
              </div>

              <div className="mt-4 flex flex-wrap gap-3 text-xs font-bold text-slate-500">
                <span className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-blue-600" />
                  {OUR_NAME}: {formatNumber(stats.projected)}
                </span>
                <span className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-amber-400" />
                  Undecided/Unknown: {formatNumber(stats.undecidedUnknown)}
                </span>
                <span className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-red-600" />
                  {opponentName}: {formatNumber(stats.opponent)}
                </span>
              </div>

              <p className="mt-4 text-xs text-slate-500">
                Projection = confirmed supporters + 50% of leaning supporters.
                Opponent estimate = voters marked Not Supporting. This is an
                operational estimate, not a record of how anyone voted.
              </p>
            </PageCard>

            <div className="grid grid-cols-2 gap-3">
              <MiniStat
                label="Target"
                value={formatNumber(stats.target)}
                detail="Votes to win"
                tone="slate"
              />
              <MiniStat
                label="Projected"
                value={formatNumber(stats.projected)}
                detail={
                  stats.votesNeeded > 0
                    ? `${formatNumber(stats.votesNeeded)} short`
                    : "At or above target"
                }
                tone="blue"
              />
              <MiniStat
                label="Confirmed"
                value={formatNumber(stats.confirmed)}
                detail={`${formatNumber(stats.leaning)} leaning`}
                tone="green"
              />
              <MiniStat
                label="Opponent"
                value={formatNumber(stats.opponent)}
                detail="Not Supporting"
                tone="red"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-4 sm:px-6 sm:py-8">
        <div className="mx-auto max-w-7xl">
          <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:hidden">
            <ActionChip href="/voters" label="Voters" primary />
            <ActionChip href="/campaigners" label="Field" />
            <ActionChip href="/team" label="Team" />
            <ActionChip href="/upload" label="Upload" />
            <ActionChip href="/campaign-setup" label="Setup" />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <PageCard>
              <SectionHeader
                title="Projected Voter Position"
                subtitle="Before voting starts, this is the support position."
              />

              <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-3 font-black">Group</th>
                      <th className="px-3 py-3 text-right font-black">
                        Confirmed
                      </th>
                      <th className="px-3 py-3 text-right font-black">
                        Leaning
                      </th>
                      <th className="px-3 py-3 text-right font-black">
                        Projected
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <td className="px-3 py-3 font-black text-slate-900">
                        {OUR_NAME}
                      </td>
                      <td className="px-3 py-3 text-right font-bold text-green-700">
                        {formatNumber(stats.confirmed)}
                      </td>
                      <td className="px-3 py-3 text-right font-bold text-blue-700">
                        {formatNumber(stats.leaning)}
                      </td>
                      <td className="px-3 py-3 text-right font-black text-blue-700">
                        {formatNumber(stats.projected)}
                      </td>
                    </tr>

                    <tr>
                      <td className="px-3 py-3 font-black text-slate-900">
                        {opponentName}
                      </td>
                      <td className="px-3 py-3 text-right font-bold text-red-700">
                        {formatNumber(stats.opponent)}
                      </td>
                      <td className="px-3 py-3 text-right font-bold text-slate-400">
                        —
                      </td>
                      <td className="px-3 py-3 text-right font-black text-red-700">
                        {formatNumber(stats.opponent)}
                      </td>
                    </tr>

                    <tr>
                      <td className="px-3 py-3 font-black text-slate-900">
                        Undecided / Unknown
                      </td>
                      <td className="px-3 py-3 text-right font-bold text-amber-700">
                        {formatNumber(stats.undecidedUnknown)}
                      </td>
                      <td className="px-3 py-3 text-right font-bold text-slate-400">
                        —
                      </td>
                      <td className="px-3 py-3 text-right font-black text-amber-700">
                        {formatNumber(stats.undecidedUnknown)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </PageCard>

            <PageCard>
              <SectionHeader
                title="Voting Started Comparison"
                subtitle="Visible when scrutineers start marking voters."
              />

              <div className="mt-4 grid gap-3">
                <LiveBar
                  label={OUR_NAME}
                  value={stats.ourVoted}
                  total={stats.liveTotal}
                  remaining={stats.ourRemaining}
                  tone="blue"
                />
                <LiveBar
                  label={opponentName}
                  value={stats.opponentVoted}
                  total={stats.liveTotal}
                  remaining={stats.opponentRemaining}
                  tone="red"
                />
                <LiveBar
                  label="Undecided / Unknown"
                  value={stats.undecidedVoted}
                  total={stats.liveTotal}
                  remaining={stats.undecidedRemaining}
                  tone="amber"
                />
              </div>

              <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-bold text-slate-600">
                    Total marked voted
                  </span>
                  <span className="font-black text-slate-950">
                    {formatNumber(stats.liveTotal)}
                  </span>
                </div>

                <div className="mt-2 flex items-center justify-between gap-3 text-sm">
                  <span className="font-bold text-slate-600">
                    Confirmed supporters still left
                  </span>
                  <span className="font-black text-amber-700">
                    {formatNumber(stats.confirmedRemaining)}
                  </span>
                </div>
              </div>

              <p className="mt-3 text-xs text-slate-500">
                This uses support status plus the voted marker. It is not a
                record of anyone’s private ballot.
              </p>
            </PageCard>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            <MiniStat
              label="Confirmed Left"
              value={formatNumber(stats.confirmedRemaining)}
              detail="Not yet marked voted"
              tone="amber"
            />
            <MiniStat
              label="Turnout"
              value={`${stats.turnoutRate}%`}
              detail={`${formatNumber(stats.confirmedVoted)} confirmed voted`}
              tone="green"
            />
            <MiniStat
              label="Pickup Not Voted"
              value={formatNumber(stats.confirmedPickupNotVoted)}
              detail="Confirmed supporters"
              tone="orange"
            />
            <MiniStat
              label="Pickup Issues"
              value={formatNumber(stats.pickupIssues)}
              detail="Needs action"
              tone={stats.pickupIssues > 0 ? "red" : "green"}
            />
            <MiniStat
              label="Unassigned"
              value={formatNumber(stats.unassigned)}
              detail="No campaigner"
              tone={stats.unassigned > 0 ? "red" : "green"}
            />
            <MiniStat
              label="Assignment"
              value={`${stats.assignmentRate}%`}
              detail={`${formatNumber(stats.assigned)} assigned`}
              tone="purple"
            />
          </div>

          <PageCard className="mt-4">
            <SectionHeader
              title="Zone Performance"
              subtitle="Projected support, live turnout and risk by zone."
              action={
                <Link
                  href="/reports"
                  className="hidden rounded-2xl border border-slate-300 px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-50 sm:block"
                >
                  View Reports
                </Link>
              }
            />

            <div className="mt-5 grid gap-3 lg:hidden">
              {zoneSummary.map((item) => (
                <div
                  key={item.zone}
                  className="rounded-3xl border border-slate-200 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="break-words text-base font-black text-slate-950">
                        {item.zone}
                      </h3>
                      <p className="mt-1 text-xs text-slate-500">
                        Total: {formatNumber(item.total)}
                      </p>
                    </div>

                    <span
                      className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${
                        item.margin >= 0
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {formatSigned(item.margin)}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-4 gap-2 text-center">
                    <div>
                      <p className="text-[11px] font-bold text-slate-400">Us</p>
                      <p className="text-lg font-black text-blue-700">
                        {formatNumber(item.ourProjected)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-slate-400">Opp.</p>
                      <p className="text-lg font-black text-red-700">
                        {formatNumber(item.opponentProjected)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-slate-400">Left</p>
                      <p className="text-lg font-black text-amber-700">
                        {formatNumber(item.confirmedRemaining)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-slate-400">Issues</p>
                      <p className="text-lg font-black text-orange-700">
                        {formatNumber(item.pickupIssues)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}

              {zoneSummary.length === 0 && (
                <div className="rounded-3xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                  No zone data available.
                </div>
              )}
            </div>

            <div className="mt-5 hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-3 pr-3 font-black">Zone</th>
                    <th className="px-3 py-3 font-black">Total</th>
                    <th className="px-3 py-3 font-black text-blue-700">Projected</th>
                    <th className="px-3 py-3 font-black text-red-700">Opponent</th>
                    <th className="px-3 py-3 font-black">Margin</th>
                    <th className="px-3 py-3 font-black">Live Us</th>
                    <th className="px-3 py-3 font-black">Live Opp.</th>
                    <th className="px-3 py-3 font-black">Confirmed Left</th>
                    <th className="px-3 py-3 font-black">Pickup</th>
                    <th className="px-3 py-3 font-black">Issues</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {zoneSummary.map((item) => (
                    <tr key={item.zone} className="align-top">
                      <td className="py-3 pr-3 font-black text-slate-950">
                        {item.zone}
                      </td>
                      <td className="px-3 py-3 text-slate-600">
                        {formatNumber(item.total)}
                      </td>
                      <td className="px-3 py-3 font-black text-blue-700">
                        {formatNumber(item.ourProjected)}
                      </td>
                      <td className="px-3 py-3 font-black text-red-700">
                        {formatNumber(item.opponentProjected)}
                      </td>
                      <td
                        className={`px-3 py-3 font-black ${
                          item.margin >= 0 ? "text-green-700" : "text-red-700"
                        }`}
                      >
                        {formatSigned(item.margin)}
                      </td>
                      <td className="px-3 py-3 font-bold text-blue-700">
                        {formatNumber(item.liveOur)}
                      </td>
                      <td className="px-3 py-3 font-bold text-red-700">
                        {formatNumber(item.liveOpponent)}
                      </td>
                      <td className="px-3 py-3 font-bold text-amber-700">
                        {formatNumber(item.confirmedRemaining)}
                      </td>
                      <td className="px-3 py-3 font-bold text-orange-700">
                        {formatNumber(item.pickupNeeded)}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-black ${
                            item.pickupIssues > 0
                              ? "bg-red-100 text-red-800"
                              : "bg-green-100 text-green-800"
                          }`}
                        >
                          {formatNumber(item.pickupIssues)}
                        </span>
                      </td>
                    </tr>
                  ))}

                  {zoneSummary.length === 0 && (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-slate-500">
                        No zone data available.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </PageCard>

          <div className="mt-4 grid gap-4 xl:grid-cols-3">
            <PageCard>
              <SectionHeader
                title="Polling Areas"
                subtitle="Turnout by polling area."
              />

              <div className="mt-4 max-h-[520px] space-y-3 overflow-y-auto pr-1">
                {pollingSummary.map((item) => {
                  const turnout = percentage(item.voted, item.total);

                  return (
                    <div
                      key={item.pollingArea}
                      className="rounded-2xl border border-slate-200 p-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-black text-slate-950">
                            Polling {item.pollingArea}
                          </p>
                          <p className="text-xs text-slate-500">
                            {formatNumber(item.confirmed)} confirmed ·{" "}
                            {formatNumber(item.pickupNeeded)} pickup
                          </p>
                        </div>
                        <p className="text-xl font-black text-green-700">
                          {turnout}%
                        </p>
                      </div>

                      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-2.5 rounded-full bg-green-600"
                          style={{ width: `${clampPercentage(turnout)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}

                {pollingSummary.length === 0 && (
                  <div className="rounded-3xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                    No polling area data available.
                  </div>
                )}
              </div>
            </PageCard>

            <PageCard>
              <SectionHeader
                title="Field Leaderboard"
                subtitle="Campaigners by confirmed supporters."
              />

              <div className="mt-4 space-y-3">
                {campaignerSummary.map((item, index) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 rounded-2xl border border-slate-200 p-3"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-sm font-black text-slate-700">
                      {index + 1}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="truncate font-black text-slate-950">
                        {item.name}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {item.zone || "No zone"} ·{" "}
                        {formatNumber(item.votedConfirmed)} voted ·{" "}
                        {formatNumber(item.pickupNeeded)} pickup
                      </p>
                    </div>

                    <p className="shrink-0 text-xl font-black text-blue-700">
                      {formatNumber(item.confirmed)}
                    </p>
                  </div>
                ))}

                {campaignerSummary.length === 0 && (
                  <div className="rounded-3xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                    No campaigner assignments found.
                  </div>
                )}
              </div>
            </PageCard>

            <PageCard>
              <SectionHeader
                title="Operations"
                subtitle="Issues, team and next actions."
              />

              <div className="mt-4 grid grid-cols-2 gap-3">
                <MiniStat
                  label="Team"
                  value={formatNumber(teamStats.total)}
                  detail={`${formatNumber(teamStats.campaigners)} field`}
                  tone="slate"
                />
                <MiniStat
                  label="Leaders"
                  value={formatNumber(teamStats.zoneLeaders)}
                  detail={`${formatNumber(teamStats.drivers)} drivers`}
                  tone="purple"
                />
              </div>

              <div className="mt-4 space-y-3">
                {issueVoters.slice(0, 4).map((voter) => (
                  <div
                    key={voter.id}
                    className="rounded-2xl border border-amber-200 bg-amber-50 p-3"
                  >
                    <p className="text-xs font-black uppercase tracking-wide text-amber-700">
                      {getRegNo(voter)}
                    </p>
                    <p className="mt-1 truncate font-black text-slate-950">
                      {getDisplayName(voter)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {voter.zone || "No zone"} ·{" "}
                      {voter.polling_area || "No polling area"}
                    </p>
                  </div>
                ))}

                {issueVoters.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">
                    No pickup issues right now.
                  </div>
                )}
              </div>

              <div className="mt-4 grid gap-2">
                <Link
                  href="/campaigners"
                  className="rounded-2xl border border-slate-200 p-3 text-sm font-black text-slate-800 hover:bg-slate-50"
                >
                  Open Field View
                </Link>
                <Link
                  href="/team"
                  className="rounded-2xl border border-slate-200 p-3 text-sm font-black text-slate-800 hover:bg-slate-50"
                >
                  Manage Team
                </Link>
              </div>
            </PageCard>
          </div>
        </div>
      </section>
    </main>
  );
}
