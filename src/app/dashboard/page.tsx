"use client";

import Link from "next/link";
import type { ReactNode } from "react";
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
  undecided: number;
  unknownOther: number;
  margin: number;
  liveOur: number;
  liveOpponent: number;
  liveUndecided: number;
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

type VerdictTone = "green" | "amber" | "orange" | "red" | "slate";

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(Math.round(value) || 0);
}

function formatSigned(value: number) {
  return value >= 0 ? `+${formatNumber(value)}` : `-${formatNumber(Math.abs(value))}`;
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

function isOurSupport(status: string | null) {
  return status === "Confirmed Supporter" || status === "Leaning Supporter";
}

function isConfirmedSupport(status: string | null) {
  return status === "Confirmed Supporter";
}

function isLeaningSupport(status: string | null) {
  return status === "Leaning Supporter";
}

function isOpponentSupport(status: string | null) {
  return status === "Not Supporting";
}

function isUndecidedSupport(status: string | null) {
  return status === "Undecided";
}

function isUnknownStatus(status: string | null) {
  return !status || status === "Unknown";
}

function getVerdict(
  ourProjected: number,
  confirmed: number,
  opponentProjected: number,
  target: number
): { label: string; description: string; tone: VerdictTone } {
  if (!target || target <= 0) {
    return {
      label: "Set Target",
      description: "Enter the vote target in Campaign Setup to activate the win status.",
      tone: "slate",
    };
  }

  const margin = ourProjected - opponentProjected;
  const progress = ourProjected / target;

  if (confirmed >= target && margin > 0) {
    return {
      label: "Winning",
      description: "Confirmed supporters already clear the target and lead the opponent.",
      tone: "green",
    };
  }

  if (progress >= 1 && margin > 0) {
    return {
      label: "Ahead",
      description: "Projected support clears the target and leads the opponent.",
      tone: "green",
    };
  }

  if (progress >= 1 && margin <= 0) {
    return {
      label: "Contested",
      description: "The target is in reach, but the opponent estimate is too close.",
      tone: "amber",
    };
  }

  if (progress >= 0.9) {
    return {
      label: "Tossup",
      description: "Close to the target. Confirming support and turnout now matters.",
      tone: "amber",
    };
  }

  if (progress >= 0.75) {
    return {
      label: "Behind",
      description: "Below the target. More confirmed supporters are needed.",
      tone: "orange",
    };
  }

  return {
    label: "Critical",
    description: "Well below the target. Field follow-up should be prioritized.",
    tone: "red",
  };
}

function toneClasses(tone: VerdictTone) {
  if (tone === "green") {
    return {
      card: "border-green-200 bg-green-50",
      badge: "bg-green-100 text-green-800",
      text: "text-green-700",
    };
  }

  if (tone === "amber") {
    return {
      card: "border-amber-200 bg-amber-50",
      badge: "bg-amber-100 text-amber-800",
      text: "text-amber-700",
    };
  }

  if (tone === "orange") {
    return {
      card: "border-orange-200 bg-orange-50",
      badge: "bg-orange-100 text-orange-800",
      text: "text-orange-700",
    };
  }

  if (tone === "red") {
    return {
      card: "border-red-200 bg-red-50",
      badge: "bg-red-100 text-red-800",
      text: "text-red-700",
    };
  }

  return {
    card: "border-slate-200 bg-slate-50",
    badge: "bg-slate-100 text-slate-800",
    text: "text-slate-700",
  };
}

function useCountUp(target: number, duration = 700) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!Number.isFinite(target)) {
      setValue(0);
      return;
    }

    const reducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (reducedMotion) {
      setValue(target);
      return;
    }

    let frame = 0;
    const start = performance.now();

    function tick(now: number) {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);

      setValue(Math.round(target * eased));

      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      }
    }

    frame = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return value;
}

