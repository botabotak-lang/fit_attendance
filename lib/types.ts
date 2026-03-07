// 〇〇1, 〇〇2 は名前聞き忘れ。後で要更新
export const EMPLOYEES = ["鈴木", "大竹", "石橋", "〇〇1", "〇〇2"] as const;
export type Employee = (typeof EMPLOYEES)[number];

export type PunchType = "clock_in" | "clock_out" | "go_out" | "go_back";

export type PunchRecord = {
  id: string;
  employee: Employee;
  type: PunchType;
  timestamp: string; // ISO string
  date: string; // YYYY-MM-DD for grouping
};

export const STORAGE_KEY = "fit-attendance-records";
