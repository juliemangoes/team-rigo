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

type TeamMember = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  zone: string | null;
  role: string | null;
  assigned_polling_area: string | null;
  assigned_classroom: string | null;
  surname_from: string | null;
  surname_to: string | null;
  created_at: string | null;
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

const roleOptions = [
  "Campaign Manager",
  "Zone Leader",
  "Campaigner",
  "Driver",
  "Scrutineer",
];

const emptyForm = {
  full_name: "",
  email: "",
  phone: "",
  role: "Campaigner",
  zone: "",
  assigned_polling_area: "",
  assigned_classroom: "",
  surname_from: "",
  surname_to: "",
};

type TeamForm = typeof emptyForm;

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value || 0);
}

function rolePillClass(role: string | null) {
  if (role === "Campaign Manager") return "bg-sky-100 text-sky-800";
  if (role === "Zone Leader") return "bg-purple-100 text-purple-800";
  if (role === "Campaigner") return "bg-green-100 text-green-800";
  if (role === "Driver") return "bg-amber-100 text-amber-800";
  if (role === "Scrutineer") return "bg-red-100 text-red-800";

  return "bg-slate-100 text-slate-700";
}

function initials(name: string | null | undefined) {
  if (!name) return "TR";

  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) return "TR";

  return parts.map((part) => part.charAt(0).toUpperCase()).join("");
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-xs font-black uppercase tracking-wide text-slate-500">
      {children}
    </label>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-sky-700 focus:ring-4 focus:ring-sky-100"
      placeholder={placeholder}
    />
  );
}

function SelectInput({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm outline-none transition focus:border-sky-700 focus:ring-4 focus:ring-sky-100"
    >
      {children}
    </select>
  );
}

function SummaryCard({
  label,
  value,
  detail,
  tone = "slate",
}: {
  label: string;
  value: string | number;
  detail?: string;
  tone?: "blue" | "green" | "red" | "amber" | "purple" | "slate";
}) {
  const color =
    tone === "blue"
      ? "border-sky-100 bg-sky-50 text-sky-700"
      : tone === "green"
      ? "border-green-100 bg-green-50 text-green-700"
      : tone === "red"
      ? "border-red-100 bg-red-50 text-red-700"
      : tone === "amber"
      ? "border-amber-100 bg-amber-50 text-amber-700"
      : tone === "purple"
      ? "border-purple-100 bg-purple-50 text-purple-700"
      : "border-slate-200 bg-white text-slate-900";

  return (
    <div className={`rounded-3xl border p-4 shadow-sm ${color}`}>
      <p className="text-xs font-black uppercase tracking-wide opacity-65">
        {label}
      </p>
      <p className="mt-2 text-2xl font-black tracking-tight">{value}</p>
      {detail && <p className="mt-1 text-xs font-semibold opacity-70">{detail}</p>}
    </div>
  );
}