function CountUp({ value }: { value: number }) {
  const display = useCountUp(value);

  return <span className="tabular-nums">{formatNumber(display)}</span>;
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
        <h2 className="break-words text-xl font-black tracking-tight text-slate-950 sm:text-2xl">
          {title}
        </h2>
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      </div>

      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  tone = "slate",
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  tone?: "blue" | "green" | "red" | "amber" | "orange" | "purple" | "slate";
}) {
  const color =
    tone === "blue"
      ? "text-blue-700 bg-blue-50 border-blue-100"
      : tone === "green"
      ? "text-green-700 bg-green-50 border-green-100"
      : tone === "red"
      ? "text-red-700 bg-red-50 border-red-100"
      : tone === "amber"
      ? "text-amber-700 bg-amber-50 border-amber-100"
      : tone === "orange"
      ? "text-orange-700 bg-orange-50 border-orange-100"
      : tone === "purple"
      ? "text-purple-700 bg-purple-50 border-purple-100"
      : "text-slate-700 bg-white border-slate-200";

  return (
    <div className={`rounded-3xl border p-4 shadow-sm ${color}`}>
      <p className="text-xs font-black uppercase tracking-wide opacity-70">
        {title}
      </p>
      <p className="mt-2 text-3xl font-black tracking-tight">
        {typeof value === "number" ? <CountUp value={value} /> : value}
      </p>
      {subtitle && <p className="mt-1 text-xs font-semibold opacity-75">{subtitle}</p>}
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

function SegmentedBar({
  ourPct,
  contestedPct,
  opponentPct,
  winPct,
  showWinLine,
}: {
  ourPct: number;
  contestedPct: number;
  opponentPct: number;
  winPct: number;
  showWinLine: boolean;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));

    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div className={`relative ${showWinLine ? "pt-6" : ""}`}>
      <div className="flex h-6 w-full overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200">
        <div
          className="h-6 bg-blue-600 transition-[width] duration-700"
          style={{ width: `${mounted ? clampPercentage(ourPct) : 0}%` }}
        />
        <div
          className="h-6 bg-amber-400 transition-[width] duration-700"
          style={{ width: `${mounted ? clampPercentage(contestedPct) : 0}%` }}
        />
        <div
          className="h-6 bg-red-600 transition-[width] duration-700"
          style={{ width: `${mounted ? clampPercentage(opponentPct) : 0}%` }}
        />
      </div>

      {showWinLine && (
        <div
          className="pointer-events-none absolute bottom-0 top-6 z-10"
          style={{ left: `${clampPercentage(winPct)}%` }}
        >
          <div className="h-full w-0.5 -translate-x-1/2 bg-slate-950 shadow" />
          <span className="absolute -top-6 left-0 -translate-x-1/2 whitespace-nowrap rounded-full bg-slate-950 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-white">
            Win Line
          </span>
        </div>
      )}
    </div>
  );
}

