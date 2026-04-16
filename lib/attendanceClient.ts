import type { PunchRecord } from "./types";
import { DEFAULT_EMPLOYEE_NAMES } from "./types";
import { EMPLOYEES_CHANGED_EVENT } from "./employees";

function extraHeaders(): HeadersInit {
  const key =
    typeof process !== "undefined"
      ? process.env.NEXT_PUBLIC_ATTENDANCE_API_KEY
      : undefined;
  if (!key) return {};
  return { "x-attendance-api-key": key };
}

async function parseError(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: string };
    return j.error ?? res.statusText;
  } catch {
    return await res.text();
  }
}

export async function fetchPunchRecords(): Promise<PunchRecord[]> {
  const res = await fetch("/api/punches", {
    cache: "no-store",
    headers: { ...extraHeaders() },
  });
  if (!res.ok) throw new Error(await parseError(res));
  const data = (await res.json()) as { records: PunchRecord[] };
  return data.records ?? [];
}

export async function addPunchRecord(record: PunchRecord): Promise<void> {
  const res = await fetch("/api/punches", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...extraHeaders() },
    body: JSON.stringify(record),
  });
  if (!res.ok) throw new Error(await parseError(res));
}

export async function updatePunchRecord(record: PunchRecord): Promise<void> {
  const res = await fetch("/api/punches", {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...extraHeaders() },
    body: JSON.stringify(record),
  });
  if (!res.ok) throw new Error(await parseError(res));
}

export async function deletePunchRecord(id: string): Promise<void> {
  const res = await fetch(`/api/punches?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { ...extraHeaders() },
  });
  if (!res.ok) throw new Error(await parseError(res));
}

export async function fetchEmployees(): Promise<string[]> {
  const res = await fetch("/api/employees", {
    cache: "no-store",
    headers: { ...extraHeaders() },
  });
  if (!res.ok) throw new Error(await parseError(res));
  const data = (await res.json()) as { names: string[] };
  const names = data.names ?? [];
  if (names.length === 0) return [...DEFAULT_EMPLOYEE_NAMES];
  return names;
}

export async function saveEmployeesMaster(
  names: string[],
  prevNames?: string[]
): Promise<void> {
  const res = await fetch("/api/employees", {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...extraHeaders() },
    body: JSON.stringify({ names, prevNames }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(EMPLOYEES_CHANGED_EVENT));
  }
}
