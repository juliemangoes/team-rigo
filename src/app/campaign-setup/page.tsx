"use client";

import type { ReactNode } from "react";
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

type SetupTab = "victory" | "zones" | "polling" | "support" | "opponent";

const tabs: {
  id: SetupTab;
  label: string;
  shortLabel: string;
  description: string;
}[] = [
  {
    id: "victory",
    label: "Victory Settings",
    shortLabel: "Victory",
    description: "Election name and vote target.",
  },
  {
    id: "zones",
    label: "Zones",
    shortLabel: "Zones",
    description: "Campaign zone options.",
  },
  {
    id: "polling",
    label: "Polling Areas",
    shortLabel: "Polling",
    description: "Polling area options.",
  },
  {
    id: "support",
    label: "Support Fields",
    shortLabel: "Support",
    description: "Support status labels and visibility.",
  },
  {
    id: "opponent",
    label: "Opponent",
    shortLabel: "Opponent",
    description: "Opponent name used on the dashboard.",
  },
];

const colorOptions = [
  "slate",
  "blue",
  "green",
  "amber",
  "orange",
  "red",
  "purple",
];

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value || 0);
}

function cleanNumber(value: string, fallback = 0) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) return fallback;

  return Math.max(0, Math.round(numberValue));
}

function colorClass(color: string | null | undefined) {
  if (color === "green") return "bg-green-100 text-green-800";
  if (color === "blue") return "bg-blue-100 text-blue-800";
  if (color === "amber") return "bg-amber-100 text-amber-800";
  if (color === "orange") return "bg-orange-100 text-orange-800";
  if (color === "red") return "bg-red-100 text-red-800";
  if (color === "purple") return "bg-purple-100 text-purple-800";

  return "bg-slate-100 text-slate-800";
}

function SectionTitle({
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
        <h2 className="text-2xl font-black tracking-tight text-slate-950">
          {title}
        </h2>
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      </div>

      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

function InputLabel({ children }: { children: ReactNode }) {
  return <label className="text-sm font-black text-slate-700">{children}</label>;
}

function SummaryCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail?: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-black uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-2 truncate text-2xl font-black text-slate-950">
        {value}
      </p>
      {detail && <p className="mt-1 text-xs text-slate-500">{detail}</p>}
    </div>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm font-semibold text-slate-500">
      {children}
    </div>
  );
}

