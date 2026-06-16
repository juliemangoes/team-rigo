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
  pickupNeeded: number;
  voted: number;
};

type PollingSummary = {
  pollingArea: string;
  total: number;
  voted: number;
};

type CampaignerSummary = {
  id: string;
  name: string;
  role: string | null;
  zone: string | null;
  assigned: number;
};

function percentage(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((value / total) * 100);
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

export default function DashboardPage() {
  const [profile, setProfile] = useState<TeamProfile | null>(null);
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

    const [voterResult, campaignerResult, issueResult] = await Promise.all([
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

    const pickupNeeded = voters.filter((voter) => voter.pickup_needed).length;

    const pickupIssues = voters.filter(
      (voter) => voter.pickup_status === "Issue"
    ).length;

    const voted = voters.filter((voter) => voter.voted).length;

    const assigned = voters.filter((voter) => voter.campaigner_id).length;

    return {
      total,
      confirmed,
      leaning,
      undecided,
      unknown,
      pickupNeeded,
      pickupIssues,
      voted,
      assigned,
      unassigned: total - assigned,
      turnoutRate: percentage(voted, total),
      assignmentRate: percentage(assigned, total),
      confirmedRate: percentage(confirmed, total),
      pickupRate: percentage(pickupNeeded, total),
    };
  }, [voters]);

  const zoneSummary = useMemo(() => {
    const map = new Map<string, ZoneSummary>();

    voters.forEach((voter) => {
      const zone = voter.zone || "No Zone";

      if (!map.has(zone)) {
        map.set(zone, {
          zone,
          total: 0,
          confirmed: 0,
          pickupNeeded: 0,
          voted: 0,
        });
      }

      const item = map.get(zone)!;

      item.total += 1;

      if (voter.support_status === "Confirmed Supporter") {
        item.confirmed += 1;
      }

      if (voter.pickup_needed) {
        item.pickupNeeded += 1;
      }

      if (voter.voted) {
        item.voted += 1;
      }
    });

    return Array.from(map.values()).sort((a, b) =>
      a.zone.localeCompare(b.zone)
    );
  }, [voters]);

  const pollingSummary = useMemo(() => {
    const map = new Map<string, PollingSummary>();

    voters.forEach((voter) => {
      const pollingArea = voter.polling_area || "No Polling Area";

      if (!map.has(pollingArea)) {
        map.set(pollingArea, {
          pollingArea,
          total: 0,
          voted: 0,
        });
      }

      const item = map.get(pollingArea)!;

      item.total += 1;

      if (voter.voted) {
        item.voted += 1;
      }
    });

    return Array.from(map.values()).sort((a, b) =>
      a.pollingArea.localeCompare(b.pollingArea)
    );
  }, [voters]);

  const campaignerSummary = useMemo(() => {
    const assignedMap = new Map<string, number>();

    voters.forEach((voter) => {
      if (!voter.campaigner_id) return;

      assignedMap.set(
        voter.campaigner_id,
        (assignedMap.get(voter.campaigner_id) || 0) + 1
      );
    });

    return campaigners
      .filter((person) => person.role === "Campaigner")
      .map((person) => ({
        id: person.id,
        name: person.full_name,
        role: person.role,
        zone: person.zone,
        assigned: assignedMap.get(person.id) || 0,
      }))
      .sort((a, b) => b.assigned - a.assigned)
      .slice(0, 8);
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
              Loading command center...
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
                Campaign Command Center
              </h1>

              <p className="mt-3 max-w-3xl text-slate-300">
                Monitor voter coverage, campaigner assignments, pickup
                operations, and turnout progress from one central dashboard.
              </p>

              <p className="mt-3 text-sm text-slate-400">
                Logged in as {profile?.full_name} · Campaign Manager
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

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-3xl border border-white/10 bg-white/10 p-6 shadow-xl">
              <p className="text-sm text-slate-300">Total Voters</p>
              <h2 className="mt-3 text-5xl font-black">{stats.total}</h2>
              <p className="mt-3 text-sm text-slate-400">
                Full register loaded in the system.
              </p>
            </div>

            <div className="rounded-3xl border border-blue-400/30 bg-blue-500/10 p-6 shadow-xl">
              <p className="text-sm text-blue-200">Confirmed Supporters</p>
              <h2 className="mt-3 text-5xl font-black">{stats.confirmed}</h2>
              <div className="mt-4 h-3 rounded-full bg-white/10">
                <div
                  className="h-3 rounded-full bg-blue-400"
                  style={{ width: `${stats.confirmedRate}%` }}
                />
              </div>
              <p className="mt-3 text-sm text-blue-100">
                {stats.confirmedRate}% of total voters.
              </p>
            </div>

            <div className="rounded-3xl border border-amber-400/30 bg-amber-500/10 p-6 shadow-xl">
              <p className="text-sm text-amber-200">Pickup Needed</p>
              <h2 className="mt-3 text-5xl font-black">
                {stats.pickupNeeded}
              </h2>
              <div className="mt-4 h-3 rounded-full bg-white/10">
                <div
                  className="h-3 rounded-full bg-amber-400"
                  style={{ width: `${stats.pickupRate}%` }}
                />
              </div>
              <p className="mt-3 text-sm text-amber-100">
                {stats.pickupRate}% need transportation support.
              </p>
            </div>

            <div className="rounded-3xl border border-green-400/30 bg-green-500/10 p-6 shadow-xl">
              <p className="text-sm text-green-200">Voted</p>
              <h2 className="mt-3 text-5xl font-black">{stats.voted}</h2>
              <div className="mt-4 h-3 rounded-full bg-white/10">
                <div
                  className="h-3 rounded-full bg-green-400"
                  style={{ width: `${stats.turnoutRate}%` }}
                />
              </div>
              <p className="mt-3 text-sm text-green-100">
                {stats.turnoutRate}% turnout recorded.
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
                    Operational Snapshot
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Key campaign numbers at a glance.
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
                <div className="rounded-2xl bg-slate-50 p-5">
                  <p className="text-sm text-slate-500">Assigned Voters</p>
                  <h3 className="mt-2 text-3xl font-black text-slate-900">
                    {stats.assigned}
                  </h3>
                  <p className="mt-2 text-sm text-slate-500">
                    {stats.assignmentRate}% assignment coverage.
                  </p>
                </div>

                <div className="rounded-2xl bg-red-50 p-5">
                  <p className="text-sm text-red-700">Unassigned Voters</p>
                  <h3 className="mt-2 text-3xl font-black text-red-800">
                    {stats.unassigned}
                  </h3>
                  <p className="mt-2 text-sm text-red-700">
                    Needs campaigner assignment.
                  </p>
                </div>

                <div className="rounded-2xl bg-amber-50 p-5">
                  <p className="text-sm text-amber-700">Pickup Issues</p>
                  <h3 className="mt-2 text-3xl font-black text-amber-800">
                    {stats.pickupIssues}
                  </h3>
                  <p className="mt-2 text-sm text-amber-700">
                    Requires attention.
                  </p>
                </div>

                <div className="rounded-2xl bg-blue-50 p-5">
                  <p className="text-sm text-blue-700">Leaning Supporters</p>
                  <h3 className="mt-2 text-3xl font-black text-blue-800">
                    {stats.leaning}
                  </h3>
                  <p className="mt-2 text-sm text-blue-700">
                    Follow-up category.
                  </p>
                </div>

                <div className="rounded-2xl bg-purple-50 p-5">
                  <p className="text-sm text-purple-700">Undecided</p>
                  <h3 className="mt-2 text-3xl font-black text-purple-800">
                    {stats.undecided}
                  </h3>
                  <p className="mt-2 text-sm text-purple-700">
                    Still unconfirmed.
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-50 p-5">
                  <p className="text-sm text-slate-500">Unknown Status</p>
                  <h3 className="mt-2 text-3xl font-black text-slate-900">
                    {stats.unknown}
                  </h3>
                  <p className="mt-2 text-sm text-slate-500">
                    Needs classification.
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-3xl bg-white p-6 shadow">
              <h2 className="text-2xl font-black text-slate-900">
                Quick Actions
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Common management tasks.
              </p>

              <div className="mt-6 grid gap-3">
                <Link
                  href="/voters"
                  className="rounded-2xl border border-slate-200 p-4 font-bold text-slate-800 hover:border-blue-300 hover:bg-blue-50"
                >
                  Manage voter register
                </Link>

                <Link
                  href="/campaigners"
                  className="rounded-2xl border border-slate-200 p-4 font-bold text-slate-800 hover:border-blue-300 hover:bg-blue-50"
                >
                  Open campaigner field view
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
                  Upload voter CSV
                </Link>

                <Link
                  href="/scrutineer"
                  className="rounded-2xl border border-slate-200 p-4 font-bold text-slate-800 hover:border-blue-300 hover:bg-blue-50"
                >
                  Open scrutineer station
                </Link>
              </div>
            </section>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            <section className="rounded-3xl bg-white p-6 shadow">
              <h2 className="text-2xl font-black text-slate-900">
                Zone Performance
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Voter coverage, confirmed support, pickup needs, and turnout by
                zone.
              </p>

              <div className="mt-6 overflow-x-auto">
                <table className="w-full min-w-[650px] text-left text-sm">
                  <thead>
                    <tr className="border-b bg-slate-50 text-slate-600">
                      <th className="p-3">Zone</th>
                      <th className="p-3">Total</th>
                      <th className="p-3">Confirmed</th>
                      <th className="p-3">Pickup</th>
                      <th className="p-3">Voted</th>
                      <th className="p-3">Turnout</th>
                    </tr>
                  </thead>

                  <tbody>
                    {zoneSummary.map((item) => (
                      <tr key={item.zone} className="border-b">
                        <td className="p-3 font-bold text-slate-900">
                          {item.zone}
                        </td>
                        <td className="p-3 text-slate-700">{item.total}</td>
                        <td className="p-3 text-slate-700">
                          {item.confirmed}
                        </td>
                        <td className="p-3 text-slate-700">
                          {item.pickupNeeded}
                        </td>
                        <td className="p-3 text-slate-700">{item.voted}</td>
                        <td className="p-3">
                          <div className="flex items-center gap-3">
                            <div className="h-2 w-24 rounded-full bg-slate-200">
                              <div
                                className="h-2 rounded-full bg-green-600"
                                style={{
                                  width: `${percentage(
                                    item.voted,
                                    item.total
                                  )}%`,
                                }}
                              />
                            </div>
                            <span className="text-xs font-bold text-slate-700">
                              {percentage(item.voted, item.total)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}

                    {zoneSummary.length === 0 && (
                      <tr>
                        <td
                          colSpan={6}
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

            <section className="rounded-3xl bg-white p-6 shadow">
              <h2 className="text-2xl font-black text-slate-900">
                Polling Area Turnout
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Turnout progress by polling area.
              </p>

              <div className="mt-6 space-y-4">
                {pollingSummary.map((item) => {
                  const turnout = percentage(item.voted, item.total);

                  return (
                    <div
                      key={item.pollingArea}
                      className="rounded-2xl border border-slate-200 p-4"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-black text-slate-900">
                            Polling Area {item.pollingArea}
                          </p>
                          <p className="text-sm text-slate-500">
                            {item.voted} voted out of {item.total}
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
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            <section className="rounded-3xl bg-white p-6 shadow">
              <h2 className="text-2xl font-black text-slate-900">
                Top Campaigner Assignments
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Campaigners with the highest number of assigned voters.
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
                      </div>

                      <div className="rounded-2xl bg-blue-50 px-4 py-2 text-right">
                        <p className="text-2xl font-black text-blue-800">
                          {item.assigned}
                        </p>
                        <p className="text-xs font-bold text-blue-700">
                          Assigned
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
          </div>

          <section className="mt-6 rounded-3xl bg-white p-6 shadow">
            <h2 className="text-2xl font-black text-slate-900">
              Team Structure
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Active team members by role.
            </p>

            <div className="mt-6 grid gap-4 md:grid-cols-6">
              <div className="rounded-2xl bg-slate-50 p-5">
                <p className="text-sm text-slate-500">Total Team</p>
                <h3 className="mt-2 text-3xl font-black text-slate-900">
                  {teamStats.total}
                </h3>
              </div>

              <div className="rounded-2xl bg-blue-50 p-5">
                <p className="text-sm text-blue-700">Managers</p>
                <h3 className="mt-2 text-3xl font-black text-blue-800">
                  {teamStats.managers}
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
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}