"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

const REQUIRED_COLUMNS = ["voter_reg_no", "first_name", "last_name"];
const RECOMMENDED_COLUMNS = [
  "voter_reg_no",
  "reg_date",
  "first_name",
  "middle_name",
  "last_name",
  "dob",
  "age",
  "vocation",
  "street_name",
  "zone",
  "polling_area",
  "contact_no",
  "support_status",
  "campaigner_assigned",
  "pickup_needed",
  "notes",
];

const BATCH_SIZE = 400;

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
  email: string | null;
  phone: string | null;
  zone: string | null;
  role: string | null;
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

type SupportStatusOption = {
  id: string;
  value: string;
  label: string;
  description: string | null;
  color: string | null;
  display_order: number | null;
  is_active: boolean | null;
};

type ParsedRow = Record<string, string>;

type PreviewRow = {
  rowNumber: number;
  voter_reg_no: string;
  full_name: string;
  zone: string;
  polling_area: string;
  contact_no: string;
  support_status: string;
  campaigner_assigned: string;
  status: "Ready" | "Warning" | "Error";
  messages: string[];
  payload: VoterUploadPayload | null;
};

type VoterUploadPayload = {
  voter_reg_no: string;
  voter_number: string;
  reg_date: string | null;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  full_name: string;
  dob: string | null;
  age: number | null;
  vocation: string | null;
  street_name: string | null;
  address: string | null;
  zone: string | null;
  polling_area: string | null;
  polling_station: string | null;
  contact_no: string | null;
  phone: string | null;
  support_status: string;
  campaigner_id: string | null;
  pickup_needed: boolean;
  pickup_status: string;
  notes: string | null;
};

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

function cleanText(value: string | undefined | null) {
  return String(value || "").trim();
}

function normalizeName(value: string | undefined | null) {
  return cleanText(value).replace(/\s+/g, " ");
}

function parseBoolean(value: string | undefined | null) {
  const cleanValue = cleanText(value).toLowerCase();

  return ["yes", "y", "true", "1", "needed", "pickup"].includes(cleanValue);
}

function parseAge(value: string | undefined | null) {
  const cleanValue = cleanText(value);

  if (!cleanValue) return null;

  const numberValue = Number(cleanValue);

  if (!Number.isFinite(numberValue)) return null;

  return Math.max(0, Math.round(numberValue));
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value || 0);
}

function splitCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let insideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"' && insideQuotes && nextCharacter === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (character === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }

    if (character === "," && !insideQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += character;
  }

  values.push(current.trim());

  return values;
}

function parseCsv(text: string) {
  const cleanText = text.replace(/^\uFEFF/, "");
  const lines = cleanText
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    return {
      headers: [] as string[],
      rows: [] as ParsedRow[],
    };
  }

  const headers = splitCsvLine(lines[0]).map(normalizeHeader);
  const rows = lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    const row: ParsedRow = {};

    headers.forEach((header, index) => {
      row[header] = values[index] || "";
    });

    return row;
  });

  return { headers, rows };
}

function getRowValue(row: ParsedRow, ...keys: string[]) {
  for (const key of keys) {
    const value = cleanText(row[normalizeHeader(key)]);

    if (value) return value;
  }

  return "";
}

function pillClass(status: "Ready" | "Warning" | "Error") {
  if (status === "Ready") return "bg-green-100 text-green-800";
  if (status === "Warning") return "bg-amber-100 text-amber-800";

  return "bg-red-100 text-red-800";
}

function supportPillClass(value: string | null) {
  if (value === "Confirmed Supporter") return "bg-green-100 text-green-800";
  if (value === "Leaning Supporter") return "bg-purple-100 text-purple-800";
  if (value === "Undecided") return "bg-amber-100 text-amber-800";
  if (value === "Not Supporting" || value === "Do Not Contact") {
    return "bg-red-100 text-red-800";
  }

  return "bg-slate-100 text-slate-700";
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

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-xs font-black uppercase tracking-wide text-slate-500">
      {children}
    </label>
  );
}

