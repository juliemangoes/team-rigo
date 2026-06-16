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

type SupportStatusOption = {
  id: string;
  value: string;
  label: string;
  description: string | null;
  color: string | null;
  display_order: number | null;
  is_active: boolean | null;
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
  const [supportStatusOptions, setSupportStatusOptions] = useState<
    SupportStatusOption[]
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

  const [opponentName, setOpponentName] = useState("");
  const [opponentDescription, setOpponentDescription] = useState("");
  const [opponentOrder, setOpponentOrder] = useState("");

  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingOpponent, setSavingOpponent] = useState(false);
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
      loadSupportStatusOptions(),
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

    const loadedCompetitors = data || [];
    const firstOpponent = loadedCompetitors[0];

    setCompetitors(loadedCompetitors);

    if (firstOpponent) {
      setOpponentName(firstOpponent.name || "");
      setOpponentDescription(firstOpponent.description || "");
      setOpponentOrder(String(firstOpponent.display_order || ""));
    } else {
      setOpponentName("");
      setOpponentDescription("");
      setOpponentOrder("");
    }
  }

  async function loadSupportStatusOptions() {
    const { data, error } = await supabase
      .from("support_status_options")
      .select("id, value, label, description, color, display_order, is_active")
      .order("display_order", { ascending: true })
      .order("label", { ascending: true });

    if (error) {
      console.error("Support status options error:", error);
      setSupportStatusOptions([]);
      return;
    }

    setSupportStatusOptions(data || []);
  }

  function updateSupportStatusLocal(
    id: string,
    changes: Partial<SupportStatusOption>
  ) {
    setSupportStatusOptions((current) =>
      current.map((item) => (item.id === id ? { ...item, ...changes } : item))
    );
  }

  async function saveSupportStatusOption(option: SupportStatusOption) {
    if (!option.label.trim()) {
      alert("Enter a label for this support status.");
      return;
    }

    const { error } = await supabase
      .from("support_status_options")
      .update({
        label: option.label.trim(),
        description: option.description?.trim() || null,
        color: option.color || "slate",
        display_order: option.display_order || 0,
        is_active: option.is_active ?? true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", option.id);

    if (error) {
      console.error("Save support status option error:", error);
      setMessage(error.message || "Error saving support status option.");
      return;
    }

    setMessage("Support status option saved.");
    await loadSupportStatusOptions();
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

  async function saveOpponent() {
    if (!opponentName.trim()) {
      alert("Enter the opponent name.");
      return;
    }

    setSavingOpponent(true);
    setMessage("");

    const firstOpponent = competitors[0];

    if (firstOpponent) {
      const { error } = await supabase
        .from("competitors")
        .update({
          name: opponentName.trim(),
          description: opponentDescription.trim() || null,
          display_order: cleanNumber(opponentOrder),
          updated_at: new Date().toISOString(),
        })
        .eq("id", firstOpponent.id);

      if (error) {
        console.error("Save opponent error:", error);
        setMessage(error.message || "Error saving opponent.");
        setSavingOpponent(false);
        return;
      }
    } else {
      const { error } = await supabase.from("competitors").insert({
        name: opponentName.trim(),
        description: opponentDescription.trim() || null,
        display_order: cleanNumber(opponentOrder),
        updated_at: new Date().toISOString(),
      });

      if (error) {
        console.error("Save opponent error:", error);
        setMessage(error.message || "Error saving opponent.");
        setSavingOpponent(false);
        return;
      }
    }

    setMessage("Opponent saved.");
    await loadCompetitors();
    setSavingOpponent(false);
  }

  async function deleteOpponent() {
    const firstOpponent = competitors[0];

    if (!firstOpponent) return;

    const confirmed = confirm(`Delete opponent "${firstOpponent.name}"?`);

    if (!confirmed) return;

    const { error } = await supabase
      .from("competitors")
      .delete()
      .eq("id", firstOpponent.id);

    if (error) {
      console.error("Delete opponent error:", error);
      setMessage(error.message || "Error deleting opponent.");
      return;
    }

    setMessage("Opponent deleted.");
    await loadCompetitors();
  }

  const setupSummary = useMemo(() => {
    return {
      voteTarget: settings?.vote_target_to_win || 0,
      zones: zones.length,
      pollingAreas: pollingAreas.length,
      supportStatuses: supportStatusOptions.filter((item) => item.is_active)
        .length,
      opponent: competitors[0]?.name || "Not set",
    };
  }, [settings, zones, pollingAreas, competitors, supportStatusOptions]);

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
                Manage victory target, zones, polling areas, and opponent name.
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
              <p className="text-xs text-slate-300">Support</p>
              <p className="mt-1 text-2xl font-black">
                {formatNumber(setupSummary.supportStatuses)}
              </p>
            </div>

            <div className="rounded-2xl bg-white/10 p-3">
              <p className="text-xs text-slate-300">Opponent</p>
              <p className="mt-1 truncate text-2xl font-black">
                {setupSummary.opponent}
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


          <section className="mt-5 rounded-3xl bg-white p-4 shadow sm:p-6">
            <SectionHeader
              title="Support Status Fields"
              subtitle="Edit the labels, descriptions, order, and visibility used on the Voters page. The system value stays fixed so dashboard reports continue to work correctly."
            />

            <div className="mt-5 grid gap-3">
              {supportStatusOptions.map((option) => (
                <div
                  key={option.id}
                  className="rounded-2xl border border-slate-200 p-4"
                >
                  <div className="grid gap-3 lg:grid-cols-[1fr_1.3fr_1.6fr_0.8fr_0.9fr_auto] lg:items-end">
                    <div>
                      <InputLabel>System Value</InputLabel>
                      <input
                        value={option.value}
                        disabled
                        className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-slate-500"
                      />
                    </div>

                    <div>
                      <InputLabel>Display Label</InputLabel>
                      <input
                        value={option.label}
                        onChange={(event) =>
                          updateSupportStatusLocal(option.id, {
                            label: event.target.value,
                          })
                        }
                        className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-700"
                      />
                    </div>

                    <div>
                      <InputLabel>Description</InputLabel>
                      <input
                        value={option.description || ""}
                        onChange={(event) =>
                          updateSupportStatusLocal(option.id, {
                            description: event.target.value,
                          })
                        }
                        className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-700"
                        placeholder="Optional"
                      />
                    </div>

                    <div>
                      <InputLabel>Order</InputLabel>
                      <input
                        type="number"
                        value={option.display_order ?? 0}
                        onChange={(event) =>
                          updateSupportStatusLocal(option.id, {
                            display_order: cleanNumber(event.target.value),
                          })
                        }
                        className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-700"
                      />
                    </div>

                    <div>
                      <InputLabel>Status</InputLabel>
                      <select
                        value={option.is_active ? "Active" : "Hidden"}
                        onChange={(event) =>
                          updateSupportStatusLocal(option.id, {
                            is_active: event.target.value === "Active",
                          })
                        }
                        className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-700"
                      >
                        <option>Active</option>
                        <option>Hidden</option>
                      </select>
                    </div>

                    <button
                      onClick={() => saveSupportStatusOption(option)}
                      className="rounded-2xl bg-blue-700 px-5 py-3 font-black text-white hover:bg-blue-800"
                    >
                      Save
                    </button>
                  </div>
                </div>
              ))}

              {supportStatusOptions.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                  No support status options found. Run the support status setup
                  SQL first.
                </div>
              )}
            </div>
          </section>

          <section className="mt-5 rounded-3xl bg-white p-4 shadow sm:p-6">
            <SectionHeader
              title="Opponent Setup"
              subtitle="Only the opponent name is stored here. Opponent totals are automatically tallied from voters marked Not Supporting."
            />

            <div className="mt-5 grid gap-4 md:grid-cols-4">
              <div>
                <InputLabel>Opponent Name</InputLabel>
                <input
                  value={opponentName}
                  onChange={(event) => setOpponentName(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-700"
                  placeholder="Opponent"
                />
              </div>

              <div className="md:col-span-2">
                <InputLabel>Description / Party</InputLabel>
                <input
                  value={opponentDescription}
                  onChange={(event) =>
                    setOpponentDescription(event.target.value)
                  }
                  className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-700"
                  placeholder="Optional"
                />
              </div>

              <div>
                <InputLabel>Order</InputLabel>
                <input
                  type="number"
                  value={opponentOrder}
                  onChange={(event) => setOpponentOrder(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-700"
                  placeholder="0"
                />
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                onClick={saveOpponent}
                disabled={savingOpponent}
                className="rounded-2xl bg-blue-700 px-5 py-3 font-black text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-blue-300"
              >
                {savingOpponent ? "Saving..." : "Save Opponent"}
              </button>

              {competitors[0] && (
                <button
                  onClick={deleteOpponent}
                  className="rounded-2xl border border-red-300 px-5 py-3 font-black text-red-700 hover:bg-red-50"
                >
                  Delete Opponent
                </button>
              )}
            </div>

            <div className="mt-5 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
              The opponent vote estimate on the dashboard will come from the
              number of voters whose support status is marked as{" "}
              <span className="font-black">Not Supporting</span>.
            </div>
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
        </div>
      </section>
    </main>
  );
}
