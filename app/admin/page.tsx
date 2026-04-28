"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  FileSpreadsheet,
  Trash2,
  ArrowLeft,
  UserPlus,
  Save,
  Pencil,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { AppBrandLogo } from "@/components/AppBrandLogo";
import { PunchRecord, PunchType } from "@/lib/types";
import { getMonthlyDetail, getSummaryFromDetail } from "@/lib/attendance";
import {
  deletePunchRecord,
  fetchEmployees,
  fetchPunchRecords,
  saveEmployeesMaster,
  updatePunchRecord,
} from "@/lib/attendanceClient";
import { tryMigrateFromLocalStorageOnce } from "@/lib/migrateLocalStorage";
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

function getDefaultClosingYM(): string {
  const d = new Date();
  if (d.getDate() > 20) {
    const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
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
    default: return "text-slate-600";
  }
}

export default function AdminPage() {
  const [records, setRecords] = useState<PunchRecord[]>([]);
  const [savedEmployeeList, setSavedEmployeeList] = useState<string[]>([]);
  const [employeeDrafts, setEmployeeDrafts] = useState<string[]>([]);
  const [closingEndMonth, setClosingEndMonth] = useState(getDefaultClosingYM);
  const [monthStart, setMonthStart] = useState(() => {
    const ym = getDefaultClosingYM();
    return getClosingPeriod(ym)?.start ?? getTodayDateStr();
  });
  const [monthEnd, setMonthEnd] = useState(() => {
    const ym = getDefaultClosingYM();
    return getClosingPeriod(ym)?.end ?? getTodayDateStr();
  });
  const [periodManualOpen, setPeriodManualOpen] = useState(false);
  const [isCustomPeriod, setIsCustomPeriod] = useState(false);
  const [requiredDaysOverride, setRequiredDaysOverride] = useState("");
  /** 確定後のみ不足日数を計算する（期間変更でリセット） */
  const [committedRequiredDays, setCommittedRequiredDays] = useState<number | null>(null);
  const [editingRecord, setEditingRecord] = useState<PunchRecord | null>(null);
  const [editEmployee, setEditEmployee] = useState("");
  const [editType, setEditType] = useState<PunchType>("clock_in");
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("09:00");

  useEffect(() => {
    void (async () => {
      await tryMigrateFromLocalStorageOnce();
      try {
        const [list, names] = await Promise.all([
          fetchPunchRecords(),
          fetchEmployees(),
        ]);
        setRecords(list);
        setSavedEmployeeList(names);
        setEmployeeDrafts([...names]);
      } catch (e) {
        console.error(e);
        alert(
          e instanceof Error
            ? e.message
            : "データの読み込みに失敗しました。Supabase の環境変数を確認してください。"
        );
      }
    })();
  }, []);

  useEffect(() => {
    setCommittedRequiredDays(null);
  }, [monthStart, monthEnd]);

  const monthlyPunches = useMemo(() => {
    return records
      .filter((r) => r.date >= monthStart && r.date <= monthEnd)
      .sort((a, b) => {
        const nameCmp = a.employee.localeCompare(b.employee, "ja");
        if (nameCmp !== 0) return nameCmp;
        return (
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
      });
  }, [records, monthStart, monthEnd]);

  const detail = useMemo(
    () =>
      getMonthlyDetail(records, monthStart, monthEnd, savedEmployeeList),
    [records, monthStart, monthEnd, savedEmployeeList]
  );
  const suggestedRequiredDays = useMemo(() => {
    if (!monthStart || !monthEnd || monthStart > monthEnd) return null;
    return countWeekdaysInRange(monthStart, monthEnd);
  }, [monthStart, monthEnd]);

  const summary = useMemo(
    () =>
      getSummaryFromDetail(detail, savedEmployeeList, committedRequiredDays),
    [detail, savedEmployeeList, committedRequiredDays]
  );

  const handleConfirmRequiredDays = () => {
    const t = requiredDaysOverride.trim();
    if (t === "") {
      alert("要出勤日数を入力してから確定してください。");
      return;
    }
    const n = parseInt(t, 10);
    if (Number.isNaN(n) || n < 0) {
      alert("0以上の整数を入力してください。");
      return;
    }
    setCommittedRequiredDays(n);
  };

  const handleClosingEndMonthChange = (ym: string) => {
    setClosingEndMonth(ym);
    const p = getClosingPeriod(ym);
    if (p) {
      setMonthStart(p.start);
      setMonthEnd(p.end);
    }
    setIsCustomPeriod(false);
    setPeriodManualOpen(false);
  };

  const handleSaveEmployeeMaster = async () => {
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
    try {
      await saveEmployeesMaster(
        cleaned,
        prev.length === cleaned.length ? prev : undefined
      );
      setSavedEmployeeList(cleaned);
      setEmployeeDrafts([...cleaned]);
      setRecords(await fetchPunchRecords());
      alert("社員マスタを保存しました。打刻画面にも反映されます。");
    } catch (e) {
      alert(e instanceof Error ? e.message : "保存に失敗しました。");
    }
  };

  const handleRemoveEmployeeRow = (index: number) => {
    if (
      !confirm(
        "この行をマスタから外しますか？\n過去の打刻データはクラウドに残りますが、月次の氏名別の行には表示されなくなります。"
      )
    ) {
      return;
    }
    setEmployeeDrafts((d) => d.filter((_, j) => j !== index));
  };

  const handleDelete = async (id: string) => {
    if (!confirm("この打刻を削除しますか？")) return;
    try {
      await deletePunchRecord(id);
      setRecords(await fetchPunchRecords());
      if (editingRecord?.id === id) setEditingRecord(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : "削除に失敗しました。");
    }
  };

  const openEdit = (r: PunchRecord) => {
    setEditingRecord(r);
    setEditEmployee(r.employee);
    setEditType(r.type);
    setEditDate(r.date);
    setEditTime(r.timestamp.slice(11, 16));
  };

  const editEmployeeOptions = useMemo(() => {
    const set = new Set(savedEmployeeList);
    if (editingRecord?.employee && !set.has(editingRecord.employee)) {
      return [...savedEmployeeList, editingRecord.employee];
    }
    return savedEmployeeList;
  }, [savedEmployeeList, editingRecord]);

  const handleSaveEdit = async () => {
    if (!editingRecord) return;
    const emp = editEmployee.trim();
    if (!emp) {
      alert("氏名を入力してください。");
      return;
    }
    if (!savedEmployeeList.includes(emp) && emp !== editingRecord.employee) {
      alert("氏名は社員マスタに登録されている名前から選んでください。");
      return;
    }
    const ts = `${editDate}T${editTime}:00`;
    const updated: PunchRecord = {
      ...editingRecord,
      employee: emp,
      type: editType,
      date: editDate,
      timestamp: ts,
    };
    try {
      await updatePunchRecord(updated);
      setRecords(await fetchPunchRecords());
      setEditingRecord(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : "保存に失敗しました。");
    }
  };

  const handleWorkStatusExport = () => {
    if (savedEmployeeList.length === 0) {
      alert("社員マスタに氏名がありません。先にマスタを保存してください。");
      return;
    }
    if (committedRequiredDays === null) {
      alert("Excel出力の前に、要出勤日数を入力して「確定」を押してください。");
      return;
    }
    try {
      const wb = buildWorkStatusWorkbook({
        records,
        employees: savedEmployeeList,
        closingEndMonth,
        requiredDaysOverride: String(committedRequiredDays),
        ...(isCustomPeriod
          ? { periodRangeOverride: { start: monthStart, end: monthEnd } }
          : {}),
      });
      XLSX.writeFile(wb, workStatusFileName(closingEndMonth));
    } catch (e) {
      alert(e instanceof Error ? e.message : "勤務状況一覧の出力に失敗しました。");
    }
  };

  return (
    <main className="min-h-screen bg-slate-100 p-4 md:p-6">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-3">
              <AppBrandLogo />
              <span className="text-sm font-medium text-slate-500">月次集計</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">月次集計（社長専用）</h1>
          </div>
          <Link
            href="/"
            className="inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-white hover:text-slate-900"
          >
            <ArrowLeft className="h-5 w-5" />
            打刻に戻る
          </Link>
        </header>

        <div className="space-y-6 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <section className="space-y-4">
            <h2 className="text-base font-semibold text-slate-900">集計の前提</h2>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-900">
                締めの終了月（例：4月→3/21〜4/20）
              </label>
              <input
                type="month"
                value={closingEndMonth}
                onChange={(e) => handleClosingEndMonthChange(e.target.value)}
                className="w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
              />
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-800">
              <p className="font-medium text-slate-900">対象期間</p>
              <p className="mt-1">
                {monthStart} 〜 {monthEnd}
                {suggestedRequiredDays != null && (
                  <span className="text-slate-600">
                    {" "}
                    ／ 参考（平日のみ）：{suggestedRequiredDays}日（土曜出勤は含みません）
                  </span>
                )}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">
                締めは毎月20日です。上記の対象期間で集計表・打刻明細・Excel を揃えています。
              </p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-900">
                要出勤日数（入力後に「確定」）
              </label>
              <div className="flex max-w-md flex-wrap items-stretch gap-2">
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={requiredDaysOverride}
                  onChange={(e) => setRequiredDaysOverride(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleConfirmRequiredDays();
                    }
                  }}
                  placeholder="例: 22"
                  className="min-w-[8rem] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0 border-slate-300"
                  onClick={handleConfirmRequiredDays}
                >
                  確定
                </Button>
              </div>
              {committedRequiredDays !== null && (
                <p className="mt-2 text-sm font-medium text-slate-800">
                  要出勤の基準: {committedRequiredDays}日（確定済み）
                </p>
              )}
              <p className="mt-1 text-xs text-slate-500">
                「不足日数」は、上記を確定したあとだけ「要出勤 − 出勤日数」（下限0）で計算します。対象期間を変えると要出勤の確定は解除されます。
              </p>
            </div>

            <div className="border-t border-slate-200 pt-3">
              <button
                type="button"
                onClick={() => setPeriodManualOpen((o) => !o)}
                className="flex w-full items-center gap-2 text-left text-sm font-medium text-slate-700 hover:text-slate-900"
              >
                {periodManualOpen ? (
                  <ChevronDown className="h-4 w-4 shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0" />
                )}
                期間を手動で変更する（通常は不要）
              </button>
              {periodManualOpen && (
                <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-900">開始日</label>
                    <input
                      type="date"
                      value={monthStart}
                      onChange={(e) => {
                        setMonthStart(e.target.value);
                        setIsCustomPeriod(true);
                      }}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-900">終了日</label>
                    <input
                      type="date"
                      value={monthEnd}
                      onChange={(e) => {
                        setMonthEnd(e.target.value);
                        setIsCustomPeriod(true);
                      }}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
                    />
                  </div>
                </div>
              )}
            </div>
          </section>

          {isCustomPeriod && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-center text-sm font-medium text-amber-900">
              カスタム期間を使用中（締め終了月を変えると締め期間に戻ります）
            </div>
          )}

          <div className="overflow-hidden rounded-xl border border-slate-200/80">
            <table className="w-full text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="px-4 py-2 text-left text-slate-900">氏名</th>
                  <th className="px-4 py-2 text-right text-slate-900">出勤日数</th>
                  <th className="px-4 py-2 text-right text-slate-900">不足日数</th>
                  <th className="px-4 py-2 text-right text-slate-900">総勤務時間</th>
                </tr>
              </thead>
              <tbody>
                {summary.map((s) => (
                  <tr key={s.emp} className="border-t border-slate-100">
                    <td className="px-4 py-2 font-medium text-slate-900">{s.emp}</td>
                    <td className="px-4 py-2 text-right text-slate-900">{s.days}日</td>
                    <td className="px-4 py-2 text-right text-slate-900">
                      {s.shortage === null ? "—" : `${s.shortage}日`}
                    </td>
                    <td className="px-4 py-2 text-right text-slate-900">
                      {s.hours.toFixed(1)}h
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-2">
            <p className="text-xs leading-relaxed text-slate-600">
              勤務状況一覧のExcelは、確定済みの要出勤日数・締め終了月・対象期間（手動変更時はその期間）を使います。社員列はマスタの上から順です。
            </p>
            <Button
              type="button"
              onClick={handleWorkStatusExport}
              className="w-full bg-amber-700 text-white hover:bg-amber-800"
            >
              <FileSpreadsheet className="mr-2 h-5 w-5" />
              勤務状況一覧をExcel出力
            </Button>
          </div>

          <div>
            <h3 className="mb-3 text-base font-semibold text-slate-900">
              打刻明細（氏名順・同一日内は時刻順）
            </h3>
            {monthlyPunches.length === 0 ? (
              <p className="text-sm text-slate-500">期間内の打刻はありません</p>
            ) : (
              <div className="max-h-96 space-y-2 overflow-y-auto">
                {monthlyPunches.map((r) => (
                  <div
                    key={r.id}
                    className="flex flex-wrap items-center gap-2 border-b border-slate-100 py-2 last:border-0"
                  >
                    <span className="min-w-[10rem] flex-1 text-sm text-slate-900">
                      {r.date} {r.employee}
                    </span>
                    <span
                      className={`font-semibold text-sm flex-1 min-w-[8rem] ${getTypeClass(r.type)}`}
                    >
                      {getTypeLabel(r.type)} {r.timestamp.slice(11, 16)}
                    </span>
                    <div className="flex gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEdit(r)}
                        className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
                        aria-label="編集"
                      >
                        <Pencil className="w-5 h-5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(r.id)}
                        className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600"
                        aria-label="削除"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <section className="space-y-3 rounded-xl border border-slate-200/80 bg-slate-50/90 p-4">
            <h2 className="text-base font-semibold text-slate-900">社員マスタ（打刻ボタンの氏名）</h2>
            <p className="text-xs leading-relaxed text-slate-600">
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
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
                    placeholder="氏名"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveEmployeeRow(index)}
                    className="shrink-0 rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600"
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
                className="text-slate-900"
              >
                <UserPlus className="w-4 h-4 mr-1" />
                行を追加
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSaveEmployeeMaster}
                className="bg-slate-900 hover:bg-slate-800"
              >
                <Save className="w-4 h-4 mr-1" />
                マスタを保存
              </Button>
            </div>
          </section>
        </div>
      </div>

      {editingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div
            className="w-full max-w-md space-y-4 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xl"
            role="dialog"
            aria-labelledby="edit-punch-title"
          >
            <h2 id="edit-punch-title" className="text-lg font-semibold text-slate-900">
              打刻を修正
            </h2>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-900">氏名</label>
              <select
                value={editEmployee}
                onChange={(e) => setEditEmployee(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
              >
                {editEmployeeOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-900">種類</label>
              <select
                value={editType}
                onChange={(e) => setEditType(e.target.value as PunchType)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
              >
                <option value="clock_in">出勤</option>
                <option value="clock_out">退勤</option>
                <option value="go_out">外出</option>
                <option value="go_back">戻り</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-900">日付</label>
              <input
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-900">時刻</label>
              <input
                type="time"
                value={editTime}
                onChange={(e) => setEditTime(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
              />
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button type="button" variant="outline" onClick={() => setEditingRecord(null)}>
                キャンセル
              </Button>
              <Button type="button" onClick={handleSaveEdit}>
                保存
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
