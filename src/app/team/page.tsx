"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

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
  created_at?: string;
};

type TeamForm = {
  full_name: string;
  email: string;
  phone: string;
  zone: string;
  role: string;
  assigned_polling_area: string;
  assigned_classroom: string;
  surname_from: string;
  surname_to: string;
};

const roles = [
  "Campaign Manager",
  "Zone Leader",
  "Campaigner",
  "Driver",
  "Scrutineer",
];

const surnameLetters = [
  "",
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
  "M",
  "N",
  "O",
  "P",
  "Q",
  "R",
  "S",
  "T",
  "U",
  "V",
  "W",
  "X",
  "Y",
  "Z",
];

const defaultForm: TeamForm = {
  full_name: "",
  email: "",
  phone: "",
  zone: "",
  role: "Campaigner",
  assigned_polling_area: "",
  assigned_classroom: "",
  surname_from: "",
  surname_to: "",
};

export default function TeamSetupPage() {
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [form, setForm] = useState<TeamForm>(defaultForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadTeam();
  }, []);

  async function loadTeam() {
    setLoading(true);
    setMessage("");

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
      console.error("Team load error:", error);
      setMessage(error.message || "Error loading team members.");
      setTeam([]);
    } else {
      setTeam(data || []);
    }

    setLoading(false);
  }

  const filteredTeam = useMemo(() => {
    const term = search.toLowerCase().trim();

    return team.filter((member) => {
      const matchesSearch =
        !term ||
        member.full_name.toLowerCase().includes(term) ||
        (member.email || "").toLowerCase().includes(term) ||
        (member.phone || "").toLowerCase().includes(term) ||
        (member.zone || "").toLowerCase().includes(term) ||
        (member.role || "").toLowerCase().includes(term) ||
        (member.assigned_polling_area || "").toLowerCase().includes(term) ||
        (member.assigned_classroom || "").toLowerCase().includes(term);

      const matchesRole = roleFilter === "All" || member.role === roleFilter;

      return matchesSearch && matchesRole;
    });
  }, [team, search, roleFilter]);

  const stats = useMemo(() => {
    return {
      total: team.length,
      managers: team.filter((member) => member.role === "Campaign Manager")
        .length,
      campaigners: team.filter((member) => member.role === "Campaigner").length,
      zoneLeaders: team.filter((member) => member.role === "Zone Leader")
        .length,
      drivers: team.filter((member) => member.role === "Driver").length,
      scrutineers: team.filter((member) => member.role === "Scrutineer").length,
    };
  }, [team]);

  function updateForm(field: keyof TeamForm, value: string) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function resetForm() {
    setForm(defaultForm);
    setEditingId(null);
  }

  function startEdit(member: TeamMember) {
    setEditingId(member.id);

    setForm({
      full_name: member.full_name || "",
      email: member.email || "",
      phone: member.phone || "",
      zone: member.zone || "",
      role: member.role || "Campaigner",
      assigned_polling_area: member.assigned_polling_area || "",
      assigned_classroom: member.assigned_classroom || "",
      surname_from: member.surname_from || "",
      surname_to: member.surname_to || "",
    });

    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveMember() {
    if (!form.full_name.trim()) {
      setMessage("Full name is required.");
      alert("Full name is required.");
      return;
    }

    if (!form.email.trim()) {
      setMessage("Email is required. This must match the login email.");
      alert("Email is required. This must match the login email.");
      return;
    }

    if (!form.role.trim()) {
      setMessage("Role is required.");
      alert("Role is required.");
      return;
    }

if (form.role === "Scrutineer") {
  const missingFields = [];

  if (!form.assigned_polling_area.trim()) {
    missingFields.push("Polling Area");
  }

  if (!form.assigned_classroom.trim()) {
    missingFields.push("Classroom");
  }

  if (!form.surname_from.trim()) {
    missingFields.push("Surname From");
  }

  if (!form.surname_to.trim()) {
    missingFields.push("Surname To");
  }

  if (missingFields.length > 0) {
    const errorMessage = `Please complete these scrutineer fields: ${missingFields.join(
      ", "
    )}.

Current values detected:
Polling Area: ${form.assigned_polling_area || "blank"}
Classroom: ${form.assigned_classroom || "blank"}
Surname From: ${form.surname_from || "blank"}
Surname To: ${form.surname_to || "blank"}`;

    setMessage(errorMessage);
    alert(errorMessage);
    return;
  }
}

    setSaving(true);
    setMessage("");

    try {
      const isScrutineer = form.role === "Scrutineer";

      const payload = {
        full_name: form.full_name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim() || null,
        zone: form.zone.trim() || null,
        role: form.role,
        assigned_polling_area: isScrutineer
          ? form.assigned_polling_area.trim()
          : null,
        assigned_classroom: isScrutineer
          ? form.assigned_classroom.trim()
          : null,
        surname_from: isScrutineer
          ? form.surname_from.trim().toUpperCase()
          : null,
        surname_to: isScrutineer ? form.surname_to.trim().toUpperCase() : null,
      };

      let error;

      if (editingId) {
        const result = await supabase
          .from("campaigners")
          .update(payload)
          .eq("id", editingId)
          .select()
          .single();

        error = result.error;
      } else {
        const result = await supabase
          .from("campaigners")
          .insert(payload)
          .select()
          .single();

        error = result.error;
      }

      if (error) {
        console.error("Save team member error:", error);

        const errorMessage =
          error.message ||
          "Error saving team member. Check if the email already exists or if your account has Campaign Manager access.";

        setMessage(errorMessage);
        alert(errorMessage);
        setSaving(false);
        return;
      }

      const successMessage = editingId
        ? "Team member updated successfully."
        : "Team member added successfully.";

      resetForm();
      await loadTeam();

      setMessage(successMessage);
      alert(successMessage);
    } catch (error) {
      console.error("Unexpected save error:", error);

      setMessage("Unexpected error saving team member.");
      alert("Unexpected error saving team member. Check the browser console.");
    }

    setSaving(false);
  }

  async function deleteMember(member: TeamMember) {
    const confirmed = confirm(
      `Delete ${member.full_name}? This will remove the team profile but not the login account from Supabase Auth.`
    );

    if (!confirmed) return;

    setMessage("");

    const { error } = await supabase
      .from("campaigners")
      .delete()
      .eq("id", member.id);

    if (error) {
      console.error("Delete error:", error);
      setMessage(error.message || "Error deleting team member.");
      alert(error.message || "Error deleting team member.");
      return;
    }

    setMessage("Team member deleted.");
    alert("Team member deleted.");
    await loadTeam();
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 p-6">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-2xl bg-white p-8 text-center shadow">
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
              Team Rigo
            </p>

            <h1 className="mt-3 text-2xl font-bold text-slate-900">
              Loading team setup...
            </h1>
          </div>
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
              Team Setup
            </h1>

            <p className="mt-2 text-slate-600">
              Manage campaign users, roles, login emails, and scrutineer
              classroom assignments.
            </p>
          </div>

          <button
            onClick={loadTeam}
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

        <div className="mb-6 grid gap-4 md:grid-cols-6">
          <div className="rounded-2xl bg-white p-5 shadow">
            <p className="text-sm text-slate-500">Total</p>
            <h2 className="mt-2 text-3xl font-bold text-slate-900">
              {stats.total}
            </h2>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow">
            <p className="text-sm text-slate-500">Managers</p>
            <h2 className="mt-2 text-3xl font-bold text-blue-700">
              {stats.managers}
            </h2>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow">
            <p className="text-sm text-slate-500">Zone Leaders</p>
            <h2 className="mt-2 text-3xl font-bold text-slate-900">
              {stats.zoneLeaders}
            </h2>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow">
            <p className="text-sm text-slate-500">Campaigners</p>
            <h2 className="mt-2 text-3xl font-bold text-green-700">
              {stats.campaigners}
            </h2>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow">
            <p className="text-sm text-slate-500">Drivers</p>
            <h2 className="mt-2 text-3xl font-bold text-amber-700">
              {stats.drivers}
            </h2>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow">
            <p className="text-sm text-slate-500">Scrutineers</p>
            <h2 className="mt-2 text-3xl font-bold text-purple-700">
              {stats.scrutineers}
            </h2>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <section className="rounded-2xl bg-white p-6 shadow">
            <h2 className="text-xl font-bold text-slate-900">
              {editingId ? "Edit Team Member" : "Add Team Member"}
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              The email must match the person’s Supabase Auth login email.
            </p>

            <div className="mt-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700">
                  Full Name
                </label>

                <input
                  value={form.full_name}
                  onChange={(event) =>
                    updateForm("full_name", event.target.value)
                  }
                  className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-700"
                  placeholder="Full name"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">
                  Login Email
                </label>

                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => updateForm("email", event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-700"
                  placeholder="person@example.com"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">
                  Phone
                </label>

                <input
                  value={form.phone}
                  onChange={(event) => updateForm("phone", event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-700"
                  placeholder="Phone number"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">
                  Zone
                </label>

                <input
                  value={form.zone}
                  onChange={(event) => updateForm("zone", event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-700"
                  placeholder="Zone 1, Zone 2, All Zones..."
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">
                  Role
                </label>

                <select
                  value={form.role}
                  onChange={(event) => updateForm("role", event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-700"
                >
                  {roles.map((role) => (
                    <option key={role}>{role}</option>
                  ))}
                </select>
              </div>

              {form.role === "Scrutineer" && (
                <div className="rounded-2xl border border-purple-200 bg-purple-50 p-4">
                  <h3 className="font-bold text-purple-900">
                    Scrutineer Classroom Assignment
                  </h3>

                  <p className="mt-1 text-sm text-purple-800">
                    This controls which voters the scrutineer can see and mark
                    as voted.
                  </p>

                  <div className="mt-4 space-y-4">
                    <div>
                      <label className="text-sm font-medium text-purple-900">
                        Polling Area
                      </label>

                      <select
                        value={form.assigned_polling_area}
                        onChange={(event) =>
                          updateForm(
                            "assigned_polling_area",
                            event.target.value
                          )
                        }
                        className="mt-2 w-full rounded-xl border border-purple-200 px-4 py-3 text-slate-900 outline-none focus:border-purple-700"
                      >
                        <option value="">Select polling area</option>
                        <option value="39">39</option>
                        <option value="40">40</option>
                        <option value="41">41</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-purple-900">
                        Classroom
                      </label>

                      <input
                        value={form.assigned_classroom}
                        onChange={(event) =>
                          updateForm("assigned_classroom", event.target.value)
                        }
                        className="mt-2 w-full rounded-xl border border-purple-200 px-4 py-3 text-slate-900 outline-none focus:border-purple-700"
                        placeholder="Classroom 1"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-sm font-medium text-purple-900">
                          Surname From
                        </label>

                        <select
                          value={form.surname_from}
                          onChange={(event) =>
                            updateForm("surname_from", event.target.value)
                          }
                          className="mt-2 w-full rounded-xl border border-purple-200 px-4 py-3 text-slate-900 outline-none focus:border-purple-700"
                        >
                          {surnameLetters.map((letter) => (
                            <option key={letter} value={letter}>
                              {letter || "Select"}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-sm font-medium text-purple-900">
                          Surname To
                        </label>

                        <select
                          value={form.surname_to}
                          onChange={(event) =>
                            updateForm("surname_to", event.target.value)
                          }
                          className="mt-2 w-full rounded-xl border border-purple-200 px-4 py-3 text-slate-900 outline-none focus:border-purple-700"
                        >
                          {surnameLetters.map((letter) => (
                            <option key={letter} value={letter}>
                              {letter || "Select"}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={saveMember}
                disabled={saving}
                className="w-full rounded-xl bg-blue-700 px-4 py-3 font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-blue-300"
              >
                {saving
                  ? "Saving..."
                  : editingId
                  ? "Save Changes"
                  : "Add Team Member"}
              </button>

              {editingId && (
                <button
                  onClick={() => {
                    resetForm();
                    setMessage("");
                  }}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel Edit
                </button>
              )}
            </div>
          </section>

          <section className="rounded-2xl bg-white p-6 shadow lg:col-span-2">
            <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Team Members
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Search, edit, or delete team profiles.
                </p>
              </div>

              <div className="grid w-full gap-3 md:w-auto md:grid-cols-2">
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-700"
                  placeholder="Search team..."
                />

                <select
                  value={roleFilter}
                  onChange={(event) => setRoleFilter(event.target.value)}
                  className="rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-700"
                >
                  <option>All</option>
                  {roles.map((role) => (
                    <option key={role}>{role}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-slate-600">
                    <th className="p-3">Name</th>
                    <th className="p-3">Email</th>
                    <th className="p-3">Phone</th>
                    <th className="p-3">Zone</th>
                    <th className="p-3">Role</th>
                    <th className="p-3">Scrutineer Assignment</th>
                    <th className="p-3">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredTeam.map((member) => (
                    <tr key={member.id} className="border-b align-top">
                      <td className="p-3 font-semibold text-slate-900">
                        {member.full_name}
                      </td>

                      <td className="p-3 text-slate-700">
                        {member.email || "No email"}
                      </td>

                      <td className="p-3 text-slate-700">
                        {member.phone || "No phone"}
                      </td>

                      <td className="p-3 text-slate-700">
                        {member.zone || "No zone"}
                      </td>

                      <td className="p-3">
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                          {member.role || "No role"}
                        </span>
                      </td>

                      <td className="p-3 text-slate-700">
                        {member.role === "Scrutineer" ? (
                          <div className="space-y-1">
                            <p>
                              <span className="font-semibold">Polling:</span>{" "}
                              {member.assigned_polling_area || "Not assigned"}
                            </p>

                            <p>
                              <span className="font-semibold">Classroom:</span>{" "}
                              {member.assigned_classroom || "Not assigned"}
                            </p>

                            <p>
                              <span className="font-semibold">Surname:</span>{" "}
                              {member.surname_from || "?"} –{" "}
                              {member.surname_to || "?"}
                            </p>
                          </div>
                        ) : (
                          <span className="text-slate-400">Not applicable</span>
                        )}
                      </td>

                      <td className="p-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => startEdit(member)}
                            className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800"
                          >
                            Edit
                          </button>

                          <button
                            onClick={() => deleteMember(member)}
                            className="rounded-lg border border-red-300 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {filteredTeam.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="p-8 text-center text-slate-500"
                      >
                        No team members found.
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