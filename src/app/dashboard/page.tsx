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

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
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

function getVictoryStatus(projectedVotes: number, confirmed: number, target: number) {
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

function statusBadgeClass(tone: string) {
  if (tone === "green") return "bg-green-100 text-green-800";
  if (tone === "blue") return "bg-blue-100 text-blue-800";
  if (tone === "amber") return "bg-amber-100 text-amber-800";
  if (tone === "orange") return "bg-orange-100 text-orange-800";
  if (tone === "red") return "bg-red-100 text-red-800";

  return "bg-slate-100 text-slate-800";
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

    const notSupporting = voters.filter(
      (voter) => voter.support_status === "Not Supporting"
    ).length;

    const doNotContact = voters.filter(
      (voter) => voter.support_status === "Do Not Contact"
    ).length;

    const pickupNeeded = voters.filter((voter) => voter.pickup_needed).length;

    const pickupIssues = voters.filter(
      (voter) => voter.pickup_status === "Issue"
    ).length;

    const voted = voters.filter((voter) => voter.voted).length;

    const confirmedVoted = voters.filter(
      (voter) =>
        voter.voted && voter.support_status === "Confirmed Supporter"
    ).length;

    const confirmedNotVoted = voters.filter(
      (voter) =>
        !voter.voted && voter.support_status === "Confirmed Supporter"
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
      notSupporting,
      doNotContact,
      pickupNeeded,
      pickupIssues,
      voted,
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
      pickupRate: percentage(pickupNeeded, total),
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
      <main className="min-h-screen bg-slate-950 p-6">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-3xl border border-white/10 bg-white/10 p-10 text-center shadow-xl">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-300">
              Team Rigo
            </p>

            <h1 className="mt-4 text-3xl font-bold text-white">
              Loading path to victory...
            </h1>
          </div>
        </div>
      </main>
    );
  }

  if (profile?.role !== "Campaign Manager") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <div className="w-full max-w-xl rounded-2xl bg-white p-8 text-center shadow">
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
    <main className="min-h-screen bg-slate-100">
      <section className="bg-slate-950 px-6 py-8 text-white">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-300">
                Team Rigo
              </p>

              <h1 className="mt-3 text-4xl font-black tracking-tight md:text-5xl">
                Path to Victory Dashboard
              </h1>

              <p className="mt-3 max-w-3xl text-slate-300">
                Track whether the campaign is on pace to reach its vote target
                based on confirmed supporters, leaning supporters, turnout, and
                operational risks.
              </p>

              <p className="mt-3 text-sm text-slate-400">
                {settings?.election_name || "Team Rigo Campaign"} · Logged in
                as {profile?.full_name}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={loadDashboard}
                disabled={refreshing}
                className="rounded-2xl bg-white px-5 py-3 text-sm font-bold text-slate-950 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {refreshing ? "Refreshing..." : "Refresh Dashboard"}
              </button>

              <Link
                href="/campaign-setup"
                className="rounded-2xl border border-white/20 px-5 py-3 text-sm font-bold text-white hover:bg-white/10"
              >
                Campaign Setup
              </Link>

              <Link
                href="/voters"
                className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-700"
              >
                Manage Voters
              </Link>
            </div>
          </div>

          {message && (
            <div className="mt-6 rounded-2xl border border-red-400/40 bg-red-500/10 p-4 text-sm font-semibold text-red-100">
              {message}
            </div>
          )}

          {stats.target <= 0 && (
            <div className="mt-6 rounded-2xl border border-amber-400/40 bg-amber-500/10 p-4 text-sm font-semibold text-amber-100">
              Vote target is not set. Go to Campaign Setup and enter the Vote
              Target to Win.
            </div>
          )}

          <div className="mt-8 grid gap-4 xl:grid-cols-4">
            <div className="rounded-3xl border border-white/10 bg-white/10 p-6 shadow-xl xl:col-span-2">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-sm text-slate-300">Win Status</p>

                  <h2 className="mt-3 text-5xl font-black">
                    {stats.victoryStatus.label}
                  </h2>

                  <p className="mt-3 max-w-xl text-sm text-slate-300">
                    {stats.victoryStatus.description}
                  </p>
                </div>

                <span
                  className={`rounded-full px-4 py-2 text-sm font-black ${statusBadgeClass(
                    stats.victoryStatus.tone
                  )}`}
                >
                  {stats.projectedCushion >= 0
                    ? `+${formatNumber(stats.projectedCushion)} projected`
                    : `${formatNumber(stats.projectedCushion)} projected`}
                </span>
              </div>

              <div className="mt-6">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-300">Projected Vote Strength</span>
                  <span className="font-bold text-white">
                    {formatNumber(stats.projectedVotes)} /{" "}
                    {formatNumber(stats.target)}
                  </span>
                </div>

                <div className="mt-3 h-4 rounded-full bg-white/10">
                  <div
                    className="h-4 rounded-full bg-blue-400"
                    style={{
                      width: `${Math.min(stats.targetProgress, 100)}%`,
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

            <div className="rounded-3xl border border-green-400/30 bg-green-500/10 p-6 shadow-xl">
              <p className="text-sm text-green-200">Confirmed Supporters</p>
              <h2 className="mt-3 text-5xl font-black">
                {formatNumber(stats.confirmed)}
              </h2>
              <p className="mt-3 text-sm text-green-100">
                {stats.confirmedCushion >= 0
                  ? `${formatNumber(stats.confirmedCushion)} above target`
                  : `${formatNumber(
                      stats.votesNeededFromConfirmed
                    )} more confirmed needed`}
              </p>
            </div>

            <div className="rounded-3xl border border-blue-400/30 bg-blue-500/10 p-6 shadow-xl">
              <p className="text-sm text-blue-200">Projected Votes</p>
              <h2 className="mt-3 text-5xl font-black">
                {formatNumber(stats.projectedVotes)}
              </h2>
              <p className="mt-3 text-sm text-blue-100">
                {stats.votesNeededFromProjected > 0
                  ? `${formatNumber(
                      stats.votesNeededFromProjected
                    )} projected votes short`
                  : "Projection meets the target"}
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-3xl border border-white/10 bg-white/10 p-6 shadow-xl">
              <p className="text-sm text-slate-300">Vote Target to Win</p>
              <h2 className="mt-3 text-4xl font-black">
                {formatNumber(stats.target)}
              </h2>
              <p className="mt-3 text-sm text-slate-400">
                Set by Campaign Manager.
              </p>
            </div>

            <div className="rounded-3xl border border-purple-400/30 bg-purple-500/10 p-6 shadow-xl">
              <p className="text-sm text-purple-200">Leaning Supporters</p>
              <h2 className="mt-3 text-4xl font-black">
                {formatNumber(stats.leaning)}
              </h2>
              <p className="mt-3 text-sm text-purple-100">
                Counted as 50% in projection.
              </p>
            </div>

            <div className="rounded-3xl border border-amber-400/30 bg-amber-500/10 p-6 shadow-xl">
              <p className="text-sm text-amber-200">
                Confirmed Not Yet Voted
              </p>
              <h2 className="mt-3 text-4xl font-black">
                {formatNumber(stats.confirmedNotVoted)}
              </h2>
              <p className="mt-3 text-sm text-amber-100">
                Key turnout follow-up group.
              </p>
            </div>

            <div className="rounded-3xl border border-green-400/30 bg-green-500/10 p-6 shadow-xl">
              <p className="text-sm text-green-200">Confirmed Voted</p>
              <h2 className="mt-3 text-4xl font-black">
                {formatNumber(stats.confirmedVoted)}
              </h2>
              <p className="mt-3 text-sm text-green-100">
                {stats.confirmedTurnoutRate}% of confirmed supporters voted.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 py-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-6 xl:grid-cols-3">
            <section className="rounded-3xl bg-white p-6 shadow xl:col-span-2">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-2xl font-black text-slate-900">
                    Victory Risk Indicators
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    These numbers show where the campaign may be losing ground.
                  </p>
                </div>

                <Link
                  href="/reports"
                  className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
                >
                  View Reports
                </Link>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl bg-red-50 p-5">
                  <p className="text-sm text-red-700">Unassigned Voters</p>
                  <h3 className="mt-2 text-3xl font-black text-red-800">
                    {formatNumber(stats.unassigned)}
                  </h3>
                  <p className="mt-2 text-sm text-red-700">
                    Not assigned to a campaigner.
                  </p>
                </div>

                <div className="rounded-2xl bg-amber-50 p-5">
                  <p className="text-sm text-amber-700">Pickup Issues</p>
                  <h3 className="mt-2 text-3xl font-black text-amber-800">
                    {formatNumber(stats.pickupIssues)}
                  </h3>
                  <p className="mt-2 text-sm text-amber-700">
                    Requires immediate attention.
                  </p>
                </div>

                <div className="rounded-2xl bg-orange-50 p-5">
                  <p className="text-sm text-orange-700">
                    Confirmed Pickup Not Voted
                  </p>
                  <h3 className="mt-2 text-3xl font-black text-orange-800">
                    {formatNumber(stats.confirmedPickupNotVoted)}
                  </h3>
                  <p className="mt-2 text-sm text-orange-700">
                    Confirmed supporters needing transportation.
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-50 p-5">
                  <p className="text-sm text-slate-500">Unknown Status</p>
                  <h3 className="mt-2 text-3xl font-black text-slate-900">
                    {formatNumber(stats.unknown)}
                  </h3>
                  <p className="mt-2 text-sm text-slate-500">
                    Needs classification.
                  </p>
                </div>

                <div className="rounded-2xl bg-purple-50 p-5">
                  <p className="text-sm text-purple-700">Undecided</p>
                  <h3 className="mt-2 text-3xl font-black text-purple-800">
                    {formatNumber(stats.undecided)}
                  </h3>
                  <p className="mt-2 text-sm text-purple-700">
                    Not counted in projection.
                  </p>
                </div>

                <div className="rounded-2xl bg-blue-50 p-5">
                  <p className="text-sm text-blue-700">Assignment Coverage</p>
                  <h3 className="mt-2 text-3xl font-black text-blue-800">
                    {stats.assignmentRate}%
                  </h3>
                  <p className="mt-2 text-sm text-blue-700">
                    {formatNumber(stats.assigned)} assigned of{" "}
                    {formatNumber(stats.total)}.
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-3xl bg-white p-6 shadow">
              <h2 className="text-2xl font-black text-slate-900">
                Quick Actions
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Go directly to the work that affects the win number.
              </p>

              <div className="mt-6 grid gap-3">
                <Link
                  href="/voters"
                  className="rounded-2xl border border-slate-200 p-4 font-bold text-slate-800 hover:border-blue-300 hover:bg-blue-50"
                >
                  Review voter support status
                </Link>

                <Link
                  href="/campaigners"
                  className="rounded-2xl border border-slate-200 p-4 font-bold text-slate-800 hover:border-blue-300 hover:bg-blue-50"
                >
                  Open field operation view
                </Link>

                <Link
                  href="/team"
                  className="rounded-2xl border border-slate-200 p-4 font-bold text-slate-800 hover:border-blue-300 hover:bg-blue-50"
                >
                  Manage team access
                </Link>

                <Link
                  href="/upload"
                  className="rounded-2xl border border-slate-200 p-4 font-bold text-slate-800 hover:border-blue-300 hover:bg-blue-50"
                >
                  Upload updated voter CSV
                </Link>

                <Link
                  href="/campaign-setup"
                  className="rounded-2xl border border-slate-200 p-4 font-bold text-slate-800 hover:border-blue-300 hover:bg-blue-50"
                >
                  Update vote target, zones, polling areas
                </Link>
              </div>
            </section>
          </div>

          <section className="mt-6 rounded-3xl bg-white p-6 shadow">
            <h2 className="text-2xl font-black text-slate-900">
              Zone Battle Map
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Shows which zones are carrying the campaign and where turnout or
              pickup risks exist.
            </p>

            <div className="mt-6 overflow-x-auto">
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

                      <td className="p-3 text-amber-700 font-bold">
                        {formatNumber(item.confirmedRemaining)}
                      </td>

                      <td className="p-3 text-orange-700 font-bold">
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

          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            <section className="rounded-3xl bg-white p-6 shadow">
              <h2 className="text-2xl font-black text-slate-900">
                Polling Area Watch
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Confirmed supporters, turnout, and pickup needs by polling
                area.
              </p>

              <div className="mt-6 space-y-4">
                {pollingSummary.map((item) => {
                  const turnout = percentage(item.voted, item.total);

                  return (
                    <div
                      key={item.pollingArea}
                      className="rounded-2xl border border-slate-200 p-4"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-black text-slate-900">
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

                      <div className="mt-3 h-3 rounded-full bg-slate-200">
                        <div
                          className="h-3 rounded-full bg-green-600"
                          style={{ width: `${turnout}%` }}
                        />
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

            <section className="rounded-3xl bg-white p-6 shadow">
              <h2 className="text-2xl font-black text-slate-900">
                Campaigner Contribution
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Campaigners ranked by confirmed supporters assigned.
              </p>

              <div className="mt-6 space-y-3">
                {campaignerSummary.map((item, index) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-slate-200 p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-black text-slate-900">
                          {index + 1}. {item.name}
                        </p>
                        <p className="text-sm text-slate-500">
                          {item.zone || "No zone assigned"}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {formatNumber(item.votedConfirmed)} confirmed voted ·{" "}
                          {formatNumber(item.pickupNeeded)} pickup needed
                        </p>
                      </div>

                      <div className="rounded-2xl bg-blue-50 px-4 py-2 text-right">
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

                {campaignerSummary.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
                    No campaigner assignments found.
                  </div>
                )}
              </div>
            </section>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            <section className="rounded-3xl bg-white p-6 shadow">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-2xl font-black text-slate-900">
                    Pickup Issues
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Voters currently marked with pickup issues.
                  </p>
                </div>

                <Link
                  href="/campaigners"
                  className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
                >
                  Open Field View
                </Link>
              </div>

              <div className="mt-6 space-y-3">
                {issueVoters.map((voter) => (
                  <div
                    key={voter.id}
                    className="rounded-2xl border border-amber-200 bg-amber-50 p-4"
                  >
                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-amber-700">
                          {getRegNo(voter)}
                        </p>

                        <p className="mt-1 text-lg font-black text-slate-900">
                          {getDisplayName(voter)}
                        </p>

                        <p className="mt-1 text-sm text-slate-600">
                          Zone: {voter.zone || "No zone"} · Polling:{" "}
                          {voter.polling_area || "No polling area"}
                        </p>

                        {voter.notes && (
                          <p className="mt-2 text-sm text-amber-900">
                            {voter.notes}
                          </p>
                        )}
                      </div>

                      <span className="rounded-full bg-amber-200 px-3 py-1 text-xs font-black text-amber-900">
                        Issue
                      </span>
                    </div>
                  </div>
                ))}

                {issueVoters.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
                    No pickup issues at this time.
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-3xl bg-white p-6 shadow">
              <h2 className="text-2xl font-black text-slate-900">
                Team Structure
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Active team members by role.
              </p>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 p-5">
                  <p className="text-sm text-slate-500">Total Team</p>
                  <h3 className="mt-2 text-3xl font-black text-slate-900">
                    {teamStats.total}
                  </h3>
                </div>

                <div className="rounded-2xl bg-purple-50 p-5">
                  <p className="text-sm text-purple-700">Zone Leaders</p>
                  <h3 className="mt-2 text-3xl font-black text-purple-800">
                    {teamStats.zoneLeaders}
                  </h3>
                </div>

                <div className="rounded-2xl bg-green-50 p-5">
                  <p className="text-sm text-green-700">Campaigners</p>
                  <h3 className="mt-2 text-3xl font-black text-green-800">
                    {teamStats.campaigners}
                  </h3>
                </div>

                <div className="rounded-2xl bg-amber-50 p-5">
                  <p className="text-sm text-amber-700">Drivers</p>
                  <h3 className="mt-2 text-3xl font-black text-amber-800">
                    {teamStats.drivers}
                  </h3>
                </div>

                <div className="rounded-2xl bg-red-50 p-5">
                  <p className="text-sm text-red-700">Scrutineers</p>
                  <h3 className="mt-2 text-3xl font-black text-red-800">
                    {teamStats.scrutineers}
                  </h3>
                </div>

                <div className="rounded-2xl bg-blue-50 p-5">
                  <p className="text-sm text-blue-700">Managers</p>
                  <h3 className="mt-2 text-3xl font-black text-blue-800">
                    {teamStats.managers}
                  </h3>
                </div>
              </div>
            </section>
          </div>
        </div>
      </section>
    </main>
  );
}