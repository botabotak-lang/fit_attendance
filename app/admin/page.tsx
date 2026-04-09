"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, Trash2, ArrowLeft, UserPlus, Save } from "lucide-react";
import { PunchRecord, STORAGE_KEY } from "@/lib/types";
import { getMonthlyDetail, getSummaryFromDetail } from "@/lib/attendance";
import {
  getEmployees,
  saveEmployees,
  applyEmployeeListRenames,
} from "@/lib/employees";
import {
  getClosingPeriod,
  countWeekdaysInRange,
  buildWorkStatusWorkbook,
  workStatusFileName,
} from "@/lib/workStatusReport";
import * as XLSX from "xlsx";

function getTodayDateStr() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
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
  const [savedEmployeeList, setSavedEmployeeList] = useState<string[]>([]);
  const [employeeDrafts, setEmployeeDrafts] = useState<string[]>([]);
  const [monthStart, setMonthStart] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [monthEnd, setMonthEnd] = useState(() => getTodayDateStr());
  const [closingEndMonth, setClosingEndMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [requiredDaysOverride, setRequiredDaysOverride] = useState("");

  useEffect(() => {
    setRecords(getRecords());
    const names = getEmployees();
    setSavedEmployeeList(names);
    setEmployeeDrafts([...names]);
  }, []);

  const monthlyPunches = records
    .filter((r) => r.date >= monthStart && r.date <= monthEnd)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const detail = useMemo(
    () =>
      getMonthlyDetail(records, monthStart, monthEnd, savedEmployeeList),
    [records, monthStart, monthEnd, savedEmployeeList]
  );
  const summary = useMemo(
    () => getSummaryFromDetail(detail, savedEmployeeList),
    [detail, savedEmployeeList]
  );

  const workStatusPeriod = useMemo(
    () => getClosingPeriod(closingEndMonth),
    [closingEndMonth]
  );
  const suggestedRequiredDays = useMemo(() => {
    if (!workStatusPeriod) return null;
    return countWeekdaysInRange(workStatusPeriod.start, workStatusPeriod.end);
  }, [workStatusPeriod]);

  const handleSaveEmployeeMaster = () => {
    const cleaned = employeeDrafts.map((s) => s.trim()).filter(Boolean);
    if (cleaned.length === 0) {
      alert("氏名を1名以上入力してください。");
      return;
    }
    if (cleaned.length !== new Set(cleaned).size) {
      alert("同じ氏名が複数あります。重複を解消してから保存してください。");
      return;
    }
    const prev = savedEmployeeList;
    if (prev.length === cleaned.length) {
      applyEmployeeListRenames(prev, cleaned);
    }
    saveEmployees(cleaned);
    setSavedEmployeeList(cleaned);
    setEmployeeDrafts([...cleaned]);
    setRecords(getRecords());
    alert("社員マスタを保存しました。打刻画面にも反映されます。");
  };

  const handleRemoveEmployeeRow = (index: number) => {
    if (
      !confirm(
        "この行をマスタから外しますか？\n過去の打刻データは端末に残りますが、月次の氏名別の行には表示されなくなります。"
      )
    ) {
      return;
    }
    setEmployeeDrafts((d) => d.filter((_, j) => j !== index));
  };

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

  const handleWorkStatusExport = () => {
    if (savedEmployeeList.length === 0) {
      alert("社員マスタに氏名がありません。先にマスタを保存してください。");
      return;
    }
    try {
      const wb = buildWorkStatusWorkbook({
        records: getRecords(),
        employees: savedEmployeeList,
        closingEndMonth,
        requiredDaysOverride,
      });
      XLSX.writeFile(wb, workStatusFileName(closingEndMonth));
    } catch (e) {
      alert(e instanceof Error ? e.message : "勤務状況一覧の出力に失敗しました。");
    }
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
          <section className="border border-gray-200 rounded-lg p-4 space-y-3 bg-gray-50/80">
            <h2 className="text-base font-semibold text-gray-900">社員マスタ（打刻ボタンの氏名）</h2>
            <p className="text-xs text-gray-600 leading-relaxed">
              行数が<strong>変わらない</strong>ときだけ、入力の変更が過去の打刻の氏名にも反映されます。
              行の追加・削除と名前変更を同時にしないでください。
            </p>
            <ul className="space-y-2">
              {employeeDrafts.map((name, index) => (
                <li key={index} className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) =>
                      setEmployeeDrafts((d) =>
                        d.map((x, j) => (j === index ? e.target.value : x))
                      )
                    }
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-gray-900"
                    placeholder="氏名"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveEmployeeRow(index)}
                    className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg shrink-0"
                    aria-label="この行を削除"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEmployeeDrafts((d) => [...d, ""])}
                className="text-gray-900"
              >
                <UserPlus className="w-4 h-4 mr-1" />
                行を追加
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSaveEmployeeMaster}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Save className="w-4 h-4 mr-1" />
                マスタを保存
              </Button>
            </div>
          </section>

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

          <section className="border border-gray-200 rounded-lg p-4 space-y-3 bg-amber-50/40">
            <h2 className="text-base font-semibold text-gray-900">勤務状況一覧（社長用・21日締め）</h2>
            <p className="text-xs text-gray-600 leading-relaxed">
              終了月を選ぶと、<strong>前月21日〜当該月20日</strong>の期間で一覧を出力します。社員列は
              <strong>マスタの上から順</strong>です（6名を超える場合は2枚目シートに7人目以降）。要出勤日数は
              平日数を提案し、空欄のままならそれを採用／数値を入れると上書きします。
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  締めの終了月（例：4月→3/21〜4/20）
                </label>
                <input
                  type="month"
                  value={closingEndMonth}
                  onChange={(e) => setClosingEndMonth(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900"
                />
                {workStatusPeriod && (
                  <p className="text-xs text-gray-500 mt-1">
                    期間：{workStatusPeriod.start} 〜 {workStatusPeriod.end}
                    {suggestedRequiredDays != null && (
                      <> ／ 提案の要出勤日数（平日）：{suggestedRequiredDays}日</>
                    )}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  要出勤日数（空欄＝提案どおり）
                </label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={requiredDaysOverride}
                  onChange={(e) => setRequiredDaysOverride(e.target.value)}
                  placeholder={
                    suggestedRequiredDays != null
                      ? `未入力時は ${suggestedRequiredDays} 日`
                      : "平日の提案値を使用"
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900"
                />
              </div>
            </div>
            <Button
              type="button"
              onClick={handleWorkStatusExport}
              className="w-full bg-amber-700 hover:bg-amber-800 text-white"
            >
              <FileSpreadsheet className="w-5 h-5 mr-2" />
              勤務状況一覧をExcel出力
            </Button>
          </section>

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
