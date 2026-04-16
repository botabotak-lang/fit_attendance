import type { SupabaseClient } from "@supabase/supabase-js";
import type { PunchRecord, PunchType } from "./types";

const PUNCHES = "fit_attendance_punches";
const EMPLOYEES = "fit_attendance_employees";

function isPunchType(v: string): v is PunchType {
  return (
    v === "clock_in" ||
    v === "clock_out" ||
    v === "go_out" ||
    v === "go_back"
  );
}

export function rowToPunch(row: {
  id: string;
  employee: string;
  punch_type: string;
  timestamp_text: string;
  punch_date: string;
}): PunchRecord {
  const type = isPunchType(row.punch_type) ? row.punch_type : "clock_in";
  const dateStr =
    typeof row.punch_date === "string"
      ? row.punch_date.slice(0, 10)
      : String(row.punch_date).slice(0, 10);
  return {
    id: row.id,
    employee: row.employee,
    type,
    timestamp: row.timestamp_text,
    date: dateStr,
  };
}

function punchToRow(r: PunchRecord) {
  return {
    id: r.id,
    employee: r.employee,
    punch_type: r.type,
    timestamp_text: r.timestamp,
    punch_date: r.date,
  };
}

export async function listPunches(
  supabase: SupabaseClient
): Promise<PunchRecord[]> {
  const { data, error } = await supabase
    .from(PUNCHES)
    .select("id, employee, punch_type, timestamp_text, punch_date")
    .order("timestamp_text", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) =>
    rowToPunch(row as Parameters<typeof rowToPunch>[0])
  );
}

export async function insertPunch(
  supabase: SupabaseClient,
  r: PunchRecord
): Promise<void> {
  const { error } = await supabase.from(PUNCHES).insert(punchToRow(r));
  if (error) throw error;
}

export async function upsertPunches(
  supabase: SupabaseClient,
  records: PunchRecord[]
): Promise<void> {
  if (records.length === 0) return;
  const rows = records.map(punchToRow);
  const { error } = await supabase.from(PUNCHES).upsert(rows, {
    onConflict: "id",
  });
  if (error) throw error;
}

export async function updatePunch(
  supabase: SupabaseClient,
  r: PunchRecord
): Promise<void> {
  const { error } = await supabase
    .from(PUNCHES)
    .update(punchToRow(r))
    .eq("id", r.id);
  if (error) throw error;
}

export async function deletePunch(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  const { error } = await supabase.from(PUNCHES).delete().eq("id", id);
  if (error) throw error;
}

export async function listEmployeeNames(
  supabase: SupabaseClient
): Promise<string[]> {
  const { data, error } = await supabase
    .from(EMPLOYEES)
    .select("name")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => r.name as string);
}

export async function replaceEmployees(
  supabase: SupabaseClient,
  names: string[]
): Promise<void> {
  const { error: delErr } = await supabase
    .from(EMPLOYEES)
    .delete()
    .gte("sort_order", 0);
  if (delErr) throw delErr;

  const rows = names.map((name, i) => ({
    name,
    sort_order: i,
  }));
  if (rows.length === 0) return;
  const { error: insErr } = await supabase.from(EMPLOYEES).insert(rows);
  if (insErr) throw insErr;
}

export async function applyEmployeeRenamesOnPunches(
  supabase: SupabaseClient,
  prev: string[],
  next: string[]
): Promise<void> {
  if (prev.length !== next.length) return;
  const steps: { from: string; to: string }[] = [];
  for (let i = 0; i < prev.length; i++) {
    const a = prev[i]?.trim();
    const b = next[i]?.trim();
    if (a && b && a !== b) steps.push({ from: a, to: b });
  }
  if (steps.length === 0) return;
  const TEMP = "__fit_rn_";
  for (let i = 0; i < steps.length; i++) {
    const { error } = await supabase
      .from(PUNCHES)
      .update({ employee: `${TEMP}${i}` })
      .eq("employee", steps[i].from);
    if (error) throw error;
  }
  for (let i = 0; i < steps.length; i++) {
    const { error } = await supabase
      .from(PUNCHES)
      .update({ employee: steps[i].to })
      .eq("employee", `${TEMP}${i}`);
    if (error) throw error;
  }
}