export default function CampaignSetupPage() {
  const [activeTab, setActiveTab] = useState<SetupTab>("victory");

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
  const [savingSupportId, setSavingSupportId] = useState("");
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

  async function saveSettings() {
    if (!electionName.trim()) {
      setMessage("Enter an election or campaign name.");
      return;
    }

    setSavingSettings(true);
    setMessage("");

    const { error } = await supabase.from("campaign_settings").upsert({
      id: 1,
      election_name: electionName.trim(),
      vote_target_to_win: cleanNumber(voteTarget),
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.error("Save settings error:", error);
      setMessage(error.message || "Error saving campaign settings.");
      setSavingSettings(false);
      return;
    }

    setMessage("Victory settings saved.");
    await loadSettings();

    setSavingSettings(false);
  }

  async function addZone() {
    if (!zoneName.trim()) {
      setMessage("Enter a zone name.");
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
      setMessage("Enter a polling area code.");
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
      setMessage("Enter the opponent name.");
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
      setMessage("Enter a display label for this support field.");
      return;
    }

    setSavingSupportId(option.id);
    setMessage("");

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
      setMessage(error.message || "Error saving support status field.");
      setSavingSupportId("");
      return;
    }

    setMessage("Support field saved.");
    await loadSupportStatusOptions();

    setSavingSupportId("");
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
      <section className="border-b border-slate-200 bg-white px-4 py-5 sm:px-6 sm:py-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-5xl">
                Campaign Setup
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-500 sm:text-base">
                Manage the core options that power the dashboard, voters page,
                reports, and field views.
              </p>
            </div>

            <button
              onClick={loadPage}
              className="w-full rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-black text-slate-800 hover:bg-slate-50 sm:w-auto"
            >
              Refresh
            </button>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <SummaryCard
              label="Vote Target"
              value={formatNumber(setupSummary.voteTarget)}
            />
            <SummaryCard label="Zones" value={formatNumber(setupSummary.zones)} />
            <SummaryCard
              label="Polling Areas"
              value={formatNumber(setupSummary.pollingAreas)}
            />
            <SummaryCard
              label="Support Fields"
              value={formatNumber(setupSummary.supportStatuses)}
            />
            <SummaryCard label="Opponent" value={setupSummary.opponent} />
          </div>
        </div>
      </section>

      <section className="px-4 py-5 sm:px-6 sm:py-8">
        <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[280px_1fr]">
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:grid lg:gap-2 lg:overflow-visible lg:px-0 lg:pb-0">
              {tabs.map((tab) => {
                const active = activeTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`min-w-fit rounded-2xl border px-4 py-3 text-left transition lg:w-full ${
                      active
                        ? "border-blue-700 bg-blue-700 text-white shadow-sm"
                        : "border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50"
                    }`}
                  >
                    <p className="text-sm font-black lg:hidden">
                      {tab.shortLabel}
                    </p>
                    <p className="hidden text-sm font-black lg:block">
                      {tab.label}
                    </p>
                    <p
                      className={`mt-1 hidden text-xs lg:block ${
                        active ? "text-blue-100" : "text-slate-500"
                      }`}
                    >
                      {tab.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </aside>

          <div className="min-w-0">
            {message && (
              <div className="mb-5 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm font-bold text-blue-900">
                {message}
              </div>
            )}

            {activeTab === "victory" && (
              <section className="rounded-3xl bg-white p-4 shadow-sm sm:p-6">
                <SectionTitle
                  title="Victory Settings"
                  subtitle="Set the campaign name and the vote target used by the dashboard."
                />

                <div className="mt-6 grid gap-4 md:grid-cols-3">
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
                  className="mt-6 w-full rounded-2xl bg-blue-700 px-5 py-3 font-black text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-blue-300 sm:w-auto"
                >
                  {savingSettings ? "Saving..." : "Save Victory Settings"}
                </button>
              </section>
            )}

            {activeTab === "zones" && (
              <section className="rounded-3xl bg-white p-4 shadow-sm sm:p-6">
                <SectionTitle
                  title="Campaign Zones"
                  subtitle="Use the same zone names that appear in voter records and team assignments."
                />

                <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <h3 className="text-lg font-black text-slate-950">Add Zone</h3>

                  <div className="mt-4 grid gap-3 md:grid-cols-4">
                    <input
                      value={zoneName}
                      onChange={(event) => setZoneName(event.target.value)}
                      className="rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-700"
                      placeholder="Zone name"
                    />

                    <input
                      value={zoneDescription}
                      onChange={(event) =>
                        setZoneDescription(event.target.value)
                      }
                      className="rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-700 md:col-span-2"
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
                    className="mt-4 w-full rounded-2xl bg-blue-700 px-5 py-3 font-black text-white hover:bg-blue-800 sm:w-auto"
                  >
                    Add Zone
                  </button>
                </div>

                <div className="mt-5 grid gap-3">
                  {zones.map((zone) => (
                    <div
                      key={zone.id}
                      className="flex flex-col gap-3 rounded-3xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="break-words text-lg font-black text-slate-950">
                          {zone.name}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {zone.description || "No description"} · Order{" "}
                          {zone.display_order ?? 0}
                        </p>
                      </div>

                      <button
                        onClick={() => deleteZone(zone)}
                        className="w-full rounded-2xl border border-red-300 px-4 py-3 text-sm font-black text-red-700 hover:bg-red-50 sm:w-auto"
                      >
                        Delete
                      </button>
                    </div>
                  ))}

                  {zones.length === 0 && <EmptyState>No zones added yet.</EmptyState>}
                </div>
              </section>
            )}

            {activeTab === "polling" && (
              <section className="rounded-3xl bg-white p-4 shadow-sm sm:p-6">
                <SectionTitle
                  title="Polling Areas"
                  subtitle="These options should match the polling areas used in voter records."
                />

                <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <h3 className="text-lg font-black text-slate-950">
                    Add Polling Area
                  </h3>

                  <div className="mt-4 grid gap-3 md:grid-cols-4">
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
                      onChange={(event) =>
                        setPollingLocation(event.target.value)
                      }
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
                    className="mt-4 w-full rounded-2xl bg-blue-700 px-5 py-3 font-black text-white hover:bg-blue-800 sm:w-auto"
                  >
                    Add Polling Area
                  </button>
                </div>

                <div className="mt-5 grid gap-3">
                  {pollingAreas.map((area) => (
                    <div
                      key={area.id}
                      className="flex flex-col gap-3 rounded-3xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="break-words text-lg font-black text-slate-950">
                          {area.code}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {area.name || "No name"} ·{" "}
                          {area.location || "No location"} · Order{" "}
                          {area.display_order ?? 0}
                        </p>
                      </div>

                      <button
                        onClick={() => deletePollingArea(area)}
                        className="w-full rounded-2xl border border-red-300 px-4 py-3 text-sm font-black text-red-700 hover:bg-red-50 sm:w-auto"
                      >
                        Delete
                      </button>
                    </div>
                  ))}

                  {pollingAreas.length === 0 && (
                    <EmptyState>No polling areas added yet.</EmptyState>
                  )}
                </div>
              </section>
            )}

            {activeTab === "support" && (
              <section className="rounded-3xl bg-white p-4 shadow-sm sm:p-6">
                <SectionTitle
                  title="Support Status Fields"
                  subtitle="Edit display labels, descriptions, order, color, and visibility. System values stay locked so reports still calculate correctly."
                />

                <div className="mt-6 grid gap-3">
                  {supportStatusOptions.map((option) => (
                    <div
                      key={option.id}
                      className="rounded-3xl border border-slate-200 p-4"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-black ${colorClass(
                                option.color
                              )}`}
                            >
                              {option.value}
                            </span>

                            <span
                              className={`rounded-full px-3 py-1 text-xs font-black ${
                                option.is_active
                                  ? "bg-green-100 text-green-800"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {option.is_active ? "Active" : "Hidden"}
                            </span>
                          </div>

                          <h3 className="mt-3 break-words text-xl font-black text-slate-950">
                            {option.label}
                          </h3>

                          <p className="mt-1 text-sm text-slate-500">
                            {option.description || "No description"}
                          </p>
                        </div>

                        <button
                          onClick={() => saveSupportStatusOption(option)}
                          disabled={savingSupportId === option.id}
                          className="w-full rounded-2xl bg-blue-700 px-5 py-3 text-sm font-black text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-blue-300 sm:w-auto"
                        >
                          {savingSupportId === option.id ? "Saving..." : "Save"}
                        </button>
                      </div>

                      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1.5fr_2fr_0.8fr_0.9fr_0.9fr]">
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
                          <InputLabel>Color</InputLabel>
                          <select
                            value={option.color || "slate"}
                            onChange={(event) =>
                              updateSupportStatusLocal(option.id, {
                                color: event.target.value,
                              })
                            }
                            className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-700"
                          >
                            {colorOptions.map((color) => (
                              <option key={color} value={color}>
                                {color}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <InputLabel>Visibility</InputLabel>
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
                      </div>
                    </div>
                  ))}

                  {supportStatusOptions.length === 0 && (
                    <EmptyState>
                      No support status fields found. Run the support status
                      setup SQL first.
                    </EmptyState>
                  )}
                </div>
              </section>
            )}

            {activeTab === "opponent" && (
              <section className="rounded-3xl bg-white p-4 shadow-sm sm:p-6">
                <SectionTitle
                  title="Opponent Setup"
                  subtitle="Store the opponent name. The dashboard opponent total comes from voters marked Not Supporting."
                />

                <div className="mt-6 grid gap-4 md:grid-cols-4">
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

                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
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

                <div className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  Opponent support is not entered manually here. It is tallied
                  automatically from voters whose support status is{" "}
                  <span className="font-black">Not Supporting</span>.
                </div>
              </section>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
