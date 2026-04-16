import * as XLSX from "xlsx";
import type { PunchRecord } from "./types";

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"] as const;
const FW_DIGITS = "０１２３４５６７８９";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/** 終了月 YYYY-MM（その月の20日で締め）→ 期間 前月21日〜当月末日20日 */
export function getClosingPeriod(ym: string): { start: string; end: string } | null {
  const m = ym.match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (mo < 1 || mo > 12) return null;
  const end = `${y}-${pad2(mo)}-20`;
  let sy = y;
  let sm = mo - 1;
  if (sm < 1) {
    sm = 12;
    sy = y - 1;
  }
  const start = `${sy}-${pad2(sm)}-21`;
  return { start, end };
}

/**
 * 指定日を含む20日締め区間（前月21日〜当月20日）の開始日・終了日。
 * 日が21日以降なら「翌月20日まで」の区間に属する。
 */
export function getClosingPeriodContainingDate(
  dateStr: string
): { start: string; end: string } | null {
  const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const day = Number(m[3]);
  if (day <= 20) {
    return getClosingPeriod(`${y}-${pad2(mo)}`);
  }
  let ey = y;
  let em = mo + 1;
  if (em > 12) {
    em = 1;
    ey += 1;
  }
  return getClosingPeriod(`${ey}-${pad2(em)}`);
}

export function enumerateDatesInclusive(start: string, end: string): string[] {
  const out: string[] = [];
  const a = new Date(start + "T12:00:00");
  const b = new Date(end + "T12:00:00");
  for (let d = new Date(a); d.getTime() <= b.getTime(); d.setDate(d.getDate() + 1)) {
    out.push(`${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`);
  }
  return out;
}

/** 期間内の平日（月〜金）の日数 */
export function countWeekdaysInRange(start: string, end: string): number {
  return enumerateDatesInclusive(start, end).filter((iso) => {
    const dow = new Date(iso + "T12:00:00").getDay();
    return dow >= 1 && dow <= 5;
  }).length;
}

function reiwaCalendarYearLabel(y: number): string {
  return `令和${y - 2018}年`;
}

/** 例: 令和8年3月～4月 */
export function periodTitleLabel(start: string, end: string): string {
  const ds = new Date(start + "T12:00:00");
  const de = new Date(end + "T12:00:00");
  const ry = reiwaCalendarYearLabel(ds.getFullYear());
  return `${ry}${ds.getMonth() + 1}月～${de.getMonth() + 1}月`;
}

function toFullWidthDayNum(day: number): string {
  return String(day)
    .split("")
    .map((c) => FW_DIGITS[Number(c)] ?? c)
    .join("");
}

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

