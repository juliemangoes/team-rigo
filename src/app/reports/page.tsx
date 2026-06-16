"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

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

type SummaryRow = {
  name: string;
  total: number;
  voted: number;
  notVoted: number;
  pickupNeeded: number;
  turnout: number;
};

export default function ReportsPage() {
  const [voters, setVoters] = useState<Voter[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReports();
  }, []);

  async function loadReports() {
    setLoading(true);

    const { data, error } = await supabase
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

    if (error) {
      console.error("Error loading reports:", error);
      alert("Error loading reports.");
    } else {
      setVoters(data || []);
    }

    setLoading(false);
  }

  const overallStats = useMemo(() => {
    const total = voters.length;
    const voted = voters.filter((voter) => voter.voted).length;
    const notVoted = voters.filter((voter) => !voter.voted).length;
    const pickupNeeded = voters.filter((voter) => voter.pickup_needed).length;
    const pickupCompleted = voters.filter(
      (voter) => voter.pickup_status === "Completed"
    ).length;

    const confirmedSupporters = voters.filter(
      (voter) => voter.support_status === "Confirmed Supporter"
    ).length;

    const turnout = total > 0 ? Math.round((voted / total) * 100) : 0;

    return {
      total,
      voted,
      notVoted,
      pickupNeeded,
      pickupCompleted,
      confirmedSupporters,
      turnout,
    };
  }, [voters]);

  function buildSummaryByField(
    fieldGetter: (voter: Voter) => string
  ): SummaryRow[] {
    const groups: Record<string, Voter[]> = {};

    voters.forEach((voter) => {
      const key = fieldGetter(voter) || "Not Listed";

      if (!groups[key]) {
        groups[key] = [];
      }

      groups[key].push(voter);
    });

    return Object.entries(groups)
      .map(([name, groupVoters]) => {
        const total = groupVoters.length;
        const voted = groupVoters.filter((voter) => voter.voted).length;
        const notVoted = groupVoters.filter((voter) => !voter.voted).length;
        const pickupNeeded = groupVoters.filter(
          (voter) => voter.pickup_needed
        ).length;
        const turnout = total > 0 ? Math.round((voted / total) * 100) : 0;

        return {
          name,
          total,
          voted,
          notVoted,
          pickupNeeded,
          turnout,
        };
      })
      .sort((a, b) => b.total - a.total);
  }

  const zoneSummary = useMemo(() => {
    return buildSummaryByField((voter) => voter.zone || "No Zone");
  }, [voters]);

  const campaignerSummary = useMemo(() => {
    return buildSummaryByField(
      (voter) => voter.campaigners?.full_name || "Not Assigned"
    );
  }, [voters]);

  const supportSummary = useMemo(() => {
    return buildSummaryByField(
      (voter) => voter.support_status || "Unknown"
    );
  }, [voters]);

  const pickupSummary = useMemo(() => {
    return buildSummaryByField(
      (voter) => voter.pickup_status || "Not Contacted"
    );
  }, [voters]);

  const notVotedSupporters = voters
    .filter(
      (voter) =>
        !voter.voted && voter.support_status === "Confirmed Supporter"
    )
    .slice(0, 20);

  function escapeCsvValue(value: string | number | boolean | null | undefined) {
    const stringValue = value === null || value === undefined ? "" : String(value);
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  function exportVotersCsv() {
    const headers = [
      "full_name",
      "phone",
      "address",
      "zone",
      "polling_station",
      "support_status",
      "campaigner",
      "pickup_needed",
      "pickup_status",
      "voted",
      "voted_at",
      "notes",
    ];

    const rows = voters.map((voter) => [
      voter.full_name,
      voter.phone,
      voter.address,
      voter.zone,
      voter.polling_station,
      voter.support_status,
      voter.campaigners?.full_name || "",
      voter.pickup_needed,
      voter.pickup_status,
      voter.voted,
      voter.voted_at,
      voter.notes,
    ]);

    const csvContent = [
      headers.map(escapeCsvValue).join(","),
      ...rows.map((row) => row.map(escapeCsvValue).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "team-rigo-voter-report.csv";
    link.click();

    URL.revokeObjectURL(url);
  }

  function SummaryTable({
    title,
    description,
    rows,
  }: {
    title: string;
    description: string;
    rows: SummaryRow[];
  }) {
    return (
      <section className="rounded-2xl bg-white p-6 shadow">
        <div className="mb-5">
          <h2 className="text-xl font-bold text-slate-900">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[650px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-slate-600">
                <th className="p-3">Name</th>
                <th className="p-3">Total</th>
                <th className="p-3">Voted</th>
                <th className="p-3">Not Voted</th>
                <th className="p-3">Need Pickup</th>
                <th className="p-3">Turnout</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => (
                <tr key={row.name} className="border-b">
                  <td className="p-3 font-semibold text-slate-900">
                    {row.name}
                  </td>
                  <td className="p-3 text-slate-700">{row.total}</td>
                  <td className="p-3 text-green-700">{row.voted}</td>
                  <td className="p-3 text-red-700">{row.notVoted}</td>
                  <td className="p-3 text-amber-700">{row.pickupNeeded}</td>
                  <td className="p-3 font-semibold text-blue-700">
                    {row.turnout}%
                  </td>
                </tr>
              ))}

              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-slate-500">
                    No report data found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    );
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
              Reports
            </h1>

            <p className="mt-2 text-slate-600">
              Review turnout, campaigner performance, pickup status, and voter
              follow-up priorities.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={loadReports}
              className="rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow hover:bg-slate-50"
            >
              Refresh
            </button>

            <button
              onClick={exportVotersCsv}
              className="rounded-xl bg-blue-700 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-800"
            >
              Export CSV
            </button>
          </div>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
            Loading reports...
          </div>
        ) : (
          <>
            <div className="mb-6 grid gap-4 md:grid-cols-4">
              <div className="rounded-2xl bg-white p-5 shadow">
                <p className="text-sm text-slate-500">Total Voters</p>
                <h2 className="mt-2 text-3xl font-bold text-slate-900">
                  {overallStats.total}
                </h2>
              </div>

              <div className="rounded-2xl bg-white p-5 shadow">
                <p className="text-sm text-slate-500">Confirmed Supporters</p>
                <h2 className="mt-2 text-3xl font-bold text-blue-700">
                  {overallStats.confirmedSupporters}
                </h2>
              </div>

              <div className="rounded-2xl bg-white p-5 shadow">
                <p className="text-sm text-slate-500">Voted</p>
                <h2 className="mt-2 text-3xl font-bold text-green-700">
                  {overallStats.voted}
                </h2>
              </div>

              <div className="rounded-2xl bg-white p-5 shadow">
                <p className="text-sm text-slate-500">Turnout</p>
                <h2 className="mt-2 text-3xl font-bold text-slate-900">
                  {overallStats.turnout}%
                </h2>
              </div>
            </div>

            <div className="mb-8 grid gap-4 md:grid-cols-4">
              <div className="rounded-2xl bg-white p-5 shadow">
                <p className="text-sm text-slate-500">Not Yet Voted</p>
                <h2 className="mt-2 text-3xl font-bold text-red-700">
                  {overallStats.notVoted}
                </h2>
              </div>

              <div className="rounded-2xl bg-white p-5 shadow">
                <p className="text-sm text-slate-500">Need Pickup</p>
                <h2 className="mt-2 text-3xl font-bold text-amber-700">
                  {overallStats.pickupNeeded}
                </h2>
              </div>

              <div className="rounded-2xl bg-white p-5 shadow">
                <p className="text-sm text-slate-500">Pickup Completed</p>
                <h2 className="mt-2 text-3xl font-bold text-green-700">
                  {overallStats.pickupCompleted}
                </h2>
              </div>

              <div className="rounded-2xl bg-white p-5 shadow">
                <p className="text-sm text-slate-500">Pending Supporters</p>
                <h2 className="mt-2 text-3xl font-bold text-slate-900">
                  {notVotedSupporters.length}
                </h2>
              </div>
            </div>

            <div className="mb-8 rounded-2xl bg-white p-6 shadow">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-900">
                  Overall Turnout
                </h2>

                <p className="text-sm font-semibold text-slate-600">
                  {overallStats.voted} of {overallStats.total} voted
                </p>
              </div>

              <div className="h-4 w-full rounded-full bg-slate-200">
                <div
                  className="h-4 rounded-full bg-blue-700"
                  style={{ width: `${overallStats.turnout}%` }}
                />
              </div>
            </div>

            <div className="mb-8 grid gap-6 lg:grid-cols-2">
              <SummaryTable
                title="Turnout by Zone"
                description="Shows how each zone is performing."
                rows={zoneSummary}
              />

              <SummaryTable
                title="Turnout by Campaigner"
                description="Shows assigned voters and turnout by campaigner."
                rows={campaignerSummary}
              />

              <SummaryTable
                title="Support Status Summary"
                description="Shows totals by support category."
                rows={supportSummary}
              />

              <SummaryTable
                title="Pickup Status Summary"
                description="Shows voters by transportation movement."
                rows={pickupSummary}
              />
            </div>

            <section className="rounded-2xl bg-white p-6 shadow">
              <h2 className="text-xl font-bold text-slate-900">
                Confirmed Supporters Not Yet Voted
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                First 20 confirmed supporters still pending.
              </p>

              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[850px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b bg-slate-50 text-slate-600">
                      <th className="p-3">Name</th>
                      <th className="p-3">Phone</th>
                      <th className="p-3">Address</th>
                      <th className="p-3">Zone</th>
                      <th className="p-3">Campaigner</th>
                      <th className="p-3">Pickup</th>
                    </tr>
                  </thead>

                  <tbody>
                    {notVotedSupporters.map((voter) => (
                      <tr key={voter.id} className="border-b">
                        <td className="p-3 font-semibold text-slate-900">
                          {voter.full_name}
                        </td>

                        <td className="p-3 text-slate-700">
                          {voter.phone || "No phone"}
                        </td>

                        <td className="p-3 text-slate-700">
                          {voter.address || "No address"}
                        </td>

                        <td className="p-3 text-slate-700">
                          {voter.zone || "No zone"}
                        </td>

                        <td className="p-3 text-slate-700">
                          {voter.campaigners?.full_name || "Not assigned"}
                        </td>

                        <td className="p-3">
                          {voter.pickup_needed ? (
                            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                              {voter.pickup_status || "Needed"}
                            </span>
                          ) : (
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                              No Pickup
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}

                    {notVotedSupporters.length === 0 && (
                      <tr>
                        <td
                          colSpan={6}
                          className="p-8 text-center text-slate-500"
                        >
                          No pending confirmed supporters found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}