export default function UploadPage() {
  const [profile, setProfile] = useState<TeamProfile | null>(null);
  const [campaigners, setCampaigners] = useState<Campaigner[]>([]);
  const [campaignZones, setCampaignZones] = useState<CampaignZone[]>([]);
  const [pollingAreas, setPollingAreas] = useState<PollingArea[]>([]);
  const [supportStatusOptions, setSupportStatusOptions] = useState<
    SupportStatusOption[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<ParsedRow[]>([]);
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [message, setMessage] = useState("");
  const [importing, setImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);

  const [validateAgainstSetup, setValidateAgainstSetup] = useState(true);
  const [skipWarningRows, setSkipWarningRows] = useState(false);

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

    const [campaignerResult, zoneResult, pollingResult, supportResult] =
      await Promise.all([
        supabase
          .from("campaigners")
          .select("id, full_name, email, phone, zone, role")
          .order("full_name", { ascending: true }),

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
          .from("support_status_options")
          .select("id, value, label, description, color, display_order, is_active")
          .eq("is_active", true)
          .order("display_order", { ascending: true })
          .order("label", { ascending: true }),
      ]);

    if (campaignerResult.error) {
      console.error("Campaigners error:", campaignerResult.error);
      setCampaigners([]);
    } else {
      setCampaigners(campaignerResult.data || []);
    }

    if (zoneResult.error) {
      console.error("Zones error:", zoneResult.error);
      setCampaignZones([]);
    } else {
      setCampaignZones(zoneResult.data || []);
    }

    if (pollingResult.error) {
      console.error("Polling areas error:", pollingResult.error);
      setPollingAreas([]);
    } else {
      setPollingAreas(pollingResult.data || []);
    }

    if (supportResult.error) {
      console.error("Support status options error:", supportResult.error);
      setSupportStatusOptions([]);
    } else {
      setSupportStatusOptions(supportResult.data || []);
    }

    setLoading(false);
  }

  const campaignerMap = useMemo(() => {
    const map = new Map<string, Campaigner>();

    campaigners.forEach((campaigner) => {
      map.set(campaigner.full_name.trim().toLowerCase(), campaigner);
    });

    return map;
  }, [campaigners]);

  const zoneSet = useMemo(() => {
    return new Set(campaignZones.map((zone) => zone.name.trim()).filter(Boolean));
  }, [campaignZones]);

  const pollingAreaSet = useMemo(() => {
    return new Set(pollingAreas.map((area) => area.code.trim()).filter(Boolean));
  }, [pollingAreas]);

  const supportStatusSet = useMemo(() => {
    const values = supportStatusOptions
      .filter((item) => item.is_active !== false)
      .map((item) => item.value);

    return new Set(
      values.length > 0
        ? values
        : [
            "Unknown",
            "Confirmed Supporter",
            "Leaning Supporter",
            "Undecided",
            "Not Supporting",
            "Do Not Contact",
          ]
    );
  }, [supportStatusOptions]);

  function getSupportLabel(value: string) {
    const option = supportStatusOptions.find((item) => item.value === value);
    return option?.label || value;
  }

  function buildPreviewRows(rows: ParsedRow[]) {
    const builtRows = rows.map((row, index) => buildPreviewRow(row, index + 2));
    setPreviewRows(builtRows);
  }

  function buildPreviewRow(row: ParsedRow, rowNumber: number): PreviewRow {
    const messages: string[] = [];

    const voterRegNo = getRowValue(row, "voter_reg_no", "voter_number", "reg_no");
    const regDate = getRowValue(row, "reg_date");
    const firstName = normalizeName(getRowValue(row, "first_name"));
    const middleName = normalizeName(getRowValue(row, "middle_name"));
    const lastName = normalizeName(getRowValue(row, "last_name"));
    const csvFullName = normalizeName(getRowValue(row, "full_name", "name"));
    const fullName =
      csvFullName || [firstName, middleName, lastName].filter(Boolean).join(" ");

    const dob = getRowValue(row, "dob", "date_of_birth");
    const age = parseAge(getRowValue(row, "age"));
    const vocation = getRowValue(row, "vocation", "occupation");
    const streetName = getRowValue(row, "street_name", "address", "street");
    const zone = getRowValue(row, "zone");
    const pollingArea = getRowValue(row, "polling_area", "polling_station");
    const contactNo = getRowValue(row, "contact_no", "phone", "telephone");
    const supportStatus = getRowValue(row, "support_status") || "Unknown";
    const campaignerAssigned = normalizeName(
      getRowValue(row, "campaigner_assigned", "campaigner", "assigned_to")
    );
    const pickupNeeded = parseBoolean(getRowValue(row, "pickup_needed", "pickup"));
    const notes = getRowValue(row, "notes", "note");

    let campaignerId: string | null = null;

    if (!voterRegNo) messages.push("Missing voter_reg_no.");
    if (!firstName && !csvFullName) messages.push("Missing first_name or full_name.");
    if (!lastName && !csvFullName) messages.push("Missing last_name or full_name.");

    if (validateAgainstSetup) {
      if (zone && !zoneSet.has(zone)) {
        messages.push(`Zone "${zone}" is not in Campaign Setup.`);
      }

      if (pollingArea && !pollingAreaSet.has(pollingArea)) {
        messages.push(`Polling area "${pollingArea}" is not in Campaign Setup.`);
      }

      if (supportStatus && !supportStatusSet.has(supportStatus)) {
        messages.push(`Support status "${supportStatus}" is not active in Campaign Setup.`);
      }
    }

    if (campaignerAssigned) {
      const campaigner = campaignerMap.get(campaignerAssigned.toLowerCase());

      if (campaigner) {
        campaignerId = campaigner.id;
      } else {
        messages.push(`Campaigner "${campaignerAssigned}" was not found.`);
      }
    }

    const hasRequiredError =
      !voterRegNo || (!firstName && !csvFullName) || (!lastName && !csvFullName);
    const hasSetupError =
      validateAgainstSetup &&
      ((zone && !zoneSet.has(zone)) ||
        (pollingArea && !pollingAreaSet.has(pollingArea)) ||
        (supportStatus && !supportStatusSet.has(supportStatus)));

    const status: PreviewRow["status"] = hasRequiredError || hasSetupError
      ? "Error"
      : messages.length > 0
      ? "Warning"
      : "Ready";

    const payload: VoterUploadPayload | null =
      status === "Error"
        ? null
        : {
            voter_reg_no: voterRegNo,
            voter_number: voterRegNo,
            reg_date: regDate || null,
            first_name: firstName || null,
            middle_name: middleName || null,
            last_name: lastName || null,
            full_name: fullName || "Unnamed voter",
            dob: dob || null,
            age,
            vocation: vocation || null,
            street_name: streetName || null,
            address: streetName || null,
            zone: zone || null,
            polling_area: pollingArea || null,
            polling_station: pollingArea || null,
            contact_no: contactNo || null,
            phone: contactNo || null,
            support_status: supportStatus,
            campaigner_id: campaignerId,
            pickup_needed: pickupNeeded,
            pickup_status: pickupNeeded ? "Not Contacted" : "No Pickup Needed",
            notes: notes || null,
          };

    return {
      rowNumber,
      voter_reg_no: voterRegNo,
      full_name: fullName || "Unnamed voter",
      zone,
      polling_area: pollingArea,
      contact_no: contactNo,
      support_status: supportStatus,
      campaigner_assigned: campaignerAssigned,
      status,
      messages,
      payload,
    };
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    setMessage("");
    setImportedCount(0);

    if (!file) return;

    setFileName(file.name);

    const text = await file.text();
    const parsed = parseCsv(text);

    setHeaders(parsed.headers);
    setRawRows(parsed.rows);
    buildPreviewRows(parsed.rows);
  }

  function refreshValidation() {
    buildPreviewRows(rawRows);
    setMessage("Validation refreshed.");
  }

  function downloadTemplate() {
    const csv = `${RECOMMENDED_COLUMNS.join(",")}\n`;

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "team-rigo-voter-upload-template.csv";
    link.click();

    URL.revokeObjectURL(url);
  }

  async function importReadyRows() {
    if (!canAccess) return;

    const errorCount = previewRows.filter((row) => row.status === "Error").length;

    if (errorCount > 0) {
      setMessage(`Fix ${errorCount} error row(s) before importing.`);
      return;
    }

    const importableRows = previewRows.filter((row) => {
      if (!row.payload) return false;
      if (skipWarningRows && row.status === "Warning") return false;
      return true;
    });

    if (importableRows.length === 0) {
      setMessage("There are no ready rows to import.");
      return;
    }

    const confirmed = confirm(`Import ${importableRows.length} voter record(s)?`);

    if (!confirmed) return;

    setImporting(true);
    setMessage("");
    setImportedCount(0);

    const payloads = importableRows.map((row) => row.payload!) as VoterUploadPayload[];

    for (let index = 0; index < payloads.length; index += BATCH_SIZE) {
      const batch = payloads.slice(index, index + BATCH_SIZE);

      const { error } = await supabase.from("voters").upsert(batch, {
        onConflict: "voter_reg_no",
      });

      if (error) {
        console.error("Upload import error:", error);
        setMessage(error.message || "Import failed.");
        setImporting(false);
        return;
      }

      setImportedCount((current) => current + batch.length);
    }

    setMessage(`Import complete. ${payloads.length} voter record(s) saved.`);
    setImporting(false);
  }

  const stats = useMemo(() => {
    const ready = previewRows.filter((row) => row.status === "Ready").length;
    const warning = previewRows.filter((row) => row.status === "Warning").length;
    const error = previewRows.filter((row) => row.status === "Error").length;
    const importable = previewRows.filter((row) => {
      if (!row.payload) return false;
      if (skipWarningRows && row.status === "Warning") return false;
      return true;
    }).length;

    return {
      total: previewRows.length,
      ready,
      warning,
      error,
      importable,
    };
  }, [previewRows, skipWarningRows]);

  const missingColumns = useMemo(() => {
    return REQUIRED_COLUMNS.filter((column) => !headers.includes(column));
  }, [headers]);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 p-4 sm:p-6">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-3xl bg-white p-6 text-center shadow-sm">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-sky-700" />
            <h1 className="mt-5 text-xl font-black text-slate-900">
              Loading upload...
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
            Uploading voter records is restricted to the Campaign Manager.
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
                Upload Voters
              </h1>

              <p className="mt-2 max-w-3xl text-sm text-slate-500 sm:text-base">
                Import voter records from CSV. The upload validates zones,
                polling areas and support fields against Campaign Setup.
              </p>
            </div>

            <button
              onClick={downloadTemplate}
              className="w-full rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-black text-slate-800 hover:bg-slate-50 sm:w-auto"
            >
              Download Template
            </button>
          </div>

          {message && (
            <div className="mt-4 rounded-2xl border border-sky-100 bg-sky-50 p-4 text-sm font-bold text-sky-900">
              {message}
            </div>
          )}

          {missingColumns.length > 0 && headers.length > 0 && (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">
              Missing required column(s): {missingColumns.join(", ")}
            </div>
          )}

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            <SummaryCard
              label="Rows"
              value={formatNumber(stats.total)}
              detail={fileName || "No file selected"}
            />
            <SummaryCard label="Ready" value={formatNumber(stats.ready)} tone="green" />
            <SummaryCard
              label="Warnings"
              value={formatNumber(stats.warning)}
              tone="amber"
            />
            <SummaryCard label="Errors" value={formatNumber(stats.error)} tone="red" />
            <SummaryCard
              label="Importable"
              value={formatNumber(stats.importable)}
              tone="blue"
            />
            <SummaryCard
              label="Saved"
              value={formatNumber(importedCount)}
              detail={importing ? "Importing..." : "Current import"}
              tone="purple"
            />
          </div>
        </div>
      </section>

      <section className="px-4 py-5 sm:px-6 sm:py-8">
        <div className="mx-auto max-w-7xl">
          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr] lg:items-center">
              <div>
                <FieldLabel>CSV File</FieldLabel>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileChange}
                  className="mt-2 block w-full rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-sm font-bold text-slate-700 file:mr-4 file:rounded-xl file:border-0 file:bg-sky-700 file:px-4 file:py-3 file:font-black file:text-white"
                />
                <p className="mt-3 text-xs font-semibold text-slate-500">
                  Required: {REQUIRED_COLUMNS.join(", ")}. Recommended:{" "}
                  {RECOMMENDED_COLUMNS.join(", ")}.
                </p>
              </div>

              <div className="rounded-3xl bg-slate-50 p-4">
                <h2 className="text-lg font-black text-slate-950">
                  Import Controls
                </h2>

                <label className="mt-4 flex items-start gap-3 text-sm font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={validateAgainstSetup}
                    onChange={(event) => {
                      setValidateAgainstSetup(event.target.checked);
                      setTimeout(() => buildPreviewRows(rawRows), 0);
                    }}
                    className="mt-1 h-5 w-5"
                  />
                  Validate zones, polling areas and support fields against
                  Campaign Setup.
                </label>

                <label className="mt-3 flex items-start gap-3 text-sm font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={skipWarningRows}
                    onChange={(event) => setSkipWarningRows(event.target.checked)}
                    className="mt-1 h-5 w-5"
                  />
                  Skip warning rows during import.
                </label>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <button
                    onClick={refreshValidation}
                    disabled={rawRows.length === 0}
                    className="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Refresh Validation
                  </button>

                  <button
                    onClick={importReadyRows}
                    disabled={
                      importing ||
                      stats.importable === 0 ||
                      stats.error > 0 ||
                      missingColumns.length > 0
                    }
                    className="rounded-2xl bg-sky-700 px-4 py-3 text-sm font-black text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-sky-300"
                  >
                    {importing ? "Importing..." : "Import Ready Rows"}
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section className="mt-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-black text-slate-950">
                  Upload Preview
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Review issues before saving records.
                </p>
              </div>

              {fileName && (
                <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">
                  {fileName}
                </span>
              )}
            </div>

            <div className="mt-4 grid gap-3 lg:hidden">
              {previewRows.slice(0, 100).map((row) => (
                <article
                  key={`${row.rowNumber}-${row.voter_reg_no}`}
                  className="rounded-3xl border border-slate-200 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                        Row {row.rowNumber} · {row.voter_reg_no || "No reg no."}
                      </p>
                      <h3 className="mt-1 break-words text-lg font-black text-slate-950">
                        {row.full_name}
                      </h3>
                      <p className="mt-1 text-sm text-slate-500">
                        {row.zone || "No zone"} ·{" "}
                        {row.polling_area || "No polling"}
                      </p>
                    </div>

                    <span
                      className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${pillClass(
                        row.status
                      )}`}
                    >
                      {row.status}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-black ${supportPillClass(
                        row.support_status
                      )}`}
                    >
                      {getSupportLabel(row.support_status)}
                    </span>

                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">
                      {row.campaigner_assigned || "No campaigner"}
                    </span>
                  </div>

                  {row.messages.length > 0 && (
                    <div className="mt-3 rounded-2xl bg-slate-50 p-3 text-xs font-semibold text-slate-600">
                      {row.messages.join(" ")}
                    </div>
                  )}
                </article>
              ))}

              {previewRows.length > 100 && (
                <div className="rounded-3xl bg-slate-50 p-4 text-center text-sm font-bold text-slate-500">
                  Showing first 100 preview rows on mobile.
                </div>
              )}

              {previewRows.length === 0 && (
                <div className="rounded-3xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                  Select a CSV file to preview records.
                </div>
              )}
            </div>

            <div className="mt-4 hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[1100px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-3 pr-3 font-black">Row</th>
                    <th className="px-3 py-3 font-black">Status</th>
                    <th className="px-3 py-3 font-black">Reg No.</th>
                    <th className="px-3 py-3 font-black">Name</th>
                    <th className="px-3 py-3 font-black">Zone</th>
                    <th className="px-3 py-3 font-black">Polling</th>
                    <th className="px-3 py-3 font-black">Support</th>
                    <th className="px-3 py-3 font-black">Campaigner</th>
                    <th className="px-3 py-3 font-black">Messages</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {previewRows.slice(0, 500).map((row) => (
                    <tr key={`${row.rowNumber}-${row.voter_reg_no}`} className="align-top">
                      <td className="py-3 pr-3 font-black text-slate-900">
                        {row.rowNumber}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-black ${pillClass(
                            row.status
                          )}`}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="px-3 py-3 font-bold text-slate-700">
                        {row.voter_reg_no || "—"}
                      </td>
                      <td className="px-3 py-3 font-black text-slate-950">
                        {row.full_name}
                      </td>
                      <td className="px-3 py-3 text-slate-700">
                        {row.zone || "—"}
                      </td>
                      <td className="px-3 py-3 text-slate-700">
                        {row.polling_area || "—"}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-black ${supportPillClass(
                            row.support_status
                          )}`}
                        >
                          {getSupportLabel(row.support_status)}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-slate-700">
                        {row.campaigner_assigned || "—"}
                      </td>
                      <td className="px-3 py-3 text-xs font-semibold text-slate-500">
                        {row.messages.length > 0 ? row.messages.join(" ") : "—"}
                      </td>
                    </tr>
                  ))}

                  {previewRows.length === 0 && (
                    <tr>
                      <td colSpan={9} className="p-10 text-center text-slate-500">
                        Select a CSV file to preview records.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {previewRows.length > 500 && (
                <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-center text-sm font-bold text-slate-500">
                  Showing first 500 preview rows on desktop. All valid rows will
                  still import.
                </div>
              )}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
