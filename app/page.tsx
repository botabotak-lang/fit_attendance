"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Clock, List, FileSpreadsheet } from "lucide-react";
import { EMPLOYEES, PunchRecord, PunchType, STORAGE_KEY } from "@/lib/types";
import * as XLSX from "xlsx";

type Tab = "punch" | "today" | "monthly";

function getTodayDateStr() {
  return new Date().toISOString().slice(0, 10);
}

function getRecords(): PunchRecord[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

function saveRecords(records: PunchRecord[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("punch");
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const [records, setRecords] = useState<PunchRecord[]>([]);
  const [monthStart, setMonthStart] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [monthEnd, setMonthEnd] = useState(() => getTodayDateStr());

  const loadRecords = () => setRecords(getRecords());

  useEffect(() => {
    loadRecords();
  }, [activeTab]);

  const handlePunch = (type: PunchType) => {
    if (!selectedEmployee || !EMPLOYEES.includes(selectedEmployee as any)) return;
    const now = new Date();
    const record: PunchRecord = {
      id: `${now.getTime()}-${Math.random().toString(36).slice(2)}`,
      employee: selectedEmployee as any,
      type,
      timestamp: now.toISOString(),
      date: now.toISOString().slice(0, 10),
    };
    const next = [...getRecords(), record];
    saveRecords(next);
    setRecords(next);
  };

  const todayPunches = records.filter((r) => r.date === getTodayDateStr());

  const calcWorkHours = (inTime: string, outTime: string): number => {
    const [inH, inM] = inTime.split(":").map(Number);
    const [outH, outM] = outTime.split(":").map(Number);
    return (outH * 60 + outM - (inH * 60 + inM)) / 60;
  };

  const getMonthlyDetail = () => {
    const filtered = records
      .filter((r) => r.date >= monthStart && r.date <= monthEnd)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const byDate: Record<string, Record<string, { in?: string; out?: string }[]>> = {};
    filtered.forEach((r) => {
      if (!byDate[r.date]) byDate[r.date] = {};
      if (!byDate[r.date][r.employee]) byDate[r.date][r.employee] = [];
      const arr = byDate[r.date][r.employee];
      const time = r.timestamp.slice(11, 16);
      if (r.type === "clock_in") {
        arr.push({ in: time });
      } else {
        const last = arr[arr.length - 1];
        if (last && !last.out) last.out = time;
        else arr.push({ out: time });
      }
    });

    const rows: { 日付: string; 氏名: string; 出勤: string; 退勤: string; 勤務時間: string }[] = [];
    const dates = Object.keys(byDate).sort();
    dates.forEach((date) => {
      Object.entries(byDate[date]).forEach(([emp, pairs]) => {
        pairs.forEach((p) => {
          const inT = p.in || "-";
          const outT = p.out || "-";
          let hours = "-";
          if (p.in && p.out) {
            const h = calcWorkHours(p.in, p.out);
            hours = `${h.toFixed(1)}h`;
          }
          rows.push({ 日付: date, 氏名: emp, 出勤: inT, 退勤: outT, 勤務時間: hours });
        });
      });
    });
    return rows;
  };

  const getSummaryFromDetail = (detail: ReturnType<typeof getMonthlyDetail>) => {
    const result: { emp: string; days: number; hours: number }[] = [];
    EMPLOYEES.forEach((emp) => {
      const empDetails = detail.filter((d) => d.氏名 === emp);
      const days = new Set(empDetails.map((d) => d.日付)).size;
      let totalHours = 0;
      empDetails.forEach((d) => {
        if (d.勤務時間 !== "-") {
          totalHours += parseFloat(d.勤務時間.replace("h", ""));
        }
      });
      result.push({ emp, days, hours: totalHours });
    });
    return result;
  };

  const handleExcelExport = () => {
    const detail = getMonthlyDetail();
    const summary = getSummaryFromDetail(detail);

    const summaryData: (string | number)[][] = [
      ["月次勤怠集計"],
      ["集計期間", `${monthStart} 〜 ${monthEnd}`],
      [],
      ["氏名", "出勤日数", "総勤務時間"],
      ...summary.map((s) => [s.emp, s.days, `${s.hours.toFixed(1)}h`]),
    ];

    const detailData: (string | number)[][] = [
      ["日付", "氏名", "出勤", "退勤", "勤務時間"],
      ...detail.map((d) => [d.日付, d.氏名, d.出勤, d.退勤, d.勤務時間]),
    ];

    const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
    const ws2 = XLSX.utils.aoa_to_sheet(detailData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws1, "集計");
    XLSX.utils.book_append_sheet(wb, ws2, "明細");
    XLSX.writeFile(wb, `勤怠集計_${monthStart}_${monthEnd}.xlsx`);
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "punch", label: "打刻", icon: <Clock className="w-5 h-5" /> },
    { id: "today", label: "今日", icon: <List className="w-5 h-5" /> },
    { id: "monthly", label: "月次", icon: <FileSpreadsheet className="w-5 h-5" /> },
  ];

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          勤怠管理システム
        </h1>

        {/* タブ */}
        <div className="flex gap-2 mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium transition-colors ${
                activeTab === tab.id
                  ? "bg-blue-600 text-white"
                  : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* 打刻画面 */}
        {activeTab === "punch" && (
          <div className="bg-white rounded-xl shadow-sm p-6 space-y-6">
            <h2 className="text-lg font-semibold">打刻</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                氏名を選択
              </label>
              <select
                value={selectedEmployee}
                onChange={(e) => setSelectedEmployee(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-lg"
              >
                <option value="">-- 選択してください --</option>
                {EMPLOYEES.map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Button
                size="lg"
                variant="success"
                onClick={() => handlePunch("clock_in")}
                disabled={!selectedEmployee}
                className="h-20 text-xl"
              >
                <Clock className="w-8 h-8" />
                出勤
              </Button>
              <Button
                size="lg"
                variant="destructive"
                onClick={() => handlePunch("clock_out")}
                disabled={!selectedEmployee}
                className="h-20 text-xl"
              >
                <Clock className="w-8 h-8" />
                退勤
              </Button>
            </div>
            <p className="text-sm text-gray-500">
              入り口のiPadまたはスマホで打刻できます。
            </p>
          </div>
        )}

        {/* 今日の一覧 */}
        {activeTab === "today" && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-4">
              今日の打刻一覧（{getTodayDateStr()}）
            </h2>
            {todayPunches.length === 0 ? (
              <p className="text-gray-500">本日の打刻はまだありません</p>
            ) : (
              <div className="space-y-2">
                {todayPunches
                  .sort(
                    (a, b) =>
                      new Date(a.timestamp).getTime() -
                      new Date(b.timestamp).getTime()
                  )
                  .map((r) => (
                    <div
                      key={r.id}
                      className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0"
                    >
                      <span className="font-medium">{r.employee}</span>
                      <span
                        className={
                          r.type === "clock_in"
                            ? "text-green-600 font-semibold"
                            : "text-red-600 font-semibold"
                        }
                      >
                        {r.type === "clock_in" ? "出勤" : "退勤"}{" "}
                        {r.timestamp.slice(11, 16)}
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* 月次集計 */}
        {activeTab === "monthly" && (
          <div className="bg-white rounded-xl shadow-sm p-6 space-y-6">
            <h2 className="text-lg font-semibold">月次集計</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  開始日
                </label>
                <input
                  type="date"
                  value={monthStart}
                  onChange={(e) => setMonthStart(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  終了日
                </label>
                <input
                  type="date"
                  value={monthEnd}
                  onChange={(e) => setMonthEnd(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-2 text-left">氏名</th>
                    <th className="px-4 py-2 text-right">出勤日数</th>
                    <th className="px-4 py-2 text-right">総勤務時間</th>
                  </tr>
                </thead>
                <tbody>
                  {getSummaryFromDetail(getMonthlyDetail()).map((s) => (
                    <tr key={s.emp} className="border-t border-gray-100">
                      <td className="px-4 py-2 font-medium">{s.emp}</td>
                      <td className="px-4 py-2 text-right">{s.days}日</td>
                      <td className="px-4 py-2 text-right">
                        {s.hours.toFixed(1)}h
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Button
              onClick={handleExcelExport}
              variant="outline"
              className="w-full"
            >
              <FileSpreadsheet className="w-5 h-5 mr-2" />
              Excelで出力
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}