function LiveComparisonBar({
  label,
  value,
  total,
  tone,
  remaining,
}: {
  label: string;
  value: number;
  total: number;
  tone: "blue" | "red" | "amber";
  remaining: number;
}) {
  const color =
    tone === "blue"
      ? "bg-blue-600 text-blue-700"
      : tone === "red"
      ? "bg-red-600 text-red-700"
      : "bg-amber-500 text-amber-700";

  const width = clampPercentage(percentage(value, total));

  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-black text-slate-900">{label}</span>
        <span className={`font-black ${color.split(" ")[1]}`}>
          {formatNumber(value)}
        </span>
      </div>

      <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-3 rounded-full ${color.split(" ")[0]}`} style={{ width: `${width}%` }} />
      </div>

      <p className="mt-1 text-xs font-semibold text-slate-400">
        Remaining in group: {formatNumber(remaining)}
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
    const undecided = voters.filter((voter) =>
      isUndecidedSupport(voter.support_status)
    ).length;
    const unknown = voters.filter((voter) =>
      isUnknownStatus(voter.support_status)
    ).length;
    const doNotContact = voters.filter(
      (voter) => voter.support_status === "Do Not Contact"
    ).length;

    const opponentProjected = voters.filter((voter) =>
      isOpponentSupport(voter.support_status)
    ).length;

    const ourProjected = Math.round(confirmed + leaning * 0.5);
    const undecidedUnknown = undecided + unknown;
    const unknownOther = Math.max(
      0,
      total - confirmed - leaning - opponentProjected - undecided
    );
    const contestedProjected = Math.max(0, total - ourProjected - opponentProjected);
    const margin = ourProjected - opponentProjected;

    const confirmedVoted = voters.filter(
      (voter) => voter.voted && isConfirmedSupport(voter.support_status)
    ).length;
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
    const confirmedPickupNotVoted = voters.filter(
      (voter) =>
        !voter.voted &&
        voter.pickup_needed &&
        isConfirmedSupport(voter.support_status)
    ).length;

    const votedComparisonTotal = ourVoted + opponentVoted + undecidedVoted;
    const pickupIssues = voters.filter(
      (voter) => voter.pickup_status === "Issue"
    ).length;
    const assigned = voters.filter((voter) => voter.campaigner_id).length;
    const unassigned = total - assigned;

    const targetProgress = percentage(ourProjected, target);
    const assignmentRate = percentage(assigned, total);
    const confirmedTurnoutRate = percentage(confirmedVoted, confirmed);
    const votesNeededFromProjected = Math.max(0, target - ourProjected);
    const votesNeededFromConfirmed = Math.max(0, target - confirmed);

    const verdict = getVerdict(
      ourProjected,
      confirmed,
      opponentProjected,
      target
    );

    return {
      total,
      target,
      confirmed,
      leaning,
      undecided,
      unknown,
      doNotContact,
      opponentProjected,
      ourProjected,
      undecidedUnknown,
      unknownOther,
      contestedProjected,
      margin,
      confirmedVoted,
      ourVoted,
      opponentVoted,
      undecidedVoted,
      ourRemaining,
      opponentRemaining,
      undecidedRemaining,
      confirmedRemaining,
      confirmedPickupNotVoted,
      votedComparisonTotal,
      pickupIssues,
      assigned,
      unassigned,
      targetProgress,
      assignmentRate,
      confirmedTurnoutRate,
      votesNeededFromProjected,
      votesNeededFromConfirmed,
      confirmedCushion: confirmed - target,
      projectedCushion: ourProjected - target,
      ourPct: total > 0 ? (ourProjected / total) * 100 : 0,
      opponentPct: total > 0 ? (opponentProjected / total) * 100 : 0,
      contestedPct: total > 0 ? (contestedProjected / total) * 100 : 0,
      winPct: target > 0 && total > 0 ? (target / total) * 100 : 0,
      verdict,
    };
  }, [voters, settings]);

  const zoneSummary = useMemo(() => {
    const map = new Map<string, ZoneSummary>();

    function blank(zone: string): ZoneSummary {
      return {
        zone,
        total: 0,
        confirmed: 0,
        leaning: 0,
        ourProjected: 0,
        opponentProjected: 0,
        undecided: 0,
        unknownOther: 0,
        margin: 0,
        liveOur: 0,
        liveOpponent: 0,
        liveUndecided: 0,
        confirmedVoted: 0,
        confirmedRemaining: 0,
        pickupNeeded: 0,
        pickupIssues: 0,
      };
    }

    setupZones.forEach((zone) => {
      map.set(zone.name, blank(zone.name));
    });

    voters.forEach((voter) => {
      const zone = voter.zone || "No Zone";

      if (!map.has(zone)) {
        map.set(zone, blank(zone));
      }

      const item = map.get(zone)!;

      item.total += 1;

      if (isConfirmedSupport(voter.support_status)) {
        item.confirmed += 1;

        if (voter.voted) {
          item.confirmedVoted += 1;
        } else {
          item.confirmedRemaining += 1;
        }
      }

      if (isLeaningSupport(voter.support_status)) {
        item.leaning += 1;
      }

      if (isOpponentSupport(voter.support_status)) {
        item.opponentProjected += 1;
      }

      if (isUndecidedSupport(voter.support_status)) {
        item.undecided += 1;
      }

      if (
        !isOurSupport(voter.support_status) &&
        !isOpponentSupport(voter.support_status) &&
        !isUndecidedSupport(voter.support_status)
      ) {
        item.unknownOther += 1;
      }

      if (voter.voted && isOurSupport(voter.support_status)) {
        item.liveOur += 1;
      }

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
      .slice(0, 10);
  }, [campaigners, voters]);

  const teamStats = useMemo(() => {
    return {
      total: campaigners.length,
      managers: campaigners.filter((person) => person.role === "Campaign Manager")
        .length,
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
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm">
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
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4 sm:p-6">
        <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-8">
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

  const verdictStyle = toneClasses(stats.verdict.tone);
  const electionName = settings?.election_name || `${OUR_NAME} Campaign`;

  return (
    <main className="min-h-screen overflow-x-hidden bg-slate-50 text-slate-950">
      <section className="border-b border-slate-200 bg-white px-4 py-5 sm:px-6 sm:py-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-5xl">
                Dashboard
              </h1>
              <p className="mt-2 truncate text-sm text-slate-500">
                {electionName} · {profile?.full_name}
              </p>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1 sm:grid sm:grid-cols-3 sm:overflow-visible sm:pb-0 xl:flex">
              <button
                onClick={loadDashboard}
                disabled={refreshing}
                className="shrink-0 rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 sm:rounded-2xl sm:px-5 sm:py-3"
              >
                {refreshing ? "Refreshing..." : "Refresh"}
              </button>

              <Link
                href="/campaign-setup"
                className="shrink-0 rounded-full border border-slate-300 bg-white px-4 py-2 text-center text-sm font-black text-slate-800 hover:bg-slate-50 sm:rounded-2xl sm:px-5 sm:py-3"
              >
                Setup
              </Link>

              <Link
                href="/voters"
                className="shrink-0 rounded-full bg-blue-700 px-4 py-2 text-center text-sm font-black text-white hover:bg-blue-800 sm:rounded-2xl sm:px-5 sm:py-3"
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

          {stats.target <= 0 && (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">
              Vote target is not set. Open Campaign Setup and enter the Vote
              Target to Win to activate the win status.
            </div>
          )}

          <div className={`mt-5 rounded-3xl border p-5 shadow-sm sm:p-6 ${verdictStyle.card}`}>
            <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
                  Win Status
                </p>

                <h2 className={`mt-2 text-4xl font-black tracking-tight sm:text-6xl ${verdictStyle.text}`}>
                  {stats.verdict.label}
                </h2>

                <p className="mt-2 max-w-xl text-sm font-semibold text-slate-600">
                  {stats.verdict.description}
                </p>
              </div>

              <div className="rounded-3xl bg-white p-4 text-left shadow-sm lg:min-w-[260px] lg:text-right">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                  Projected Margin
                </p>

                <p
                  className={`mt-2 text-4xl font-black ${
                    stats.margin >= 0 ? "text-green-700" : "text-red-700"
                  }`}
                >
                  {formatSigned(stats.margin)}
                </p>

                <p className="mt-1 text-xs font-semibold text-slate-500">
                  {stats.projectedCushion >= 0
                    ? `${formatNumber(stats.projectedCushion)} over target`
                    : `${formatNumber(stats.votesNeededFromProjected)} short of target`}
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-3xl bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-black text-slate-900">
                    Projected Position
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Blue = {OUR_NAME}, amber = undecided/unknown, red ={" "}
                    {opponentName}.
                  </p>
                </div>

                <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">
                  Target: {formatNumber(stats.target)}
                </span>
              </div>

              <div className="mt-5">
                <SegmentedBar
                  ourPct={stats.ourPct}
                  contestedPct={stats.contestedPct}
                  opponentPct={stats.opponentPct}
                  winPct={stats.winPct}
                  showWinLine={stats.target > 0}
                />
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs sm:gap-3">
                <div className="rounded-2xl bg-blue-50 p-3 text-blue-800">
                  <p className="font-black">{formatNumber(stats.ourProjected)}</p>
                  <p className="mt-0.5 font-semibold">Team Rigo projected</p>
                </div>

                <div className="rounded-2xl bg-amber-50 p-3 text-amber-800">
                  <p className="font-black">{formatNumber(stats.contestedProjected)}</p>
                  <p className="mt-0.5 font-semibold">Undecided / unknown</p>
                </div>

                <div className="rounded-2xl bg-red-50 p-3 text-red-800">
                  <p className="font-black">{formatNumber(stats.opponentProjected)}</p>
                  <p className="mt-0.5 font-semibold">{opponentName}</p>
                </div>
              </div>

              <p className="mt-4 text-xs text-slate-500">
                Projection = confirmed supporters + 50% of leaning supporters.
                Opponent estimate = voters marked Not Supporting. This is an
                operational estimate, not a record of how anyone voted.
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <SectionHeader
                title="Projected Voter Position"
                subtitle="Before voting starts, this is the campaign position."
              />

              <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-3 font-black sm:px-4">Group</th>
                      <th className="px-3 py-3 text-right font-black sm:px-4">
                        Confirmed
                      </th>
                      <th className="px-3 py-3 text-right font-black sm:px-4">
                        Leaning
                      </th>
                      <th className="px-3 py-3 text-right font-black sm:px-4">
                        Projected
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <td className="px-3 py-3 font-black text-slate-900 sm:px-4">
                        {OUR_NAME}
                      </td>
                      <td className="px-3 py-3 text-right font-bold text-green-700 sm:px-4">
                        {formatNumber(stats.confirmed)}
                      </td>
                      <td className="px-3 py-3 text-right font-bold text-blue-700 sm:px-4">
                        {formatNumber(stats.leaning)}
                      </td>
                      <td className="px-3 py-3 text-right font-black text-blue-700 sm:px-4">
                        {formatNumber(stats.ourProjected)}
                      </td>
                    </tr>

                    <tr>
                      <td className="px-3 py-3 font-black text-slate-900 sm:px-4">
                        {opponentName}
                      </td>
                      <td className="px-3 py-3 text-right font-bold text-red-700 sm:px-4">
                        {formatNumber(stats.opponentProjected)}
                      </td>
                      <td className="px-3 py-3 text-right font-bold text-slate-400 sm:px-4">
                        —
                      </td>
                      <td className="px-3 py-3 text-right font-black text-red-700 sm:px-4">
                        {formatNumber(stats.opponentProjected)}
                      </td>
                    </tr>

                    <tr>
                      <td className="px-3 py-3 font-black text-slate-900 sm:px-4">
                        Undecided / Unknown
                      </td>
                      <td className="px-3 py-3 text-right font-bold text-amber-700 sm:px-4">
                        {formatNumber(stats.undecidedUnknown)}
                      </td>
                      <td className="px-3 py-3 text-right font-bold text-slate-400 sm:px-4">
                        —
                      </td>
                      <td className="px-3 py-3 text-right font-black text-amber-700 sm:px-4">
                        {formatNumber(stats.undecidedUnknown)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <SectionHeader
                title="Voting Started Comparison"
                subtitle="Once scrutineers mark voters, this shows turnout by support group."
              />

              <div className="mt-5 space-y-5">
                <LiveComparisonBar
                  label={OUR_NAME}
                  value={stats.ourVoted}
                  total={stats.votedComparisonTotal}
                  tone="blue"
                  remaining={stats.ourRemaining}
                />

                <LiveComparisonBar
                  label={opponentName}
                  value={stats.opponentVoted}
                  total={stats.votedComparisonTotal}
                  tone="red"
                  remaining={stats.opponentRemaining}
                />

                <LiveComparisonBar
                  label="Undecided / Unknown"
                  value={stats.undecidedVoted}
                  total={stats.votedComparisonTotal}
                  tone="amber"
                  remaining={stats.undecidedRemaining}
                />
              </div>

              <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-bold text-slate-600">
                    Total marked voted
                  </span>
                  <span className="font-black text-slate-950">
                    {formatNumber(stats.votedComparisonTotal)}
                  </span>
                </div>

                <div className="mt-2 flex items-center justify-between gap-3">
                  <span className="font-bold text-slate-600">
                    Confirmed supporters still left
                  </span>
                  <span className="font-black text-amber-700">
                    {formatNumber(stats.confirmedRemaining)}
                  </span>
                </div>
              </div>

              <p className="mt-4 text-xs text-slate-500">
                The live comparison uses support status plus the scrutineer voted
                marker. It is not a record of anyone’s private ballot.
              </p>
            </section>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            <StatCard
              title="Confirmed"
              value={stats.confirmed}
              tone="green"
              subtitle={
                stats.votesNeededFromConfirmed > 0
                  ? `${formatNumber(stats.votesNeededFromConfirmed)} needed`
                  : "Target cleared"
              }
            />

            <StatCard
              title="Projected"
              value={stats.ourProjected}
              tone="blue"
              subtitle={
                stats.votesNeededFromProjected > 0
                  ? `${formatNumber(stats.votesNeededFromProjected)} short`
                  : "At or above target"
              }
            />

            <StatCard
              title="Opponent"
              value={stats.opponentProjected}
              tone="red"
              subtitle="From Not Supporting"
            />

            <StatCard
              title="Unassigned"
              value={stats.unassigned}
              tone={stats.unassigned > 0 ? "red" : "green"}
              subtitle="No campaigner"
            />

            <StatCard
              title="Pickup Issues"
              value={stats.pickupIssues}
              tone={stats.pickupIssues > 0 ? "red" : "green"}
              subtitle="Needs action"
            />

            <StatCard
              title="Assignment"
              value={`${stats.assignmentRate}%`}
              tone="purple"
              subtitle={`${formatNumber(stats.assigned)} of ${formatNumber(stats.total)}`}
            />
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

          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <SectionHeader
              title="Zone Battle Map"
              subtitle="Support, turnout, margin and pickup risk by zone."
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
              {zoneSummary.map((item) => {
                const decided =
                  item.ourProjected + item.opponentProjected + item.undecided;
                const ourWidth =
                  decided > 0 ? (item.ourProjected / decided) * 100 : 0;
                const opponentWidth =
                  decided > 0 ? (item.opponentProjected / decided) * 100 : 0;
                const undecidedWidth =
                  decided > 0 ? (item.undecided / decided) * 100 : 0;

                return (
                  <div
                    key={item.zone}
                    className="min-w-0 rounded-3xl border border-slate-200 p-4"
                  >
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="break-words text-base font-black text-slate-950">
                          {item.zone}
                        </h3>
                        <p className="mt-1 text-xs text-slate-500">
                          Total: {formatNumber(item.total)}
                        </p>
                      </div>

                      <span
                        className={`w-fit shrink-0 rounded-full px-3 py-1 text-xs font-black ${
                          item.margin >= 0
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {formatSigned(item.margin)}
                      </span>
                    </div>

                    <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-3 bg-blue-600"
                        style={{ width: `${clampPercentage(ourWidth)}%` }}
                      />
                      <div
                        className="h-3 bg-amber-400"
                        style={{ width: `${clampPercentage(undecidedWidth)}%` }}
                      />
                      <div
                        className="h-3 bg-red-600"
                        style={{ width: `${clampPercentage(opponentWidth)}%` }}
                      />
                    </div>

                    <div className="mt-4 grid grid-cols-4 gap-2 text-center">
                      <div>
                        <p className="text-[11px] font-bold text-slate-400">
                          Us
                        </p>
                        <p className="text-lg font-black text-blue-700">
                          {formatNumber(item.ourProjected)}
                        </p>
                      </div>

                      <div>
                        <p className="text-[11px] font-bold text-slate-400">
                          Opp.
                        </p>
                        <p className="text-lg font-black text-red-700">
                          {formatNumber(item.opponentProjected)}
                        </p>
                      </div>

                      <div>
                        <p className="text-[11px] font-bold text-slate-400">
                          Left
                        </p>
                        <p className="text-lg font-black text-amber-700">
                          {formatNumber(item.confirmedRemaining)}
                        </p>
                      </div>

                      <div>
                        <p className="text-[11px] font-bold text-slate-400">
                          Issues
                        </p>
                        <p className="text-lg font-black text-orange-700">
                          {formatNumber(item.pickupIssues)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}

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
                    <th className="px-3 py-3 font-black text-blue-700">
                      Our projected
                    </th>
                    <th className="px-3 py-3 font-black text-red-700">
                      Opponent
                    </th>
                    <th className="px-3 py-3 font-black">Margin</th>
                    <th className="px-3 py-3 font-black">Live us</th>
                    <th className="px-3 py-3 font-black">Live opp.</th>
                    <th className="px-3 py-3 font-black">Confirmed left</th>
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
                      <td className="px-3 py-3 tabular-nums text-slate-600">
                        {formatNumber(item.total)}
                      </td>
                      <td className="px-3 py-3 font-black tabular-nums text-blue-700">
                        {formatNumber(item.ourProjected)}
                      </td>
                      <td className="px-3 py-3 font-black tabular-nums text-red-700">
                        {formatNumber(item.opponentProjected)}
                      </td>
                      <td
                        className={`px-3 py-3 font-black tabular-nums ${
                          item.margin >= 0 ? "text-green-700" : "text-red-700"
                        }`}
                      >
                        {formatSigned(item.margin)}
                      </td>
                      <td className="px-3 py-3 font-bold tabular-nums text-blue-700">
                        {formatNumber(item.liveOur)}
                      </td>
                      <td className="px-3 py-3 font-bold tabular-nums text-red-700">
                        {formatNumber(item.liveOpponent)}
                      </td>
                      <td className="px-3 py-3 font-bold tabular-nums text-amber-700">
                        {formatNumber(item.confirmedRemaining)}
                      </td>
                      <td className="px-3 py-3 font-bold tabular-nums text-orange-700">
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
          </section>

          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
              <SectionHeader
                title="Polling Areas"
                subtitle="Turnout and pickup needs by polling station."
              />

              <div className="mt-4 space-y-3">
                {pollingSummary.map((item) => {
                  const turnout = percentage(item.voted, item.total);

                  return (
                    <div
                      key={item.pollingArea}
                      className="rounded-3xl border border-slate-200 p-4"
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

                        <p className="shrink-0 text-2xl font-black text-green-700">
                          {turnout}%
                        </p>
                      </div>

                      <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-3 rounded-full bg-green-600"
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
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
              <SectionHeader
                title="Field Leaderboard"
                subtitle="Campaigners ranked by confirmed supporters."
              />

              <div className="mt-4 space-y-3">
                {campaignerSummary.map((item, index) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 rounded-3xl border border-slate-200 p-4"
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

                    <div className="shrink-0 text-right">
                      <p className="text-xl font-black text-blue-700">
                        {formatNumber(item.confirmed)}
                      </p>
                      <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                        Conf.
                      </p>
                    </div>
                  </div>
                ))}

                {campaignerSummary.length === 0 && (
                  <div className="rounded-3xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                    No campaigner assignments found.
                  </div>
                )}
              </div>
            </section>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
              <SectionHeader
                title="Pickup Issues"
                subtitle="Voters flagged with transport problems."
                action={
                  <Link
                    href="/campaigners"
                    className="hidden rounded-2xl border border-slate-300 px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-50 sm:block"
                  >
                    Field View
                  </Link>
                }
              />

              <div className="mt-4 space-y-3">
                {issueVoters.map((voter) => (
                  <div
                    key={voter.id}
                    className="rounded-3xl border border-amber-200 bg-amber-50 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-black uppercase tracking-wide text-amber-700">
                          {getRegNo(voter)}
                        </p>
                        <p className="mt-1 truncate text-base font-black text-slate-950">
                          {getDisplayName(voter)}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {voter.zone || "No zone"} ·{" "}
                          {voter.polling_area || "No polling area"}
                        </p>
                      </div>

                      <span className="shrink-0 rounded-full bg-amber-200 px-3 py-1 text-xs font-black text-amber-900">
                        Issue
                      </span>
                    </div>
                  </div>
                ))}

                {issueVoters.length === 0 && (
                  <div className="rounded-3xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                    No pickup issues right now.
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
              <SectionHeader title="Team Roster" subtitle="Active members by role." />

              <div className="mt-4 grid grid-cols-3 gap-3">
                {[
                  ["Total", teamStats.total, "slate"],
                  ["Leaders", teamStats.zoneLeaders, "purple"],
                  ["Field", teamStats.campaigners, "green"],
                  ["Drivers", teamStats.drivers, "amber"],
                  ["Scrutineers", teamStats.scrutineers, "red"],
                  ["Managers", teamStats.managers, "blue"],
                ].map(([label, value, tone]) => (
                  <StatCard
                    key={String(label)}
                    title={String(label)}
                    value={Number(value)}
                    tone={
                      tone as
                        | "blue"
                        | "green"
                        | "red"
                        | "amber"
                        | "orange"
                        | "purple"
                        | "slate"
                    }
                  />
                ))}
              </div>

              <div className="mt-5 border-t border-slate-100 pt-5">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                  Next Actions
                </p>

                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {[
                    ["Work voter support status", "/voters"],
                    ["Open field operations", "/campaigners"],
                    ["Manage team access", "/team"],
                    ["Upload latest voter file", "/upload"],
                  ].map(([label, href]) => (
                    <Link
                      key={href}
                      href={href}
                      className="rounded-2xl border border-slate-200 p-4 text-sm font-black text-slate-800 hover:border-blue-300 hover:bg-blue-50"
                    >
                      {label}
                    </Link>
                  ))}
                </div>
              </div>
            </section>
          </div>
        </div>
      </section>
    </main>
  );
}
