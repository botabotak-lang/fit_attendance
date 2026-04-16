import { STORAGE_KEY } from "./types";
import type { PunchRecord } from "./types";
import { EMPLOYEES_STORAGE_KEY } from "./employees";

const ATTEMPTED = "fit-attendance-migrate-attempted";
const DONE = "fit-attendance-migrate-done";

function extraHeaders(): HeadersInit {
  const key = process.env.NEXT_PUBLIC_ATTENDANCE_API_KEY;
  if (!key) return {};
  return { "x-attendance-api-key": key };
}

/** localStorage にだけ残っている旧データを1回だけ API へ送る（失敗しても無限ループしない） */
export async function tryMigrateFromLocalStorageOnce(): Promise<void> {
  if (typeof window === "undefined") return;
  if (sessionStorage.getItem(DONE) === "1") return;
  if (sessionStorage.getItem(ATTEMPTED) === "1") return;

  const rawP = localStorage.getItem(STORAGE_KEY);
  const rawE = localStorage.getItem(EMPLOYEES_STORAGE_KEY);
  if (!rawP && !rawE) {
    sessionStorage.setItem(DONE, "1");
    return;
  }

  sessionStorage.setItem(ATTEMPTED, "1");

  let punches: PunchRecord[] = [];
  let employeeNames: string[] | undefined;
  try {
    if (rawP) punches = JSON.parse(rawP) as PunchRecord[];
  } catch {
    punches = [];
  }
  try {
    if (rawE) {
      const arr = JSON.parse(rawE) as unknown;
      if (Array.isArray(arr)) {
        employeeNames = arr
          .filter((x): x is string => typeof x === "string")
          .map((s) => s.trim())
          .filter(Boolean);
      }
    }
  } catch {
    employeeNames = undefined;
  }

  try {
    const res = await fetch("/api/migrate", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...extraHeaders() },
      body: JSON.stringify({ punches, employeeNames }),
    });
    if (!res.ok) return;
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(EMPLOYEES_STORAGE_KEY);
    sessionStorage.setItem(DONE, "1");
  } catch {
    /* Supabase 未設定などはスキップ */
  }
}
