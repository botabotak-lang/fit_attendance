"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, Trash2, ArrowLeft } from "lucide-react";
import { PunchRecord, STORAGE_KEY } from "@/lib/types";
import { getMonthlyDetail, getSummaryFromDetail } from "@/lib/attendance";
import * as XLSX from "xlsx";

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

function getTypeLabel(type: PunchRecord["type"]) {
  switch (type) {
    case "clock_in": return "出勤";
    case "clock_out": return "退勤";
    case "go_out": return "外出";
    case "go_back": return "戻り";
    default: return type;
  }
}

function getTypeClass(type: PunchRecord["type"]) {
  switch (type) {
    case "clock_in": return "text-green-600";
    case "clock_out": return "text-red-600";
    case "go_out": return "text-amber-600";
    case "go_back": return "text-blue-600";
    default: return "text-gray-600";
  }
}

export default function AdminPage() {
  const [records, setRecords] = useState<PunchRecord[]>([]);
  const [monthStart, setMonthStart] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [monthEnd, setMonthEnd] = useState(() => getTodayDateStr());

  useEffect(() => {
    setRecords(getRecords());
  }, []);

  const monthlyPunches = records
    .filter((r) => r.date >= monthStart && r.date <= monthEnd)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const detail = getMonthlyDetail(records, monthStart, monthEnd);
  const summary = getSummaryFromDetail(detail);

  const handleDelete = (id: string) => {
    if (!confirm("この打刻を削除しますか？")) return;
    const next = getRecords().filter((r) => r.id !== id);
    saveRecords(next);
    setRecords(next);
  };

  const handleExcelExport = () => {
    const summaryData: (string | number)[][] = [
      ["月次勤怠集計（社長専用）"],
      ["集計期間", `${monthStart} 〜 ${monthEnd}`],
      [],
      ["氏名", "出勤日数", "休暇日数", "総勤務時間"],
      ...summary.map((s) => [s.emp, s.days, s.leaveDays, `${s.hours.toFixed(1)}h`]),
    ];

    const detailData: (string | number)[][] = [
      ["日付", "氏名", "出勤", "退勤", "外出", "戻り", "勤務時間"],
      ...detail.map((d) => [d.日付, d.氏名, d.出勤, d.退勤, d.外出, d.戻り, d.勤務時間]),
    ];

    const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
    const ws2 = XLSX.utils.aoa_to_sheet(detailData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws1, "集計");
    XLSX.utils.book_append_sheet(wb, ws2, "明細");
    XLSX.writeFile(wb, `勤怠集計_${monthStart}_${monthEnd}.xlsx`);
  };

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">月次集計（社長専用）</h1>
          <Link
            href="/"
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-5 h-5" />
            打刻に戻る
          </Link>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">開始日</label>
              <input
                type="date"
                value={monthStart}
                onChange={(e) => setMonthStart(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">終了日</label>
              <input
                type="date"
                value={monthEnd}
                onChange={(e) => setMonthEnd(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900"
              />
            </div>
          </div>

          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-2 text-left text-gray-900">氏名</th>
                  <th className="px-4 py-2 text-right text-gray-900">出勤日数</th>
                  <th className="px-4 py-2 text-right text-gray-900">休暇日数</th>
                  <th className="px-4 py-2 text-right text-gray-900">総勤務時間</th>
                </tr>
              </thead>
              <tbody>
                {summary.map((s) => (
                  <tr key={s.emp} className="border-t border-gray-100">
                    <td className="px-4 py-2 font-medium text-gray-900">{s.emp}</td>
                    <td className="px-4 py-2 text-right text-gray-900">{s.days}日</td>
                    <td className="px-4 py-2 text-right text-gray-500">{s.leaveDays}日</td>
                    <td className="px-4 py-2 text-right text-gray-900">
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
            className="w-full text-gray-900"
          >
            <FileSpreadsheet className="w-5 h-5 mr-2" />
            Excelで出力
          </Button>

          <div>
            <h3 className="text-base font-semibold text-gray-900 mb-3">打刻明細</h3>
            {monthlyPunches.length === 0 ? (
              <p className="text-gray-500 text-sm">期間内の打刻はありません</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {monthlyPunches.map((r) => (
                  <div
                    key={r.id}
                    className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0"
                  >
                    <span className="text-sm text-gray-900">
                      {r.date} {r.employee}
                    </span>
                    <span className={`font-semibold text-sm ${getTypeClass(r.type)}`}>
                      {getTypeLabel(r.type)} {r.timestamp.slice(11, 16)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDelete(r.id)}
                      className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      aria-label="削除"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
