import { DEFAULT_EMPLOYEE_NAMES, PunchRecord, STORAGE_KEY } from "./types";

export const EMPLOYEES_STORAGE_KEY = "fit-attendance-employee-list";

export const EMPLOYEES_CHANGED_EVENT = "fit-attendance-employees-changed";

function readRecords(): PunchRecord[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

function writeRecords(records: PunchRecord[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

/** 打刻画面・月次で使う氏名一覧（localStorage なければデフォルト） */
export function getEmployees(): string[] {
  if (typeof window === "undefined") return [...DEFAULT_EMPLOYEE_NAMES];
  const raw = localStorage.getItem(EMPLOYEES_STORAGE_KEY);
  if (!raw) return [...DEFAULT_EMPLOYEE_NAMES];
  try {
    const arr = JSON.parse(raw) as unknown;
    if (Array.isArray(arr) && arr.length > 0) {
      const names = arr
        .filter((x): x is string => typeof x === "string")
        .map((s) => s.trim())
        .filter(Boolean);
      if (names.length > 0) return [...new Set(names)];
    }
  } catch {
    /* fallthrough */
  }
  return [...DEFAULT_EMPLOYEE_NAMES];
}

export function saveEmployees(names: string[]): void {
  const cleaned = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  localStorage.setItem(EMPLOYEES_STORAGE_KEY, JSON.stringify(cleaned));
  window.dispatchEvent(new Event(EMPLOYEES_CHANGED_EVENT));
}

/** 打刻データの氏名を一括置換（名前変更時） */
export function migratePunchEmployeeName(from: string, to: string): void {
  if (!from || !to || from === to) return;
  const records = readRecords();
  let changed = false;
  const next = records.map((r) => {
    if (r.employee === from) {
      changed = true;
      return { ...r, employee: to };
    }
    return r;
  });
  if (changed) writeRecords(next);
}

/**
 * マスタの並びを維持したまま、インデックスごとの氏名変更を打刻に反映。
 * 入れ替え（A→B と B→A）も一時キーで安全に処理。
 */
export function applyEmployeeListRenames(prev: string[], next: string[]): void {
  if (prev.length !== next.length) return;
  const steps: { from: string; to: string }[] = [];
  for (let i = 0; i < prev.length; i++) {
    const a = prev[i]?.trim();
    const b = next[i]?.trim();
    if (a && b && a !== b) steps.push({ from: a, to: b });
  }
  if (steps.length === 0) return;
  const TEMP = "__fit_rn_";
  steps.forEach((s, i) => migratePunchEmployeeName(s.from, `${TEMP}${i}`));
  steps.forEach((s, i) => migratePunchEmployeeName(`${TEMP}${i}`, s.to));
}
