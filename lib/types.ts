// 初回・リセット時のデフォルト（実際の一覧は localStorage `fit-attendance-employee-list`）
export const DEFAULT_EMPLOYEE_NAMES = ["鈴木", "大竹", "石橋", "〇〇1", "〇〇2"] as const;

export type PunchType = "clock_in" | "clock_out" | "go_out" | "go_back";

export type PunchRecord = {
  id: string;
  employee: string;
  type: PunchType;
  timestamp: string; // ISO string
  date: string; // YYYY-MM-DD for grouping
};

export const STORAGE_KEY = "fit-attendance-records";