function minutesToHHmm(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function isMoritaRoundingEmployee(name: string): boolean {
  return name === "森田" || name === "森田仁美";
}

/** 始業: 10分単位四捨五入、終業: 15分単位切り捨て */
function applyMoritaRounding(inMin: number, outMin: number): { inMin: number; outMin: number } {
  const inR = Math.round(inMin / 10) * 10;
  const outR = Math.floor(outMin / 15) * 15;
  return { inMin: inR, outMin: outR };
}

export function buildDayCellForEmployee(
  records: PunchRecord[],
  date: string,
  employee: string
): { inDisplay: string; outDisplay: string; workHours: number; workMinutes: number } {
  const dayRecords = records.filter((r) => r.date === date && r.employee === employee);
  const sorted = [...dayRecords].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  const ins = sorted.filter((r) => r.type === "clock_in");
  const outs = sorted.filter((r) => r.type === "clock_out");
  const goOuts = sorted.filter((r) => r.type === "go_out");
  const goBacks = sorted.filter((r) => r.type === "go_back");

  if (ins.length === 0 || outs.length === 0) {
    return { inDisplay: "", outDisplay: "", workHours: 0, workMinutes: 0 };
  }

  const inT = ins[0].timestamp.slice(11, 16);
  const outT = outs[outs.length - 1].timestamp.slice(11, 16);
  const rawInMin = timeToMinutes(inT);
  const rawOutMin = timeToMinutes(outT);

  let displayIn: string;
  let displayOut: string;
  let boundaryIn: number;
  let boundaryOut: number;

  if (isMoritaRoundingEmployee(employee)) {
    const r = applyMoritaRounding(rawInMin, rawOutMin);
    boundaryIn = r.inMin;
    boundaryOut = r.outMin;
    displayIn = minutesToHHmm(boundaryIn);
    displayOut = minutesToHHmm(boundaryOut);
  } else {
    boundaryIn = rawInMin;
    boundaryOut = rawOutMin;
    displayIn = inT;
    displayOut = outT;
  }

  let gross = boundaryOut - boundaryIn;
  if (gross <= 0) {
    return { inDisplay: displayIn, outDisplay: displayOut, workHours: 0, workMinutes: 0 };
  }

  for (let i = 0; i < Math.min(goOuts.length, goBacks.length); i++) {
    const gs = timeToMinutes(goOuts[i].timestamp.slice(11, 16));
    const ge = timeToMinutes(goBacks[i].timestamp.slice(11, 16));
    gross -= ge - gs;
  }
  gross = Math.max(0, gross);
  return {
    inDisplay: displayIn,
    outDisplay: displayOut,
    workHours: gross / 60,
    workMinutes: gross,
  };
}

export type WorkStatusExportOptions = {
  records: PunchRecord[];
  employees: string[];
  closingEndMonth: string;
  /** 空欄時は平日数を自動 */
  requiredDaysOverride: string;
};

export function buildWorkStatusWorkbook(opts: WorkStatusExportOptions): XLSX.WorkBook {
  const period = getClosingPeriod(opts.closingEndMonth);
  if (!period) throw new Error("締め月の形式が不正です（YYYY-MM）");

  const dates = enumerateDatesInclusive(period.start, period.end);
  const suggested = countWeekdaysInRange(period.start, period.end);
  const overrideNum = opts.requiredDaysOverride.trim();
  const requiredDays =
    overrideNum === "" || Number.isNaN(Number(overrideNum))
      ? suggested
      : Number(overrideNum);

  const allEmps = [...opts.employees];
  const emps = allEmps.slice(0, 6);
  const titlePeriod = periodTitleLabel(period.start, period.end);

  const leftCols = 3;
  const empCols = emps.length * 2;
  const specialCol = 1;
  const auxCols = 4;
  const totalCols = leftCols + empCols + specialCol + auxCols;

  const specialColIdx = leftCols + empCols;

  const headerRow1: (string | number)[] = Array(totalCols).fill("");
  headerRow1[0] = titlePeriod;
  const titleStart = leftCols + Math.floor(empCols / 2) - 2;
  headerRow1[Math.max(0, titleStart)] = "勤　務　状　況　一　覧";
  headerRow1[specialColIdx] = `要出勤日数：${requiredDays}　日`;

  const headerRow2: (string | number)[] = Array(totalCols).fill("");
  headerRow2[totalCols - 4] = "深田";
  headerRow2[totalCols - 2] = "森田";

  const headerRow3: (string | number)[] = [];
  headerRow3.push("日", "曜日", "備　考");
  for (const name of emps) {
    headerRow3.push(name, "");
  }
  headerRow3.push("特　記　事　項", "時間", "分", "時間", "分");

  const rows: (string | number)[][] = [headerRow1, headerRow2, headerRow3];

  const totalsMinutes: Record<string, number> = {};
  for (const e of emps) totalsMinutes[e] = 0;
  const auxTotals: Record<string, number> = { 深田: 0, 森田: 0 };

  for (const dateStr of dates) {
    const d = new Date(dateStr + "T12:00:00");
    const dayNum = d.getDate();
    const row: (string | number)[] = [];
    row.push(toFullWidthDayNum(dayNum));
    row.push(WEEKDAYS[d.getDay()]);
    row.push("");
    for (const emp of emps) {
      const cell = buildDayCellForEmployee(opts.records, dateStr, emp);
      row.push(cell.inDisplay, cell.outDisplay);
      totalsMinutes[emp] += cell.workMinutes;
    }
    row.push("");
    const fukada = allEmps.includes("深田")
      ? buildDayCellForEmployee(opts.records, dateStr, "深田").workMinutes
      : 0;
    const moritaName = allEmps.find((e) => e === "森田" || e === "森田仁美");
    const moritaMin = moritaName
      ? buildDayCellForEmployee(opts.records, dateStr, moritaName).workMinutes
      : 0;
    auxTotals["深田"] += fukada;
    auxTotals["森田"] += moritaMin;
    row.push(Math.floor(fukada / 60), fukada % 60, Math.floor(moritaMin / 60), moritaMin % 60);
    rows.push(row);
  }

  const sumRow: (string | number)[] = Array(totalCols).fill("");
  const totalLabelIdx = leftCols + Math.max(0, Math.floor(empCols / 2) - 2);
  sumRow[totalLabelIdx] = "勤務時間合計 ☞";
  let ci = leftCols;
  for (const emp of emps) {
    const h = totalsMinutes[emp] / 60;
    sumRow[ci] = Number(h.toFixed(2));
    sumRow[ci + 1] = "";
    ci += 2;
  }
  sumRow[specialColIdx] = "☜ 勤務時間合計";
  const fTotal = auxTotals["深田"];
  const mTotal = auxTotals["森田"];
  sumRow[totalCols - 4] = Math.floor(fTotal / 60);
  sumRow[totalCols - 3] = fTotal % 60;
  sumRow[totalCols - 2] = Math.floor(mTotal / 60);
  sumRow[totalCols - 1] = mTotal % 60;
  rows.push(sumRow);

  const rateRow: (string | number)[] = Array(totalCols).fill("");
  rateRow[leftCols + Math.floor(empCols / 2)] = "時間単価";
  rateRow[totalCols - 4] = Number((fTotal / 60).toFixed(2));
  rateRow[totalCols - 2] = Number((mTotal / 60).toFixed(2));
  rows.push(rateRow);

  const noteRow: (string | number)[] = Array(totalCols).fill("");
  noteRow[1] =
    "※ 氏名が「森田」「森田仁美」の場合：出勤・退勤の表示および勤務時間は、始業＝１０分単位（四捨五入）／終業＝１５分単位（切り捨て）で算出しています。";
  rows.push(noteRow);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = Array(totalCols)
    .fill(null)
    .map((_, i) => {
      if (i < 2) return { wch: 5 };
      if (i === 2) return { wch: 8 };
      if (i >= leftCols + empCols) return { wch: i === leftCols + empCols ? 24 : 8 };
      return { wch: 7 };
    });

  const wb = XLSX.utils.book_new();
  const sheetName = titlePeriod.replace(/[\\/?*[\]:]/g, "_").slice(0, 31);
  XLSX.utils.book_append_sheet(wb, ws, sheetName || "勤務状況一覧");

  if (allEmps.length > 6) {
    const wb2 = buildOverflowSheet(opts, dates, titlePeriod);
    XLSX.utils.book_append_sheet(wb, wb2, "勤務状況一覧_続き");
  }

  return wb;
}

/** 7人目以降用（日付＋該当社員のみ。1枚目は最大6名まで） */
function buildOverflowSheet(
  opts: WorkStatusExportOptions,
  dates: string[],
  titlePeriod: string
): XLSX.WorkSheet {
  const extra = opts.employees.slice(6);
  const leftCols = 3;
  const empCols = extra.length * 2;
  const totalCols = leftCols + empCols;
  const rows: (string | number)[][] = [];
  rows.push([`${titlePeriod}（社員7人目以降）`, ...Array(totalCols - 1).fill("")]);
  const h: (string | number)[] = ["日", "曜日", "備　考"];
  for (const name of extra) {
    h.push(name, "");
  }
  rows.push(h);
  const totalsMinutes: Record<string, number> = {};
  for (const e of extra) totalsMinutes[e] = 0;
  for (const dateStr of dates) {
    const d = new Date(dateStr + "T12:00:00");
    const row: (string | number)[] = [
      toFullWidthDayNum(d.getDate()),
      WEEKDAYS[d.getDay()],
      "",
    ];
    for (const emp of extra) {
      const cell = buildDayCellForEmployee(opts.records, dateStr, emp);
      row.push(cell.inDisplay, cell.outDisplay);
      totalsMinutes[emp] += cell.workMinutes;
    }
    rows.push(row);
  }
  const sumRow: (string | number)[] = Array(totalCols).fill("");
  sumRow[0] = "勤務時間合計";
  let ci = leftCols;
  for (const emp of extra) {
    sumRow[ci] = Number((totalsMinutes[emp] / 60).toFixed(2));
    sumRow[ci + 1] = "";
    ci += 2;
  }
  rows.push(sumRow);
  return XLSX.utils.aoa_to_sheet(rows);
}

export function workStatusFileName(closingEndMonth: string): string {
  const period = getClosingPeriod(closingEndMonth);
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  if (!period) return `勤務状況一覧_${stamp}.xlsx`;
  const label = periodTitleLabel(period.start, period.end).replace(/[\\/:*?"<>|]/g, "_");
  return `勤務状況一覧_${label}_${stamp}.xlsx`;
}