export default function TeamSetupPage() {
  const [profile, setProfile] = useState<TeamProfile | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [campaignZones, setCampaignZones] = useState<CampaignZone[]>([]);
  const [pollingAreas, setPollingAreas] = useState<PollingArea[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");
  const [zoneFilter, setZoneFilter] = useState("All");

  const [form, setForm] = useState<TeamForm>(emptyForm);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [showForm, setShowForm] = useState(false);

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

    await Promise.all([loadTeamMembers(), loadCampaignZones(), loadPollingAreas()]);

    setLoading(false);
  }

  async function loadTeamMembers() {
    const { data, error } = await supabase
      .from("campaigners")
      .select(
        `
        id,
        full_name,
        email,
        phone,
        zone,
        role,
        assigned_polling_area,
        assigned_classroom,
        surname_from,
        surname_to,
        created_at
      `
      )
      .order("full_name", { ascending: true });

    if (error) {
      console.error("Team members error:", error);
      setTeamMembers([]);
      return;
    }

    setTeamMembers(data || []);
  }

  async function loadCampaignZones() {
    const { data, error } = await supabase
      .from("campaign_zones")
      .select("id, name, description, display_order")
      .order("display_order", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      console.error("Campaign zones error:", error);
      setCampaignZones([]);
      return;
    }

    setCampaignZones(data || []);
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

  function updateForm(field: keyof TeamForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function openCreateForm() {
    setEditingMember(null);
    setForm(emptyForm);
    setShowForm(true);
    setMessage("");
  }

  function openEditForm(member: TeamMember) {
    setEditingMember(member);
    setForm({
      full_name: member.full_name || "",
      email: member.email || "",
      phone: member.phone || "",
      role: member.role || "Campaigner",
      zone: member.zone || "",
      assigned_polling_area: member.assigned_polling_area || "",
      assigned_classroom: member.assigned_classroom || "",
      surname_from: member.surname_from || "",
      surname_to: member.surname_to || "",
    });
    setShowForm(true);
    setMessage("");
  }

  function closeForm() {
    setEditingMember(null);
    setForm(emptyForm);
    setShowForm(false);
  }

  function buildPayload() {
    const role = form.role || "Campaigner";
    const isScrutineer = role === "Scrutineer";

    return {
      full_name: form.full_name.trim(),
      email: normalizeEmail(form.email) || null,
      phone: form.phone.trim() || null,
      role,
      zone: form.zone || null,
      assigned_polling_area: isScrutineer
        ? form.assigned_polling_area || null
        : null,
      assigned_classroom: isScrutineer
        ? form.assigned_classroom.trim() || null
        : null,
      surname_from: isScrutineer ? form.surname_from.trim().toUpperCase() || null : null,
      surname_to: isScrutineer ? form.surname_to.trim().toUpperCase() || null : null,
    };
  }

  function validateForm() {
    if (!form.full_name.trim()) return "Enter the team member's full name.";

    if (!form.email.trim()) {
      return "Enter the email address used for login.";
    }

    if (form.email.trim() && !form.email.includes("@")) {
      return "Enter a valid email address.";
    }

    if (!form.role) return "Select a role.";

    if (form.role === "Scrutineer") {
      if (!form.assigned_polling_area) {
        return "Select the scrutineer's polling area.";
      }

      if (!form.assigned_classroom.trim()) {
        return "Enter the scrutineer's classroom.";
      }

      if (!form.surname_from.trim() || !form.surname_to.trim()) {
        return "Enter the scrutineer's surname range.";
      }
    }

    return "";
  }

  async function saveMember() {
    if (!canAccess) return;

    const validationError = validateForm();

    if (validationError) {
      setMessage(validationError);
      return;
    }

    setSaving(true);
    setMessage("");

    const payload = buildPayload();

    if (editingMember) {
      const { error } = await supabase
        .from("campaigners")
        .update(payload)
        .eq("id", editingMember.id);

      if (error) {
        console.error("Update team member error:", error);
        setMessage(error.message || "Error updating team member.");
        setSaving(false);
        return;
      }

      setMessage("Team member updated.");
    } else {
      const { error } = await supabase.from("campaigners").insert(payload);

      if (error) {
        console.error("Add team member error:", error);
        setMessage(error.message || "Error adding team member.");
        setSaving(false);
        return;
      }

      setMessage("Team member added.");
    }

    await loadTeamMembers();
    closeForm();
    setSaving(false);
  }

  async function deleteMember(member: TeamMember) {
    if (!canAccess) return;

    const confirmed = confirm(`Delete ${member.full_name}?`);

    if (!confirmed) return;

    const { error } = await supabase
      .from("campaigners")
      .delete()
      .eq("id", member.id);

    if (error) {
      console.error("Delete team member error:", error);
      setMessage(error.message || "Error deleting team member.");
      return;
    }

    setMessage("Team member deleted.");
    await loadTeamMembers();
  }

  const zoneOptions = useMemo(() => {
    const zones = new Set<string>();

    zones.add("All Zones");

    campaignZones.forEach((zone) => {
      if (zone.name) zones.add(zone.name);
    });

    teamMembers.forEach((member) => {
      if (member.zone) zones.add(member.zone);
    });

    return Array.from(zones).sort();
  }, [campaignZones, teamMembers]);

  function pollingAreaLabel(code: string) {
    const area = pollingAreas.find((item) => item.code === code);

    if (!area) return code;

    return area.name ? `${area.code} - ${area.name}` : area.code;
  }

  const filteredMembers = useMemo(() => {
    const cleanSearch = search.trim().toLowerCase();

    return teamMembers.filter((member) => {
      const matchesSearch =
        !cleanSearch ||
        member.full_name.toLowerCase().includes(cleanSearch) ||
        (member.email || "").toLowerCase().includes(cleanSearch) ||
        (member.phone || "").toLowerCase().includes(cleanSearch) ||
        (member.zone || "").toLowerCase().includes(cleanSearch) ||
        (member.assigned_polling_area || "").toLowerCase().includes(cleanSearch);

      const matchesRole = roleFilter === "All" || member.role === roleFilter;
      const matchesZone = zoneFilter === "All" || member.zone === zoneFilter;

      return matchesSearch && matchesRole && matchesZone;
    });
  }, [teamMembers, search, roleFilter, zoneFilter]);

  const teamStats = useMemo(() => {
    return {
      total: teamMembers.length,
      managers: teamMembers.filter((member) => member.role === "Campaign Manager")
        .length,
      zoneLeaders: teamMembers.filter((member) => member.role === "Zone Leader")
        .length,
      campaigners: teamMembers.filter((member) => member.role === "Campaigner")
        .length,
      drivers: teamMembers.filter((member) => member.role === "Driver").length,
      scrutineers: teamMembers.filter((member) => member.role === "Scrutineer")
        .length,
      missingEmail: teamMembers.filter((member) => !member.email).length,
    };
  }, [teamMembers]);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 p-4 sm:p-6">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-3xl bg-white p-6 text-center shadow-sm">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-sky-700" />
            <h1 className="mt-5 text-xl font-black text-slate-900">
              Loading team setup...
            </h1>
          </div>
        </div>
      </main>
    );
  }

  if (!canAccess) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4 sm:p-6">
        <div className="w-full max-w-xl rounded-3xl bg-white p-6 text-center shadow-sm sm:p-8">
          <h1 className="text-2xl font-black text-slate-900">
            Campaign Manager Access Only
          </h1>

          <p className="mt-3 text-slate-600">
            Team setup is restricted to the Campaign Manager.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-slate-100">
      <section className="bg-white px-4 py-5 shadow-sm sm:px-6 sm:py-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-5xl">
                Team Setup
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-500 sm:text-base">
                Manage team members, role access, zones, and scrutineer
                classroom assignments.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                onClick={loadPage}
                className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-black text-slate-800 hover:bg-slate-50"
              >
                Refresh
              </button>

              <button
                onClick={openCreateForm}
                className="rounded-2xl bg-sky-700 px-5 py-3 text-sm font-black text-white hover:bg-sky-800"
              >
                Add Team Member
              </button>
            </div>
          </div>

          {message && (
            <div className="mt-4 rounded-2xl border border-sky-100 bg-sky-50 p-4 text-sm font-bold text-sky-900">
              {message}
            </div>
          )}

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            <SummaryCard label="Total" value={formatNumber(teamStats.total)} />
            <SummaryCard
              label="Managers"
              value={formatNumber(teamStats.managers)}
              tone="blue"
            />
            <SummaryCard
              label="Zone Leaders"
              value={formatNumber(teamStats.zoneLeaders)}
              tone="purple"
            />
            <SummaryCard
              label="Campaigners"
              value={formatNumber(teamStats.campaigners)}
              tone="green"
            />
            <SummaryCard
              label="Drivers"
              value={formatNumber(teamStats.drivers)}
              tone="amber"
            />
            <SummaryCard
              label="Scrutineers"
              value={formatNumber(teamStats.scrutineers)}
              detail={
                teamStats.missingEmail > 0
                  ? `${formatNumber(teamStats.missingEmail)} missing email`
                  : undefined
              }
              tone={teamStats.missingEmail > 0 ? "red" : "slate"}
            />
          </div>
        </div>
      </section>

      <section className="px-4 py-5 sm:px-6 sm:py-8">
        <div className="mx-auto max-w-7xl">
          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="grid gap-3 lg:grid-cols-[1.5fr_1fr_1fr_auto] lg:items-end">
              <div>
                <FieldLabel>Search</FieldLabel>
                <TextInput
                  value={search}
                  onChange={setSearch}
                  placeholder="Name, email, phone, zone..."
                />
              </div>

              <div>
                <FieldLabel>Role</FieldLabel>
                <SelectInput value={roleFilter} onChange={setRoleFilter}>
                  <option>All</option>
                  {roleOptions.map((role) => (
                    <option key={role}>{role}</option>
                  ))}
                </SelectInput>
              </div>

              <div>
                <FieldLabel>Zone</FieldLabel>
                <SelectInput value={zoneFilter} onChange={setZoneFilter}>
                  <option>All</option>
                  {zoneOptions.map((zone) => (
                    <option key={zone}>{zone}</option>
                  ))}
                </SelectInput>
              </div>

              <button
                onClick={() => {
                  setSearch("");
                  setRoleFilter("All");
                  setZoneFilter("All");
                }}
                className="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-50"
              >
                Clear
              </button>
            </div>
          </section>

          <section className="mt-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-black text-slate-950">
                  Team Members
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Showing {formatNumber(filteredMembers.length)} of{" "}
                  {formatNumber(teamMembers.length)} member(s).
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 lg:hidden">
              {filteredMembers.map((member) => (
                <article
                  key={member.id}
                  className="rounded-3xl border border-slate-200 p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-sm font-black text-white">
                      {initials(member.full_name)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="break-words text-lg font-black text-slate-950">
                        {member.full_name}
                      </h3>

                      <p className="mt-1 break-words text-sm font-semibold text-slate-500">
                        {member.email || "No login email"}
                      </p>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-black ${rolePillClass(
                            member.role
                          )}`}
                        >
                          {member.role || "No Role"}
                        </span>

                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">
                          {member.zone || "No Zone"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {member.role === "Scrutineer" && (
                    <div className="mt-4 rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-800">
                      Polling {member.assigned_polling_area || "Not set"} · Room{" "}
                      {member.assigned_classroom || "Not set"} ·{" "}
                      {member.surname_from || "?"} to {member.surname_to || "?"}
                    </div>
                  )}

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <button
                      onClick={() => openEditForm(member)}
                      className="rounded-2xl bg-sky-700 px-4 py-3 text-sm font-black text-white hover:bg-sky-800"
                    >
                      Edit
                    </button>

                    <button
                      onClick={() => deleteMember(member)}
                      className="rounded-2xl border border-red-200 px-4 py-3 text-sm font-black text-red-700 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </article>
              ))}

              {filteredMembers.length === 0 && (
                <div className="rounded-3xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                  No team members found.
                </div>
              )}
            </div>

            <div className="mt-4 hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[1060px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-3 pr-3 font-black">Name</th>
                    <th className="px-3 py-3 font-black">Email</th>
                    <th className="px-3 py-3 font-black">Phone</th>
                    <th className="px-3 py-3 font-black">Role</th>
                    <th className="px-3 py-3 font-black">Zone</th>
                    <th className="px-3 py-3 font-black">Scrutineer Assignment</th>
                    <th className="px-3 py-3 font-black">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredMembers.map((member) => (
                    <tr key={member.id} className="align-top">
                      <td className="py-3 pr-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-xs font-black text-white">
                            {initials(member.full_name)}
                          </div>

                          <p className="font-black text-slate-950">
                            {member.full_name}
                          </p>
                        </div>
                      </td>

                      <td className="px-3 py-3 font-semibold text-slate-700">
                        {member.email || "No email"}
                      </td>

                      <td className="px-3 py-3 font-semibold text-slate-700">
                        {member.phone || "No phone"}
                      </td>

                      <td className="px-3 py-3">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-black ${rolePillClass(
                            member.role
                          )}`}
                        >
                          {member.role || "No Role"}
                        </span>
                      </td>

                      <td className="px-3 py-3 font-semibold text-slate-700">
                        {member.zone || "No zone"}
                      </td>

                      <td className="px-3 py-3 font-semibold text-slate-700">
                        {member.role === "Scrutineer" ? (
                          <span>
                            Polling {member.assigned_polling_area || "Not set"} ·
                            Room {member.assigned_classroom || "Not set"} ·{" "}
                            {member.surname_from || "?"} to{" "}
                            {member.surname_to || "?"}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      <td className="px-3 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => openEditForm(member)}
                            className="rounded-xl bg-sky-700 px-3 py-2 text-xs font-black text-white hover:bg-sky-800"
                          >
                            Edit
                          </button>

                          <button
                            onClick={() => deleteMember(member)}
                            className="rounded-xl border border-red-200 px-3 py-2 text-xs font-black text-red-700 hover:bg-red-50"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {filteredMembers.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-10 text-center text-slate-500">
                        No team members found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {showForm && (
            <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
              <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-xl sm:max-w-3xl sm:rounded-3xl sm:p-6">
                <div className="mb-5 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-black text-slate-900">
                      {editingMember ? "Edit Team Member" : "Add Team Member"}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Match the email with the user's Supabase Auth login.
                    </p>
                  </div>

                  <button
                    onClick={closeForm}
                    className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-xl font-black text-slate-800"
                  >
                    ×
                  </button>
                </div>

                <div className="grid gap-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <FieldLabel>Full Name</FieldLabel>
                      <TextInput
                        value={form.full_name}
                        onChange={(value) => updateForm("full_name", value)}
                        placeholder="Full name"
                      />
                    </div>

                    <div>
                      <FieldLabel>Email Login</FieldLabel>
                      <TextInput
                        type="email"
                        value={form.email}
                        onChange={(value) => updateForm("email", value)}
                        placeholder="email@example.com"
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <FieldLabel>Phone</FieldLabel>
                      <TextInput
                        value={form.phone}
                        onChange={(value) => updateForm("phone", value)}
                        placeholder="Phone"
                      />
                    </div>

                    <div>
                      <FieldLabel>Role</FieldLabel>
                      <SelectInput
                        value={form.role}
                        onChange={(value) => updateForm("role", value)}
                      >
                        {roleOptions.map((role) => (
                          <option key={role}>{role}</option>
                        ))}
                      </SelectInput>
                    </div>

                    <div>
                      <FieldLabel>Zone</FieldLabel>
                      <SelectInput
                        value={form.zone}
                        onChange={(value) => updateForm("zone", value)}
                      >
                        <option value="">No zone</option>
                        {zoneOptions.map((zone) => (
                          <option key={zone} value={zone}>
                            {zone}
                          </option>
                        ))}
                      </SelectInput>
                    </div>
                  </div>

                  {form.role === "Scrutineer" && (
                    <div className="rounded-3xl border border-red-100 bg-red-50 p-4">
                      <h3 className="text-lg font-black text-red-900">
                        Scrutineer Assignment
                      </h3>
                      <p className="mt-1 text-sm font-semibold text-red-700">
                        Scrutineers must have a polling area, classroom and
                        surname range.
                      </p>

                      <div className="mt-4 grid gap-4 md:grid-cols-4">
                        <div>
                          <FieldLabel>Polling Area</FieldLabel>
                          <SelectInput
                            value={form.assigned_polling_area}
                            onChange={(value) =>
                              updateForm("assigned_polling_area", value)
                            }
                          >
                            <option value="">Select polling area</option>
                            {pollingAreas.map((area) => (
                              <option key={area.id} value={area.code}>
                                {pollingAreaLabel(area.code)}
                              </option>
                            ))}
                          </SelectInput>
                        </div>

                        <div>
                          <FieldLabel>Classroom</FieldLabel>
                          <TextInput
                            value={form.assigned_classroom}
                            onChange={(value) =>
                              updateForm("assigned_classroom", value)
                            }
                            placeholder="Room 1"
                          />
                        </div>

                        <div>
                          <FieldLabel>Surname From</FieldLabel>
                          <TextInput
                            value={form.surname_from}
                            onChange={(value) =>
                              updateForm("surname_from", value.toUpperCase())
                            }
                            placeholder="A"
                          />
                        </div>

                        <div>
                          <FieldLabel>Surname To</FieldLabel>
                          <TextInput
                            value={form.surname_to}
                            onChange={(value) =>
                              updateForm("surname_to", value.toUpperCase())
                            }
                            placeholder="F"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
                  This page creates or updates the team profile only. The user
                  still needs a matching Supabase Auth account/password to log in.
                </div>

                <div className="mt-6 grid gap-3 md:grid-cols-2">
                  <button
                    onClick={closeForm}
                    className="rounded-2xl border border-slate-300 px-4 py-3 font-black text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>

                  <button
                    onClick={saveMember}
                    disabled={saving}
                    className="rounded-2xl bg-sky-700 px-4 py-3 font-black text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-sky-300"
                  >
                    {saving
                      ? "Saving..."
                      : editingMember
                      ? "Save Changes"
                      : "Add Team Member"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
