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
  phone: string | null;
  zone: string | null;
  role: string | null;
};

type Voter = {
  id: string;
  full_name: string;
  phone: string | null;
  address: string | null;
  zone: string | null;
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

export default function DashboardPage() {
  const [profile, setProfile] = useState<TeamProfile | null>(null);
  const [voters, setVoters] = useState<Voter[]>([]);
  const [campaigners, setCampaigners] = useState<Campaigner[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    setLoading(true);

    const { data: sessionData } = await supabase.auth.getSession();
    const email = sessionData.session?.user.email;

    if (!email) {
      alert("No login email found.");
      setLoading(false);
      return;
    }

    const { data: profileData, error: profileError } = await supabase
      .from("campaigners")
      .select("id, full_name, email, role, zone")
      .ilike("email", email)
      .maybeSingle();

    if (profileError) {
      console.error("Error loading profile:", profileError);
      alert("Error loading your profile.");
      setLoading(false);
      return;
    }

    if (!profileData) {
      alert("No Team Rigo profile found for this login email.");
      setLoading(false);
      return;
    }

    setProfile(profileData);

    const { data: voterData, error: voterError } = await supabase
      .from("voters")
      .select(
        `
        *,
        campaigners:campaigner_id (
          id,
          full_name
        )
      `
      )
      .order("full_name", { ascending: true });

    if (voterError) {
      console.error("Error loading voters:", voterError);
      alert("Error loading voters.");
    } else {
      setVoters(voterData || []);
    }

    const { data: campaignerData, error: campaignerError } = await supabase
      .from("campaigners")
      .select("*")
      .order("full_name", { ascending: true });

    if (campaignerError) {
      console.error("Error loading campaigners:", campaignerError);
      alert("Error loading campaigners.");
    } else {
      setCampaigners(campaignerData || []);
    }

    setLoading(false);
  }

  function voterAllowedForProfile(voter: Voter) {
    if (!profile) return false;

    if (profile.role === "Campaign Manager") {
      return true;
    }

    if (profile.role === "Zone Leader") {
      if (profile.zone === "All Zones") return true;
      return voter.zone === profile.zone;
    }

    if (profile.role === "Campaigner") {
      return voter.campaigner_id === profile.id;
    }

    if (profile.role === "Driver") {
      if (!voter.pickup_needed) return false;

      if (profile.zone === "All Zones") return true;
      return voter.zone === profile.zone;
    }

    if (profile.role === "Scrutineer") {
      return true;
    }

    return false;
  }

  const visibleVoters = useMemo(() => {
    return voters.filter((voter) => voterAllowedForProfile(voter));
  }, [voters, profile]);

  const visibleCampaigners = useMemo(() => {
    if (!profile) return [];

    if (profile.role === "Campaign Manager") {
      return campaigners;
    }

    if (profile.role === "Zone Leader") {
      if (profile.zone === "All Zones") return campaigners;
      return campaigners.filter((member) => member.zone === profile.zone);
    }

    return campaigners.filter((member) => member.id === profile.id);
  }, [campaigners, profile]);

  const stats = useMemo(() => {
    const totalVoters = visibleVoters.length;

    const confirmedSupporters = visibleVoters.filter(
      (voter) => voter.support_status === "Confirmed Supporter"
    ).length;

    const leaningSupporters = visibleVoters.filter(
      (voter) => voter.support_status === "Leaning Supporter"
    ).length;

    const undecided = visibleVoters.filter(
      (voter) => voter.support_status === "Undecided"
    ).length;

    const unknown = visibleVoters.filter(
      (voter) => !voter.support_status || voter.support_status === "Unknown"
    ).length;

    const assigned = visibleVoters.filter((voter) => voter.campaigner_id).length;

    const needPickup = visibleVoters.filter((voter) => voter.pickup_needed).length;

    const pickupCompleted = visibleVoters.filter(
      (voter) => voter.pickup_status === "Completed"
    ).length;

    const voted = visibleVoters.filter((voter) => voter.voted).length;

    const notVoted = visibleVoters.filter((voter) => !voter.voted).length;

    const turnout =
      totalVoters > 0 ? Math.round((voted / totalVoters) * 100) : 0;

    return {
      totalVoters,
      confirmedSupporters,
      leaningSupporters,
      undecided,
      unknown,
      assigned,
      needPickup,
      pickupCompleted,
      voted,
      notVoted,
      turnout,
    };
  }, [visibleVoters]);

  const pendingPickupVoters = visibleVoters
    .filter((voter) => voter.pickup_needed && !voter.voted)
    .slice(0, 8);

  const recentlyVoted = visibleVoters
    .filter((voter) => voter.voted && voter.voted_at)
    .sort((a, b) => {
      const timeA = a.voted_at ? new Date(a.voted_at).getTime() : 0;
      const timeB = b.voted_at ? new Date(b.voted_at).getTime() : 0;
      return timeB - timeA;
    })
    .slice(0, 8);

  function formatTime(dateValue: string | null) {
    if (!dateValue) return "";

    return new Date(dateValue).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function dashboardScopeText() {
    if (!profile) return "";

    if (profile.role === "Campaign Manager") {
      return "Viewing all campaign data";
    }

    if (profile.role === "Zone Leader") {
      return `Viewing ${profile.zone || "assigned zone"} data`;
    }

    if (profile.role === "Campaigner") {
      return "Viewing voters assigned to you";
    }

    if (profile.role === "Driver") {
      return `Viewing pickup-needed voters in ${profile.zone || "your zone"}`;
    }

    if (profile.role === "Scrutineer") {
      return "Viewing voting and turnout data";
    }

    return "Viewing assigned data";
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
              Team Rigo
            </p>

            <h1 className="mt-2 text-3xl font-bold text-slate-900">
              Command Dashboard
            </h1>

            <p className="mt-2 text-slate-600">
              Role-based overview of supporters, pickups, and convention-day turnout.
            </p>

            {profile && (
              <p className="mt-2 text-sm text-slate-500">
                {profile.full_name} · {profile.role} · {dashboardScopeText()}
              </p>
            )}
          </div>

          <button
            onClick={loadDashboard}
            className="rounded-xl bg-blue-700 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-800"
          >
            Refresh Dashboard
          </button>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
            Loading dashboard...
          </div>
        ) : (
          <>
            <div className="mb-6 grid gap-4 md:grid-cols-4">
              <div className="rounded-2xl bg-white p-5 shadow">
                <p className="text-sm text-slate-500">Visible Voters</p>
                <h2 className="mt-2 text-3xl font-bold text-slate-900">
                  {stats.totalVoters}
                </h2>
              </div>

              <div className="rounded-2xl bg-white p-5 shadow">
                <p className="text-sm text-slate-500">Confirmed Supporters</p>
                <h2 className="mt-2 text-3xl font-bold text-blue-700">
                  {stats.confirmedSupporters}
                </h2>
              </div>

              <div className="rounded-2xl bg-white p-5 shadow">
                <p className="text-sm text-slate-500">Voted</p>
                <h2 className="mt-2 text-3xl font-bold text-green-700">
                  {stats.voted}
                </h2>
              </div>

              <div className="rounded-2xl bg-white p-5 shadow">
                <p className="text-sm text-slate-500">Turnout</p>
                <h2 className="mt-2 text-3xl font-bold text-slate-900">
                  {stats.turnout}%
                </h2>
              </div>
            </div>

            <div className="mb-6 grid gap-4 md:grid-cols-4">
              <div className="rounded-2xl bg-white p-5 shadow">
                <p className="text-sm text-slate-500">Not Yet Voted</p>
                <h2 className="mt-2 text-3xl font-bold text-red-700">
                  {stats.notVoted}
                </h2>
              </div>

              <div className="rounded-2xl bg-white p-5 shadow">
                <p className="text-sm text-slate-500">Need Pickup</p>
                <h2 className="mt-2 text-3xl font-bold text-amber-700">
                  {stats.needPickup}
                </h2>
              </div>

              <div className="rounded-2xl bg-white p-5 shadow">
                <p className="text-sm text-slate-500">Pickup Completed</p>
                <h2 className="mt-2 text-3xl font-bold text-green-700">
                  {stats.pickupCompleted}
                </h2>
              </div>

              <div className="rounded-2xl bg-white p-5 shadow">
                <p className="text-sm text-slate-500">Visible Team Members</p>
                <h2 className="mt-2 text-3xl font-bold text-slate-900">
                  {visibleCampaigners.length}
                </h2>
              </div>
            </div>

            <div className="mb-8 rounded-2xl bg-white p-6 shadow">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-900">
                  Turnout Progress
                </h2>

                <p className="text-sm font-semibold text-slate-600">
                  {stats.voted} of {stats.totalVoters} voted
                </p>
              </div>

              <div className="h-4 w-full rounded-full bg-slate-200">
                <div
                  className="h-4 rounded-full bg-blue-700"
                  style={{ width: `${stats.turnout}%` }}
                />
              </div>
            </div>

            <div className="mb-8 grid gap-4 md:grid-cols-4">
              <div className="rounded-2xl bg-white p-5 shadow">
                <p className="text-sm text-slate-500">Leaning Supporters</p>
                <h2 className="mt-2 text-2xl font-bold text-slate-900">
                  {stats.leaningSupporters}
                </h2>
              </div>

              <div className="rounded-2xl bg-white p-5 shadow">
                <p className="text-sm text-slate-500">Undecided</p>
                <h2 className="mt-2 text-2xl font-bold text-slate-900">
                  {stats.undecided}
                </h2>
              </div>

              <div className="rounded-2xl bg-white p-5 shadow">
                <p className="text-sm text-slate-500">Unknown</p>
                <h2 className="mt-2 text-2xl font-bold text-slate-900">
                  {stats.unknown}
                </h2>
              </div>

              <div className="rounded-2xl bg-white p-5 shadow">
                <p className="text-sm text-slate-500">Assigned to Campaigner</p>
                <h2 className="mt-2 text-2xl font-bold text-slate-900">
                  {stats.assigned}
                </h2>
              </div>
            </div>

            <div className="mb-8 grid gap-4 md:grid-cols-3">
              {profile?.role !== "Scrutineer" && (
                <>
                  <a
                    href="/voters"
                    className="rounded-2xl bg-white p-6 shadow hover:shadow-md"
                  >
                    <h3 className="text-xl font-semibold text-slate-900">
                      Voters
                    </h3>

                    <p className="mt-2 text-slate-600">
                      Add, search, update, and assign voter records.
                    </p>
                  </a>

                  <a
                    href="/campaigners"
                    className="rounded-2xl bg-white p-6 shadow hover:shadow-md"
                  >
                    <h3 className="text-xl font-semibold text-slate-900">
                      Campaigners
                    </h3>

                    <p className="mt-2 text-slate-600">
                      Track pickup movement and assigned voter lists.
                    </p>
                  </a>
                </>
              )}

              <a
                href="/scrutineer"
                className="rounded-2xl bg-white p-6 shadow hover:shadow-md"
              >
                <h3 className="text-xl font-semibold text-slate-900">
                  Scrutineer
                </h3>

                <p className="mt-2 text-slate-600">
                  Mark voters as voted once they cast their vote.
                </p>
              </a>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <section className="rounded-2xl bg-white p-6 shadow">
                <h2 className="text-xl font-bold text-slate-900">
                  Pending Pickups
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Voters who still need pickup and have not yet voted.
                </p>

                <div className="mt-5 space-y-3">
                  {pendingPickupVoters.map((voter) => (
                    <div
                      key={voter.id}
                      className="rounded-xl border border-slate-200 p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-semibold text-slate-900">
                            {voter.full_name}
                          </p>

                          <p className="mt-1 text-sm text-slate-600">
                            {voter.address || "No address"} ·{" "}
                            {voter.zone || "No zone"}
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            Campaigner:{" "}
                            {voter.campaigners?.full_name || "Not assigned"}
                          </p>
                        </div>

                        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                          {voter.pickup_status || "Not Contacted"}
                        </span>
                      </div>
                    </div>
                  ))}

                  {pendingPickupVoters.length === 0 && (
                    <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-slate-500">
                      No pending pickups.
                    </div>
                  )}
                </div>
              </section>

              <section className="rounded-2xl bg-white p-6 shadow">
                <h2 className="text-xl font-bold text-slate-900">
                  Recently Voted
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Latest voters marked by scrutineers.
                </p>

                <div className="mt-5 space-y-3">
                  {recentlyVoted.map((voter) => (
                    <div
                      key={voter.id}
                      className="rounded-xl border border-slate-200 p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-semibold text-slate-900">
                            {voter.full_name}
                          </p>

                          <p className="mt-1 text-sm text-slate-600">
                            {voter.polling_station || "No polling station"}
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            Campaigner:{" "}
                            {voter.campaigners?.full_name || "Not assigned"}
                          </p>
                        </div>

                        <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">
                          {formatTime(voter.voted_at)}
                        </span>
                      </div>
                    </div>
                  ))}

                  {recentlyVoted.length === 0 && (
                    <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-slate-500">
                      No voters marked yet.
                    </div>
                  )}
                </div>
              </section>
            </div>
          </>
        )}
      </div>
    </main>
  );
}