export const EMPLOYEES = ["大竹", "豊島", "鈴木", "内田", "新人"] as const;
export type Employee = (typeof EMPLOYEES)[number];

export type PunchType = "clock_in" | "clock_out";

export type PunchRecord = {
  id: string;
  employee: Employee;
  type: PunchType;
  timestamp: string; // ISO string
  date: string; // YYYY-MM-DD for grouping
};

export const STORAGE_KEY = "fit-attendance-records";
