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

type CompetitorEstimate = {
  id: string;
  competitor_id: string | null;
  zone: string | null;
  polling_area: string | null;
  estimated_votes: number | null;
  notes: string | null;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value || 0);
}

function cleanNumber(value: string, fallback = 0) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) return fallback;

  return Math.max(0, Math.round(numberValue));
}

function SectionHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div>
      <h2 className="text-xl font-black text-slate-900 sm:text-2xl">
        {title}
      </h2>
      <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
    </div>
  );
}

function InputLabel({ children }: { children: React.ReactNode }) {
  return <label className="text-sm font-bold text-slate-700">{children}</label>;
}

export default function CampaignSetupPage() {
  const [profile, setProfile] = useState<TeamProfile | null>(null);

  const [settings, setSettings] = useState<CampaignSettings | null>(null);
  const [zones, setZones] = useState<CampaignZone[]>([]);
  const [pollingAreas, setPollingAreas] = useState<PollingArea[]>([]);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [competitorEstimates, setCompetitorEstimates] = useState<
    CompetitorEstimate[]
  >([]);

  const [electionName, setElectionName] = useState("");
  const [voteTarget, setVoteTarget] = useState("");

  const [zoneName, setZoneName] = useState("");
  const [zoneDescription, setZoneDescription] = useState("");
  const [zoneOrder, setZoneOrder] = useState("");

  const [pollingCode, setPollingCode] = useState("");
  const [pollingName, setPollingName] = useState("");
  const [pollingLocation, setPollingLocation] = useState("");
  const [pollingOrder, setPollingOrder] = useState("");

  const [competitorName, setCompetitorName] = useState("");
  const [competitorDescription, setCompetitorDescription] = useState("");
  const [competitorOrder, setCompetitorOrder] = useState("");

  const [estimateCompetitorId, setEstimateCompetitorId] = useState("");
  const [estimateZone, setEstimateZone] = useState("");
  const [estimatePollingArea, setEstimatePollingArea] = useState("");
  const [estimateVotes, setEstimateVotes] = useState("");
  const [estimateNotes, setEstimateNotes] = useState("");

  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [message, setMessage] = useState("");

  const canAccess = profile?.role === "Campaign Manager";

  useEffect(() => {
    loadPage();
  }, []);

  async function loadPage() {
    setLoading(true);
    setMessage("");

    const { data: sessionData } = await supabase.auth.getSession();
    const email = sessionData.session?.user.email;

    if (!email) {
      setMessage("No login email found.");
      setLoading(false);
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
      return;
    }

    if (!profileData) {
      setMessage("No Team Rigo profile found for this login email.");
      setLoading(false);
      return;
    }

    setProfile(profileData);

    await Promise.all([
      loadSettings(),
      loadZones(),
      loadPollingAreas(),
      loadCompetitors(),
      loadCompetitorEstimates(),
    ]);

    setLoading(false);
  }

  async function loadSettings() {
    const { data, error } = await supabase
      .from("campaign_settings")
      .select("id, election_name, vote_target_to_win")
      .eq("id", 1)
      .maybeSingle();

    if (error) {
      console.error("Settings error:", error);
      setMessage("Error loading campaign settings.");
      return;
    }

    if (data) {
      setSettings(data);
      setElectionName(data.election_name || "");
      setVoteTarget(String(data.vote_target_to_win || ""));
    }
  }

  async function loadZones() {
    const { data, error } = await supabase
      .from("campaign_zones")
      .select("id, name, description, display_order")
      .order("display_order", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      console.error("Zones error:", error);
      setZones([]);
      return;
    }

    setZones(data || []);
  }

  async function loadPollingAreas() {
    const { data, error } = await supabase
      .from("polling_areas")
      .select("id, code, name, location, display_order")
      .order("display_order", { ascending: true })
      .order("code", { ascending: true });

    if (error) {
      console.error("Polling areas error:", error);
      setPollingAreas([]);
      return;
    }

    setPollingAreas(data || []);
  }

  async function loadCompetitors() {
    const { data, error } = await supabase
      .from("competitors")
      .select("id, name, description, display_order")
      .order("display_order", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      console.error("Competitors error:", error);
      setCompetitors([]);
      return;
    }

    setCompetitors(data || []);

    if (!estimateCompetitorId && data && data.length > 0) {
      setEstimateCompetitorId(data[0].id);
    }
  }

  async function loadCompetitorEstimates() {
    const { data, error } = await supabase
      .from("competitor_estimates")
      .select("id, competitor_id, zone, polling_area, estimated_votes, notes")
      .order("zone", { ascending: true, nullsFirst: false })
      .order("polling_area", { ascending: true, nullsFirst: false });

    if (error) {
      console.error("Competitor estimates error:", error);
      setCompetitorEstimates([]);
      return;
    }

    setCompetitorEstimates(data || []);
  }

  async function saveSettings() {
    if (!electionName.trim()) {
      alert("Enter an election name.");
      return;
    }

    const targetNumber = cleanNumber(voteTarget);

    setSavingSettings(true);
    setMessage("");

    const { error } = await supabase.from("campaign_settings").upsert({
      id: 1,
      election_name: electionName.trim(),
      vote_target_to_win: targetNumber,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.error("Save settings error:", error);
      setMessage(error.message || "Error saving campaign settings.");
      setSavingSettings(false);
      return;
    }

    setMessage("Campaign settings saved.");
    await loadSettings();

    setSavingSettings(false);
  }

  async function addZone() {
    if (!zoneName.trim()) {
      alert("Enter a zone name.");
      return;
    }

    const { error } = await supabase.from("campaign_zones").insert({
      name: zoneName.trim(),
      description: zoneDescription.trim() || null,
      display_order: cleanNumber(zoneOrder),
    });

    if (error) {
      console.error("Add zone error:", error);
      setMessage(error.message || "Error adding zone.");
      return;
    }

    setZoneName("");
    setZoneDescription("");
    setZoneOrder("");
    setMessage("Zone added.");
    await loadZones();
  }

  async function deleteZone(zone: CampaignZone) {
    const confirmed = confirm(`Delete zone "${zone.name}"?`);

    if (!confirmed) return;

    const { error } = await supabase
      .from("campaign_zones")
      .delete()
      .eq("id", zone.id);

    if (error) {
      console.error("Delete zone error:", error);
      setMessage(error.message || "Error deleting zone.");
      return;
    }

    setMessage("Zone deleted.");
    await loadZones();
  }

  async function addPollingArea() {
    if (!pollingCode.trim()) {
      alert("Enter a polling area code.");
      return;
    }

    const { error } = await supabase.from("polling_areas").insert({
      code: pollingCode.trim(),
      name: pollingName.trim() || null,
      location: pollingLocation.trim() || null,
      display_order: cleanNumber(pollingOrder),
    });

    if (error) {
      console.error("Add polling area error:", error);
      setMessage(error.message || "Error adding polling area.");
      return;
    }

    setPollingCode("");
    setPollingName("");
    setPollingLocation("");
    setPollingOrder("");
    setMessage("Polling area added.");
    await loadPollingAreas();
  }

  async function deletePollingArea(area: PollingArea) {
    const confirmed = confirm(`Delete polling area "${area.code}"?`);

    if (!confirmed) return;

    const { error } = await supabase
      .from("polling_areas")
      .delete()
      .eq("id", area.id);

    if (error) {
      console.error("Delete polling area error:", error);
      setMessage(error.message || "Error deleting polling area.");
      return;
    }

    setMessage("Polling area deleted.");
    await loadPollingAreas();
  }

  async function addCompetitor() {
    if (!competitorName.trim()) {
      alert("Enter competitor name.");
      return;
    }

    const { error } = await supabase.from("competitors").insert({
      name: competitorName.trim(),
      description: competitorDescription.trim() || null,
      display_order: cleanNumber(competitorOrder),
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.error("Add competitor error:", error);
      setMessage(error.message || "Error adding competitor.");
      return;
    }

    setCompetitorName("");
    setCompetitorDescription("");
    setCompetitorOrder("");
    setMessage("Competitor added.");
    await loadCompetitors();
  }

  async function deleteCompetitor(competitor: Competitor) {
    const confirmed = confirm(
      `Delete competitor "${competitor.name}"? This will also delete their estimates.`
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("competitors")
      .delete()
      .eq("id", competitor.id);

    if (error) {
      console.error("Delete competitor error:", error);
      setMessage(error.message || "Error deleting competitor.");
      return;
    }

    setMessage("Competitor deleted.");
    await Promise.all([loadCompetitors(), loadCompetitorEstimates()]);
  }

  async function addCompetitorEstimate() {
    if (!estimateCompetitorId) {
      alert("Select a competitor.");
      return;
    }

    const voteNumber = cleanNumber(estimateVotes);

    if (voteNumber <= 0) {
      alert("Enter estimated votes greater than 0.");
      return;
    }

    const { error } = await supabase.from("competitor_estimates").insert({
      competitor_id: estimateCompetitorId,
      zone: estimateZone.trim() || null,
      polling_area: estimatePollingArea.trim() || null,
      estimated_votes: voteNumber,
      notes: estimateNotes.trim() || null,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.error("Add competitor estimate error:", error);
      setMessage(error.message || "Error adding competitor estimate.");
      return;
    }

    setEstimateZone("");
    setEstimatePollingArea("");
    setEstimateVotes("");
    setEstimateNotes("");
    setMessage("Competitor estimate added.");
    await loadCompetitorEstimates();
  }

  async function deleteCompetitorEstimate(estimate: CompetitorEstimate) {
    const confirmed = confirm("Delete this competitor estimate?");

    if (!confirmed) return;

    const { error } = await supabase
      .from("competitor_estimates")
      .delete()
      .eq("id", estimate.id);

    if (error) {
      console.error("Delete competitor estimate error:", error);
      setMessage(error.message || "Error deleting competitor estimate.");
      return;
    }

    setMessage("Competitor estimate deleted.");
    await loadCompetitorEstimates();
  }

  const competitorNameMap = useMemo(() => {
    const map = new Map<string, string>();

    competitors.forEach((competitor) => {
      map.set(competitor.id, competitor.name);
    });

    return map;
  }, [competitors]);

  const competitorTotals = useMemo(() => {
    return competitors
      .map((competitor) => {
        const total = competitorEstimates
          .filter((estimate) => estimate.competitor_id === competitor.id)
          .reduce((sum, estimate) => sum + (estimate.estimated_votes || 0), 0);

        return {
          id: competitor.id,
          name: competitor.name,
          description: competitor.description,
          total,
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [competitors, competitorEstimates]);

  const setupSummary = useMemo(() => {
    return {
      voteTarget: settings?.vote_target_to_win || 0,
      zones: zones.length,
      pollingAreas: pollingAreas.length,
      competitors: competitors.length,
      competitorEstimateTotal: competitorEstimates.reduce(
        (sum, estimate) => sum + (estimate.estimated_votes || 0),
        0
      ),
    };
  }, [settings, zones, pollingAreas, competitors, competitorEstimates]);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 p-4 sm:p-6">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-3xl bg-white p-6 text-center shadow">
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
              Team Rigo
            </p>

            <h1 className="mt-3 text-xl font-bold text-slate-900">
              Loading campaign setup...
            </h1>
          </div>
        </div>
      </main>
    );
  }

  if (!canAccess) {
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
            Campaign setup is restricted to the Campaign Manager.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-slate-100">
      <section className="bg-slate-950 px-4 py-5 text-white sm:px-6 sm:py-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-300 sm:text-sm">
                Team Rigo
              </p>

              <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">
                Campaign Setup
              </h1>

              <p className="mt-2 text-sm text-slate-300 sm:text-base">
                Manage victory target, zones, polling areas, and competitor
                estimates.
              </p>
            </div>

            <button
              onClick={loadPage}
              className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950 hover:bg-slate-200"
            >
              Refresh
            </button>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div className="rounded-2xl bg-white/10 p-3">
              <p className="text-xs text-slate-300">Vote Target</p>
              <p className="mt-1 text-2xl font-black">
                {formatNumber(setupSummary.voteTarget)}
              </p>
            </div>

            <div className="rounded-2xl bg-white/10 p-3">
              <p className="text-xs text-slate-300">Zones</p>
              <p className="mt-1 text-2xl font-black">
                {formatNumber(setupSummary.zones)}
              </p>
            </div>

            <div className="rounded-2xl bg-white/10 p-3">
              <p className="text-xs text-slate-300">Polling</p>
              <p className="mt-1 text-2xl font-black">
                {formatNumber(setupSummary.pollingAreas)}
              </p>
            </div>

            <div className="rounded-2xl bg-white/10 p-3">
              <p className="text-xs text-slate-300">Competitors</p>
              <p className="mt-1 text-2xl font-black">
                {formatNumber(setupSummary.competitors)}
              </p>
            </div>

            <div className="col-span-2 rounded-2xl bg-white/10 p-3 sm:col-span-1">
              <p className="text-xs text-slate-300">Opp. Estimate</p>
              <p className="mt-1 text-2xl font-black">
                {formatNumber(setupSummary.competitorEstimateTotal)}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-5 sm:px-6 sm:py-8">
        <div className="mx-auto max-w-7xl">
          {message && (
            <div className="mb-5 rounded-2xl bg-blue-50 p-4 text-sm font-bold text-blue-900">
              {message}
            </div>
          )}

          <section className="rounded-3xl bg-white p-4 shadow sm:p-6">
            <SectionHeader
              title="Victory Settings"
              subtitle="The dashboard uses this target to calculate the path to victory."
            />

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <div className="md:col-span-2">
                <InputLabel>Election / Campaign Name</InputLabel>
                <input
                  value={electionName}
                  onChange={(event) => setElectionName(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-700"
                  placeholder="Team Rigo Campaign"
                />
              </div>

              <div>
                <InputLabel>Vote Target to Win</InputLabel>
                <input
                  type="number"
                  value={voteTarget}
                  onChange={(event) => setVoteTarget(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-700"
                  placeholder="Example: 1200"
                />
              </div>
            </div>

            <button
              onClick={saveSettings}
              disabled={savingSettings}
              className="mt-5 rounded-2xl bg-blue-700 px-5 py-3 font-black text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-blue-300"
            >
              {savingSettings ? "Saving..." : "Save Victory Settings"}
            </button>
          </section>

          <div className="mt-5 grid gap-5 xl:grid-cols-2">
            <section className="rounded-3xl bg-white p-4 shadow sm:p-6">
              <SectionHeader
                title="Campaign Zones"
                subtitle="Add zones exactly as they appear in voter records."
              />

              <div className="mt-5 grid gap-3 sm:grid-cols-4">
                <input
                  value={zoneName}
                  onChange={(event) => setZoneName(event.target.value)}
                  className="rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-700"
                  placeholder="Zone 1"
                />

                <input
                  value={zoneDescription}
                  onChange={(event) => setZoneDescription(event.target.value)}
                  className="rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-700 sm:col-span-2"
                  placeholder="Description"
                />

                <input
                  type="number"
                  value={zoneOrder}
                  onChange={(event) => setZoneOrder(event.target.value)}
                  className="rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-700"
                  placeholder="Order"
                />
              </div>

              <button
                onClick={addZone}
                className="mt-4 rounded-2xl bg-blue-700 px-5 py-3 font-black text-white hover:bg-blue-800"
              >
                Add Zone
              </button>

              <div className="mt-5 space-y-3">
                {zones.map((zone) => (
                  <div
                    key={zone.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-black text-slate-900">
                        {zone.name}
                      </p>
                      <p className="text-sm text-slate-500">
                        {zone.description || "No description"} · Order{" "}
                        {zone.display_order ?? 0}
                      </p>
                    </div>

                    <button
                      onClick={() => deleteZone(zone)}
                      className="shrink-0 rounded-xl border border-red-300 px-3 py-2 text-xs font-black text-red-700 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                ))}

                {zones.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                    No zones added yet.
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-3xl bg-white p-4 shadow sm:p-6">
              <SectionHeader
                title="Polling Areas"
                subtitle="Add polling areas used by the campaign and voter register."
              />

              <div className="mt-5 grid gap-3 sm:grid-cols-4">
                <input
                  value={pollingCode}
                  onChange={(event) => setPollingCode(event.target.value)}
                  className="rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-700"
                  placeholder="Code"
                />

                <input
                  value={pollingName}
                  onChange={(event) => setPollingName(event.target.value)}
                  className="rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-700"
                  placeholder="Name"
                />

                <input
                  value={pollingLocation}
                  onChange={(event) => setPollingLocation(event.target.value)}
                  className="rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-700"
                  placeholder="Location"
                />

                <input
                  type="number"
                  value={pollingOrder}
                  onChange={(event) => setPollingOrder(event.target.value)}
                  className="rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-700"
                  placeholder="Order"
                />
              </div>

              <button
                onClick={addPollingArea}
                className="mt-4 rounded-2xl bg-blue-700 px-5 py-3 font-black text-white hover:bg-blue-800"
              >
                Add Polling Area
              </button>

              <div className="mt-5 space-y-3">
                {pollingAreas.map((area) => (
                  <div
                    key={area.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-black text-slate-900">
                        {area.code}
                      </p>
                      <p className="text-sm text-slate-500">
                        {area.name || "No name"} ·{" "}
                        {area.location || "No location"}
                      </p>
                    </div>

                    <button
                      onClick={() => deletePollingArea(area)}
                      className="shrink-0 rounded-xl border border-red-300 px-3 py-2 text-xs font-black text-red-700 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                ))}

                {pollingAreas.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                    No polling areas added yet.
                  </div>
                )}
              </div>
            </section>
          </div>

          <section className="mt-5 rounded-3xl bg-white p-4 shadow sm:p-6">
            <SectionHeader
              title="Competitor Data"
              subtitle="Enter aggregate competitor vote estimates by zone or polling area. Do not record how any individual voted."
            />

            <div className="mt-5 grid gap-4 xl:grid-cols-2">
              <div className="rounded-3xl border border-slate-200 p-4">
                <h3 className="text-lg font-black text-slate-900">
                  Add Competitor
                </h3>

                <div className="mt-4 grid gap-3 sm:grid-cols-4">
                  <input
                    value={competitorName}
                    onChange={(event) => setCompetitorName(event.target.value)}
                    className="rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-700"
                    placeholder="Competitor name"
                  />

                  <input
                    value={competitorDescription}
                    onChange={(event) =>
                      setCompetitorDescription(event.target.value)
                    }
                    className="rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-700 sm:col-span-2"
                    placeholder="Description"
                  />

                  <input
                    type="number"
                    value={competitorOrder}
                    onChange={(event) => setCompetitorOrder(event.target.value)}
                    className="rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-700"
                    placeholder="Order"
                  />
                </div>

                <button
                  onClick={addCompetitor}
                  className="mt-4 rounded-2xl bg-blue-700 px-5 py-3 font-black text-white hover:bg-blue-800"
                >
                  Add Competitor
                </button>

                <div className="mt-5 space-y-3">
                  {competitorTotals.map((competitor) => (
                    <div
                      key={competitor.id}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 p-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-black text-slate-900">
                          {competitor.name}
                        </p>
                        <p className="text-sm text-slate-500">
                          Estimate total: {formatNumber(competitor.total)}
                        </p>
                      </div>

                      <button
                        onClick={() =>
                          deleteCompetitor({
                            id: competitor.id,
                            name: competitor.name,
                            description: competitor.description,
                            display_order: 0,
                          })
                        }
                        className="shrink-0 rounded-xl border border-red-300 px-3 py-2 text-xs font-black text-red-700 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  ))}

                  {competitorTotals.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                      No competitors added yet.
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 p-4">
                <h3 className="text-lg font-black text-slate-900">
                  Add Competitor Estimate
                </h3>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <select
                    value={estimateCompetitorId}
                    onChange={(event) =>
                      setEstimateCompetitorId(event.target.value)
                    }
                    className="rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-700"
                  >
                    <option value="">Select competitor</option>
                    {competitors.map((competitor) => (
                      <option key={competitor.id} value={competitor.id}>
                        {competitor.name}
                      </option>
                    ))}
                  </select>

                  <input
                    type="number"
                    value={estimateVotes}
                    onChange={(event) => setEstimateVotes(event.target.value)}
                    className="rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-700"
                    placeholder="Estimated votes"
                  />

                  <select
                    value={estimateZone}
                    onChange={(event) => setEstimateZone(event.target.value)}
                    className="rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-700"
                  >
                    <option value="">Overall / no specific zone</option>
                    {zones.map((zone) => (
                      <option key={zone.id} value={zone.name}>
                        {zone.name}
                      </option>
                    ))}
                  </select>

                  <select
                    value={estimatePollingArea}
                    onChange={(event) =>
                      setEstimatePollingArea(event.target.value)
                    }
                    className="rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-700"
                  >
                    <option value="">No specific polling area</option>
                    {pollingAreas.map((area) => (
                      <option key={area.id} value={area.code}>
                        {area.code} {area.name ? `- ${area.name}` : ""}
                      </option>
                    ))}
                  </select>

                  <textarea
                    value={estimateNotes}
                    onChange={(event) => setEstimateNotes(event.target.value)}
                    className="rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-700 sm:col-span-2"
                    placeholder="Notes"
                    rows={3}
                  />
                </div>

                <button
                  onClick={addCompetitorEstimate}
                  className="mt-4 rounded-2xl bg-blue-700 px-5 py-3 font-black text-white hover:bg-blue-800"
                >
                  Add Estimate
                </button>
              </div>
            </div>

            <div className="mt-5">
              <h3 className="text-lg font-black text-slate-900">
                Competitor Estimates
              </h3>

              <div className="mt-3 grid gap-3">
                {competitorEstimates.map((estimate) => (
                  <div
                    key={estimate.id}
                    className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="font-black text-slate-900">
                        {estimate.competitor_id
                          ? competitorNameMap.get(estimate.competitor_id) ||
                            "Competitor"
                          : "Competitor"}
                      </p>

                      <p className="text-sm text-slate-500">
                        {estimate.zone || "Overall"} ·{" "}
                        {estimate.polling_area || "No polling area"} ·{" "}
                        {formatNumber(estimate.estimated_votes || 0)} votes
                      </p>

                      {estimate.notes && (
                        <p className="mt-1 text-sm text-slate-500">
                          {estimate.notes}
                        </p>
                      )}
                    </div>

                    <button
                      onClick={() => deleteCompetitorEstimate(estimate)}
                      className="w-fit shrink-0 rounded-xl border border-red-300 px-3 py-2 text-xs font-black text-red-700 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                ))}

                {competitorEstimates.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                    No competitor estimates added yet.
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
