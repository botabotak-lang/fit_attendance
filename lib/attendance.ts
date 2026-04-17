import { PunchRecord } from "./types";

export function calcWorkHours(inTime: string, outTime: string): number {
  const [inH, inM] = inTime.split(":").map(Number);
  const [outH, outM] = outTime.split(":").map(Number);
  return (outH * 60 + outM - (inH * 60 + inM)) / 60;
}

export type MonthlyDetailRow = {
  日付: string;
  氏名: string;
  出勤: string;
  退勤: string;
  外出: string;
  戻り: string;
  勤務時間: string;
};

export function getMonthlyDetail(
  records: PunchRecord[],
  monthStart: string,
  monthEnd: string,
  employeeList: string[]
): MonthlyDetailRow[] {
  const filtered = records
    .filter((r) => r.date >= monthStart && r.date <= monthEnd)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const byDateEmp: Record<string, Record<string, PunchRecord[]>> = {};
  filtered.forEach((r) => {
    if (!byDateEmp[r.date]) byDateEmp[r.date] = {};
    if (!byDateEmp[r.date][r.employee]) byDateEmp[r.date][r.employee] = [];
    byDateEmp[r.date][r.employee].push(r);
  });

  const allDates: string[] = [];
  const start = new Date(monthStart + "T00:00:00");
  const end = new Date(monthEnd + "T00:00:00");
  for (let d = new Date(start); d.getTime() <= end.getTime(); d.setDate(d.getDate() + 1)) {
    const pad = (n: number) => String(n).padStart(2, "0");
    allDates.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
  }

  const rows: MonthlyDetailRow[] = [];

  allDates.forEach((date) => {
    employeeList.forEach((emp) => {
      const arr = byDateEmp[date]?.[emp] ?? [];
      if (arr.length === 0) {
        rows.push({
          日付: date,
          氏名: emp,
          出勤: "-",
          退勤: "-",
          外出: "-",
          戻り: "-",
          勤務時間: "休暇",
        });
        return;
      }
      const ins = arr.filter((r) => r.type === "clock_in").map((r) => r.timestamp.slice(11, 16));
      const outs = arr.filter((r) => r.type === "clock_out").map((r) => r.timestamp.slice(11, 16));
      const goOuts = arr.filter((r) => r.type === "go_out").map((r) => r.timestamp.slice(11, 16));
      const goBacks = arr.filter((r) => r.type === "go_back").map((r) => r.timestamp.slice(11, 16));

      const inT = ins[0] || "-";
      const outT = outs[outs.length - 1] || "-";
      const goOutT = goOuts.length ? goOuts.join(", ") : "-";
      const goBackT = goBacks.length ? goBacks.join(", ") : "-";

      let hours = "-";
      if (ins[0] && outs.length > 0) {
        let h = calcWorkHours(ins[0], outs[outs.length - 1]);
        for (let i = 0; i < Math.min(goOuts.length, goBacks.length); i++) {
          h -= calcWorkHours(goOuts[i], goBacks[i]);
        }
        hours = `${Math.max(0, h).toFixed(1)}h`;
      }

      rows.push({
        日付: date,
        氏名: emp,
        出勤: inT,
        退勤: outT,
        外出: goOutT,
        戻り: goBackT,
        勤務時間: hours,
      });
    });
  });
  return rows;
}

export type SummaryRow = {
  emp: string;
  days: number;
  hours: number;
  /** 要出勤が確定しているときのみ max(0, 要出勤 − 出勤)。未確定は null */
  shortage: number | null;
};

export function getSummaryFromDetail(
  detail: MonthlyDetailRow[],
  employeeList: string[],
  effectiveRequiredDays: number | null
): SummaryRow[] {
  const result: SummaryRow[] = [];
  employeeList.forEach((emp) => {
    const empDetails = detail.filter((d) => d.氏名 === emp);
    const days = empDetails.filter((d) => d.出勤 !== "-").length;
    let totalHours = 0;
    empDetails.forEach((d) => {
      if (d.勤務時間 !== "-" && d.勤務時間 !== "休暇") {
        totalHours += parseFloat(d.勤務時間.replace("h", ""));
      }
    });
    const shortage =
      effectiveRequiredDays === null
        ? null
        : Math.max(0, effectiveRequiredDays - days);
    result.push({ emp, days, hours: totalHours, shortage });
  });
  return result;
}
