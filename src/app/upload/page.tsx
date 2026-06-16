"use client";

import { useState } from "react";
import Papa from "papaparse";
import { supabase } from "@/lib/supabase";

type CsvVoterRow = {
  voter_reg_no?: string;
  reg_date?: string;
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  dob?: string;
  age?: string;
  vocation?: string;
  street_name?: string;
  zone?: string;
  polling_area?: string;
  contact_no?: string;
  support_status?: string;
  campaigner_assigned?: string;
  pickup_needed?: string;
  notes?: string;
};

type PreviewRow = {
  voter_reg_no: string | null;
  reg_date: string | null;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  dob: string | null;
  age: number | null;
  vocation: string | null;
  street_name: string | null;
  zone: string | null;
  polling_area: string | null;
  contact_no: string | null;
  support_status: string;
  campaigner_assigned: string | null;
  pickup_needed: boolean;
  notes: string | null;
  full_name: string;
};

type Campaigner = {
  id: string;
  full_name: string;
};

export default function UploadVotersPage() {
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

  function normalizeHeader(header: string) {
    return header.trim().toLowerCase().replace(/\s+/g, "_").replace(/\./g, "");
  }

  function yesNoToBoolean(value?: string) {
    if (!value) return false;

    const cleanValue = value.trim().toLowerCase();

    return (
      cleanValue === "yes" ||
      cleanValue === "y" ||
      cleanValue === "true" ||
      cleanValue === "1"
    );
  }

  function parseAge(value?: string) {
    if (!value) return null;

    const parsed = Number(value);

    if (Number.isNaN(parsed)) return null;

    return parsed;
  }

  function buildFullName(firstName: string, middleName: string | null, lastName: string) {
    return [firstName, middleName, lastName]
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) return;

    setMessage("");

    Papa.parse<CsvVoterRow>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: normalizeHeader,
      complete: function (results) {
        const cleanRows: PreviewRow[] = results.data
          .map((row) => {
            const firstName = row.first_name?.trim() || "";
            const middleName = row.middle_name?.trim() || null;
            const lastName = row.last_name?.trim() || "";
            const fullName = buildFullName(firstName, middleName, lastName);

            return {
              voter_reg_no: row.voter_reg_no?.trim() || null,
              reg_date: row.reg_date?.trim() || null,
              first_name: firstName,
              middle_name: middleName,
              last_name: lastName,
              dob: row.dob?.trim() || null,
              age: parseAge(row.age),
              vocation: row.vocation?.trim() || null,
              street_name: row.street_name?.trim() || null,
              zone: row.zone?.trim() || null,
              polling_area: row.polling_area?.trim() || null,
              contact_no: row.contact_no?.trim() || null,
              support_status: row.support_status?.trim() || "Unknown",
              campaigner_assigned: row.campaigner_assigned?.trim() || null,
              pickup_needed: yesNoToBoolean(row.pickup_needed),
              notes: row.notes?.trim() || null,
              full_name: fullName,
            };
          })
          .filter((row) => row.first_name.length > 0 || row.last_name.length > 0);

        setRows(cleanRows);

        if (cleanRows.length === 0) {
          setMessage(
            "No valid voter rows found. Make sure first_name or last_name is included."
          );
        } else {
          setMessage(`${cleanRows.length} voters ready for upload.`);
        }
      },
      error: function (error) {
        console.error(error);
        setMessage("Error reading CSV file.");
      },
    });
  }

  async function uploadRows() {
    if (rows.length === 0) {
      alert("Please select a CSV file first.");
      return;
    }

    const confirmed = confirm(
      `Upload ${rows.length} voters to the Team Rigo database?`
    );

    if (!confirmed) return;

    setUploading(true);
    setMessage("Uploading voters...");

    const { data: campaigners, error: campaignerError } = await supabase
      .from("campaigners")
      .select("id, full_name");

    if (campaignerError) {
      console.error(campaignerError);
      alert("Error loading campaigners.");
      setUploading(false);
      return;
    }

    const campaignerList = (campaigners || []) as Campaigner[];

    const votersToInsert = rows.map((row) => {
      const matchedCampaigner = campaignerList.find(
        (campaigner) =>
          campaigner.full_name.toLowerCase().trim() ===
          row.campaigner_assigned?.toLowerCase().trim()
      );

      return {
        voter_reg_no: row.voter_reg_no,
        voter_number: row.voter_reg_no,
        reg_date: row.reg_date,
        first_name: row.first_name,
        middle_name: row.middle_name,
        last_name: row.last_name,
        full_name: row.full_name,
        dob: row.dob,
        age: row.age,
        vocation: row.vocation,
        street_name: row.street_name,
        address: row.street_name,
        zone: row.zone,
        polling_area: row.polling_area,
        polling_station: row.polling_area,
        contact_no: row.contact_no,
        phone: row.contact_no,
        support_status: row.support_status,
        campaigner_id: matchedCampaigner?.id || null,
        pickup_needed: row.pickup_needed,
        pickup_status: row.pickup_needed ? "Not Contacted" : "No Pickup Needed",
        voted: false,
        notes: row.notes,
      };
    });

    const { error } = await supabase.from("voters").insert(votersToInsert);

    if (error) {
      console.error(error);
      alert(
        "Error uploading voters. Check if any voter_reg_no already exists or if a column is missing."
      );
      setMessage("Upload failed. Check the console for details.");
      setUploading(false);
      return;
    }

    setMessage(`${rows.length} voters uploaded successfully.`);
    setRows([]);
    setUploading(false);
  }

  function downloadTemplate() {
    const csvTemplate =
      "voter_reg_no,reg_date,first_name,middle_name,last_name,dob,age,vocation,street_name,zone,polling_area,contact_no,support_status,campaigner_assigned,pickup_needed,notes\n" +
      "12345,2024-01-15,Maria,Elena,Lopez,1985-05-20,39,Teacher,Altamira Road,Zone 1,39,6001001,Confirmed Supporter,John Castillo,yes,Needs pickup early\n" +
      "12346,2024-01-15,Carlos,,Ramirez,1978-09-10,46,Mechanic,Finca Solana,Zone 2,40,6001002,Leaning Supporter,Ana Perez,no,\n";

    const blob = new Blob([csvTemplate], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "team-rigo-voter-upload-template.csv";
    link.click();

    URL.revokeObjectURL(url);
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
              Batch Upload Voters
            </h1>

            <p className="mt-2 text-slate-600">
              Upload voters from the voter register CSV into the Team Rigo database.
            </p>
          </div>

          <a
            href="/dashboard"
            className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow hover:bg-slate-50"
          >
            Back to Dashboard
          </a>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <section className="rounded-2xl bg-white p-6 shadow">
            <h2 className="text-xl font-bold text-slate-900">
              Upload CSV File
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Your CSV should follow the voter register format. First name or
              last name is required.
            </p>

            <div className="mt-5 space-y-4">
              <button
                onClick={downloadTemplate}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 font-semibold text-slate-700 hover:bg-slate-50"
              >
                Download CSV Template
              </button>

              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-700"
              />

              <button
                onClick={uploadRows}
                disabled={uploading || rows.length === 0}
                className="w-full rounded-xl bg-blue-700 px-4 py-3 font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-blue-300"
              >
                {uploading ? "Uploading..." : "Upload Voters"}
              </button>

              {message && (
                <div className="rounded-xl bg-slate-50 p-4 text-sm font-medium text-slate-700">
                  {message}
                </div>
              )}
            </div>

            <div className="mt-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
              Upload campaigners first if you want the system to automatically
              assign voters by campaigner name.
            </div>

            <div className="mt-4 rounded-xl bg-blue-50 p-4 text-sm text-blue-900">
              CSV columns: voter_reg_no, reg_date, first_name, middle_name,
              last_name, dob, age, vocation, street_name, zone, polling_area,
              contact_no, support_status, campaigner_assigned, pickup_needed,
              notes.
            </div>
          </section>

          <section className="rounded-2xl bg-white p-6 shadow lg:col-span-2">
            <h2 className="text-xl font-bold text-slate-900">Preview</h2>

            <p className="mt-1 text-sm text-slate-500">
              Review the voter records before uploading.
            </p>

            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[1300px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-slate-600">
                    <th className="p-3">Reg No.</th>
                    <th className="p-3">Reg Date</th>
                    <th className="p-3">Name</th>
                    <th className="p-3">DOB</th>
                    <th className="p-3">Age</th>
                    <th className="p-3">Vocation</th>
                    <th className="p-3">Street</th>
                    <th className="p-3">Zone</th>
                    <th className="p-3">Polling Area</th>
                    <th className="p-3">Contact</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Campaigner</th>
                    <th className="p-3">Pickup</th>
                  </tr>
                </thead>

                <tbody>
                  {rows.map((row, index) => (
                    <tr key={index} className="border-b">
                      <td className="p-3 text-slate-700">
                        {row.voter_reg_no || "No reg no."}
                      </td>

                      <td className="p-3 text-slate-700">
                        {row.reg_date || "No date"}
                      </td>

                      <td className="p-3 font-semibold text-slate-900">
                        {row.full_name}
                      </td>

                      <td className="p-3 text-slate-700">
                        {row.dob || "No DOB"}
                      </td>

                      <td className="p-3 text-slate-700">
                        {row.age ?? "No age"}
                      </td>

                      <td className="p-3 text-slate-700">
                        {row.vocation || "Not listed"}
                      </td>

                      <td className="p-3 text-slate-700">
                        {row.street_name || "No street"}
                      </td>

                      <td className="p-3 text-slate-700">
                        {row.zone || "No zone"}
                      </td>

                      <td className="p-3 text-slate-700">
                        {row.polling_area || "Not listed"}
                      </td>

                      <td className="p-3 text-slate-700">
                        {row.contact_no || "No contact"}
                      </td>

                      <td className="p-3 text-slate-700">
                        {row.support_status}
                      </td>

                      <td className="p-3 text-slate-700">
                        {row.campaigner_assigned || "Not assigned"}
                      </td>

                      <td className="p-3">
                        {row.pickup_needed ? (
                          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                            Yes
                          </span>
                        ) : (
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                            No
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}

                  {rows.length === 0 && (
                    <tr>
                      <td
                        colSpan={13}
                        className="p-8 text-center text-slate-500"
                      >
                        No CSV uploaded yet.
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