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

export default function CampaignSetupPage() {
  const [profile, setProfile] = useState<TeamProfile | null>(null);

  const [settings, setSettings] = useState<CampaignSettings | null>(null);
  const [zones, setZones] = useState<CampaignZone[]>([]);
  const [pollingAreas, setPollingAreas] = useState<PollingArea[]>([]);

  const [electionName, setElectionName] = useState("");
  const [voteTarget, setVoteTarget] = useState("");

  const [zoneName, setZoneName] = useState("");
  const [zoneDescription, setZoneDescription] = useState("");
  const [zoneOrder, setZoneOrder] = useState("");

  const [pollingCode, setPollingCode] = useState("");
  const [pollingName, setPollingName] = useState("");
  const [pollingLocation, setPollingLocation] = useState("");
  const [pollingOrder, setPollingOrder] = useState("");

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

    await Promise.all([loadSettings(), loadZones(), loadPollingAreas()]);

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

  async function saveSettings() {
    if (!electionName.trim()) {
      alert("Enter an election name.");
      return;
    }

    const targetNumber = Number(voteTarget);

    if (!Number.isFinite(targetNumber) || targetNumber < 0) {
      alert("Enter a valid vote target.");
      return;
    }

    setSavingSettings(true);
    setMessage("");

    const { error } = await supabase
      .from("campaign_settings")
      .upsert({
        id: 1,
        election_name: electionName.trim(),
        vote_target_to_win: Math.round(targetNumber),
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);

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

    const orderNumber = zoneOrder.trim() ? Number(zoneOrder) : 0;

    const { error } = await supabase.from("campaign_zones").insert({
      name: zoneName.trim(),
      description: zoneDescription.trim() || null,
      display_order: Number.isFinite(orderNumber) ? Math.round(orderNumber) : 0,
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

    const orderNumber = pollingOrder.trim() ? Number(pollingOrder) : 0;

    const { error } = await supabase.from("polling_areas").insert({
      code: pollingCode.trim(),
      name: pollingName.trim() || null,
      location: pollingLocation.trim() || null,
      display_order: Number.isFinite(orderNumber) ? Math.round(orderNumber) : 0,
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

  const setupSummary = useMemo(() => {
    return {
      voteTarget: settings?.vote_target_to_win || 0,
      zones: zones.length,
      pollingAreas: pollingAreas.length,
    };
  }, [settings, zones, pollingAreas]);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 p-6">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-2xl bg-white p-8 text-center shadow">
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
              Team Rigo
            </p>

            <h1 className="mt-3 text-2xl font-bold text-slate-900">
              Loading campaign setup...
            </h1>
          </div>
        </div>
      </main>
    );
  }

  if (!canAccess) {
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
            Campaign setup is restricted to the Campaign Manager.
          </p>
        </div>
      </main>
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
              Campaign Setup
            </h1>

            <p className="mt-2 text-slate-600">
              Set the vote target to win, zones, and polling areas used by the
              campaign dashboard.
            </p>
          </div>

          <button
            onClick={loadPage}
            className="rounded-xl bg-blue-700 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-800"
          >
            Refresh
          </button>
        </div>

        {message && (
          <div className="mb-6 rounded-xl bg-blue-50 p-4 text-sm font-medium text-blue-900">
            {message}
          </div>
        )}

        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-white p-6 shadow">
            <p className="text-sm text-slate-500">Vote Target to Win</p>
            <h2 className="mt-2 text-4xl font-black text-blue-700">
              {setupSummary.voteTarget}
            </h2>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow">
            <p className="text-sm text-slate-500">Zones</p>
            <h2 className="mt-2 text-4xl font-black text-slate-900">
              {setupSummary.zones}
            </h2>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow">
            <p className="text-sm text-slate-500">Polling Areas</p>
            <h2 className="mt-2 text-4xl font-black text-slate-900">
              {setupSummary.pollingAreas}
            </h2>
          </div>
        </div>

        <section className="mb-6 rounded-2xl bg-white p-6 shadow">
          <h2 className="text-2xl font-bold text-slate-900">
            Victory Settings
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            The dashboard will use this target to calculate whether the campaign
            is on track to win.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-slate-700">
                Election / Campaign Name
              </label>

              <input
                value={electionName}
                onChange={(event) => setElectionName(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-700"
                placeholder="Team Rigo Campaign"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">
                Vote Target to Win
              </label>

              <input
                type="number"
                value={voteTarget}
                onChange={(event) => setVoteTarget(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-700"
                placeholder="Example: 1200"
              />
            </div>
          </div>

          <button
            onClick={saveSettings}
            disabled={savingSettings}
            className="mt-6 rounded-xl bg-blue-700 px-5 py-3 font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-blue-300"
          >
            {savingSettings ? "Saving..." : "Save Victory Settings"}
          </button>
        </section>

        <div className="grid gap-6 xl:grid-cols-2">
          <section className="rounded-2xl bg-white p-6 shadow">
            <h2 className="text-2xl font-bold text-slate-900">
              Campaign Zones
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Add zones exactly how they should appear in reports and filters.
            </p>

            <div className="mt-6 grid gap-3 md:grid-cols-4">
              <input
                value={zoneName}
                onChange={(event) => setZoneName(event.target.value)}
                className="rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-700 md:col-span-1"
                placeholder="Zone 1"
              />

              <input
                value={zoneDescription}
                onChange={(event) => setZoneDescription(event.target.value)}
                className="rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-700 md:col-span-2"
                placeholder="Description"
              />

              <input
                type="number"
                value={zoneOrder}
                onChange={(event) => setZoneOrder(event.target.value)}
                className="rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-700"
                placeholder="Order"
              />
            </div>

            <button
              onClick={addZone}
              className="mt-4 rounded-xl bg-blue-700 px-5 py-3 font-semibold text-white hover:bg-blue-800"
            >
              Add Zone
            </button>

            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[600px] text-left text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-slate-600">
                    <th className="p-3">Zone</th>
                    <th className="p-3">Description</th>
                    <th className="p-3">Order</th>
                    <th className="p-3">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {zones.map((zone) => (
                    <tr key={zone.id} className="border-b">
                      <td className="p-3 font-bold text-slate-900">
                        {zone.name}
                      </td>

                      <td className="p-3 text-slate-700">
                        {zone.description || "No description"}
                      </td>

                      <td className="p-3 text-slate-700">
                        {zone.display_order ?? 0}
                      </td>

                      <td className="p-3">
                        <button
                          onClick={() => deleteZone(zone)}
                          className="rounded-lg border border-red-300 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}

                  {zones.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="p-8 text-center text-slate-500"
                      >
                        No zones added yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-2xl bg-white p-6 shadow">
            <h2 className="text-2xl font-bold text-slate-900">
              Polling Areas
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Add polling areas used by the campaign and voter register.
            </p>

            <div className="mt-6 grid gap-3 md:grid-cols-4">
              <input
                value={pollingCode}
                onChange={(event) => setPollingCode(event.target.value)}
                className="rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-700"
                placeholder="39"
              />

              <input
                value={pollingName}
                onChange={(event) => setPollingName(event.target.value)}
                className="rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-700"
                placeholder="Name"
              />

              <input
                value={pollingLocation}
                onChange={(event) => setPollingLocation(event.target.value)}
                className="rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-700"
                placeholder="Location"
              />

              <input
                type="number"
                value={pollingOrder}
                onChange={(event) => setPollingOrder(event.target.value)}
                className="rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-700"
                placeholder="Order"
              />
            </div>

            <button
              onClick={addPollingArea}
              className="mt-4 rounded-xl bg-blue-700 px-5 py-3 font-semibold text-white hover:bg-blue-800"
            >
              Add Polling Area
            </button>

            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[650px] text-left text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-slate-600">
                    <th className="p-3">Code</th>
                    <th className="p-3">Name</th>
                    <th className="p-3">Location</th>
                    <th className="p-3">Order</th>
                    <th className="p-3">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {pollingAreas.map((area) => (
                    <tr key={area.id} className="border-b">
                      <td className="p-3 font-bold text-slate-900">
                        {area.code}
                      </td>

                      <td className="p-3 text-slate-700">
                        {area.name || "No name"}
                      </td>

                      <td className="p-3 text-slate-700">
                        {area.location || "No location"}
                      </td>

                      <td className="p-3 text-slate-700">
                        {area.display_order ?? 0}
                      </td>

                      <td className="p-3">
                        <button
                          onClick={() => deletePollingArea(area)}
                          className="rounded-lg border border-red-300 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}

                  {pollingAreas.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="p-8 text-center text-slate-500"
                      >
                        No polling areas added yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}