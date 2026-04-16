// 初回・API が空のときのデフォルト氏名（実データは Supabase `fit_attendance_employees`）
/** 勤怠打刻画面の氏名順（Supabase シード・README と一致。修理アプリの作業者マスタとは別） */
export const DEFAULT_EMPLOYEE_NAMES = [
  "鈴木",
  "大竹",
  "森田",
  "深田",
  "石橋",
  "豊島",
] as const;

export type PunchType = "clock_in" | "clock_out" | "go_out" | "go_back";

export type PunchRecord = {
  id: string;
  employee: string;
  type: PunchType;
  timestamp: string; // ISO string
  date: string; // YYYY-MM-DD for grouping
};

/** 旧 localStorage の打刻キー（初回移行スクリプトのみ使用） */
export const STORAGE_KEY = "fit-attendance-records";
