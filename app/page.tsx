"use client";

import { useState, useEffect, startTransition } from "react";
import { Button } from "@/components/ui/button";
import { Clock, List, LogOut, LogIn, DoorOpen, DoorClosed, Pencil } from "lucide-react";
import { AppBrandLogo } from "@/components/AppBrandLogo";
import { PunchRecord, PunchType } from "@/lib/types";
import { EMPLOYEES_CHANGED_EVENT, EMPLOYEES_STORAGE_KEY } from "@/lib/employees";
import {
  addPunchRecord,
  fetchEmployees,
  fetchPunchRecords,
} from "@/lib/attendanceClient";
import { tryMigrateFromLocalStorageOnce } from "@/lib/migrateLocalStorage";

type Tab = "punch" | "today";
const TOAST_DURATION_MS = 2500;

function getTodayDateStr() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("punch");
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const [employees, setEmployees] = useState<string[]>([]);
  const [records, setRecords] = useState<PunchRecord[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [correctionMode, setCorrectionMode] = useState(false);
  const [correctionTime, setCorrectionTime] = useState(() => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  });
  const loadRecords = async () => {
    try {
      setRecords(await fetchPunchRecords());
    } catch (e) {
      console.error(e);
      alert(
        e instanceof Error
          ? e.message
          : "打刻データの取得に失敗しました。Supabase の環境変数を確認してください。"
      );
    }
  };
  const loadEmployees = async () => {
    try {
      const list = await fetchEmployees();
      setEmployees(list);
      setSelectedEmployee((cur) => (cur && list.includes(cur) ? cur : ""));
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    void (async () => {
      await tryMigrateFromLocalStorageOnce();
      await loadEmployees();
      await loadRecords();
    })();
  }, []);

  useEffect(() => {
    startTransition(() => {
      void loadRecords();
    });
  }, [activeTab]);

  useEffect(() => {
    const onEmployeesChanged = () => {
      void loadEmployees();
    };
    window.addEventListener(EMPLOYEES_CHANGED_EVENT, onEmployeesChanged);
    const onStorage = (e: StorageEvent) => {
      if (e.key === EMPLOYEES_STORAGE_KEY) void loadEmployees();
    };
    window.addEventListener("storage", onStorage);
    const onFocus = () => {
      void loadEmployees();
      void loadRecords();
    };
    window.addEventListener("focus", onFocus);
    const interval = window.setInterval(() => {
      void loadEmployees();
      void loadRecords();
    }, 60_000);
    return () => {
      window.removeEventListener(EMPLOYEES_CHANGED_EVENT, onEmployeesChanged);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  useEffect(() => {
    const todayStr = getTodayDateStr();
    const has =
      !!selectedEmployee &&
      records.some((r) => r.date === todayStr && r.employee === selectedEmployee);
    if (correctionMode && !has) {
      startTransition(() => setCorrectionMode(false));
    }
  }, [correctionMode, selectedEmployee, records]);

  const handlePunch = async (type: PunchType, useCorrection = false) => {
    if (!selectedEmployee || !employees.includes(selectedEmployee) || toastMessage) return;
    if (useCorrection) {
      const todayStr = getTodayDateStr();
      const hasAnyToday = records.some(
        (r) => r.date === todayStr && r.employee === selectedEmployee
      );
      if (!hasAnyToday) return;
    }
    if (!useCorrection) {
      if (type === "clock_in" && !canClockIn) return;
      if (type === "clock_out" && !canClockOut) return;
      if (type === "go_out" && !canGoOut) return;
      if (type === "go_back" && !canGoBack) return;
    }
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const timeStr = useCorrection
      ? `${correctionTime}:00`
      : `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    const timestamp = `${dateStr}T${timeStr}`;
    const record: PunchRecord = {
      id: `${now.getTime()}-${Math.random().toString(36).slice(2)}`,
      employee: selectedEmployee,
      type,
      timestamp,
      date: dateStr,
    };
    try {
      await addPunchRecord(record);
      await loadRecords();
    } catch (e) {
      alert(e instanceof Error ? e.message : "打刻の保存に失敗しました。");
      return;
    }
    const corrLabel = useCorrection ? "（修正）" : "";
    const msg =
      type === "clock_in"
        ? `出勤しました${corrLabel}`
        : type === "clock_out"
          ? `退勤しました${corrLabel}`
          : type === "go_out"
            ? `外出しました${corrLabel}`
            : `戻りました${corrLabel}`;
    setToastMessage(msg);
    if (useCorrection) setCorrectionMode(false);
  };

  const todayPunches = records.filter((r) => r.date === getTodayDateStr());
  const today = getTodayDateStr();
  const selectedEmployeeClockInCount = records.filter(
    (r) => r.date === today && r.employee === selectedEmployee && r.type === "clock_in"
  ).length;
  const selectedEmployeeClockOutCount = records.filter(
    (r) => r.date === today && r.employee === selectedEmployee && r.type === "clock_out"
  ).length;
  const selectedEmployeeGoOutCount = records.filter(
    (r) => r.date === today && r.employee === selectedEmployee && r.type === "go_out"
  ).length;
  const selectedEmployeeGoBackCount = records.filter(
    (r) => r.date === today && r.employee === selectedEmployee && r.type === "go_back"
  ).length;
  const canClockIn = selectedEmployeeClockInCount === 0;
  const canClockOut = selectedEmployeeClockOutCount === 0;
  const canGoOut = selectedEmployeeGoOutCount === selectedEmployeeGoBackCount && selectedEmployeeClockInCount > 0 && selectedEmployeeClockOutCount === 0;
  const canGoBack = selectedEmployeeGoOutCount > selectedEmployeeGoBackCount;

  const hasPunchedToday =
    !!selectedEmployee &&
    records.some((r) => r.date === today && r.employee === selectedEmployee);

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "punch", label: "打刻", icon: <Clock className="w-6 h-6" /> },
    { id: "today", label: "今日", icon: <List className="w-6 h-6" /> },
  ];

  return (
    <main className="min-h-screen bg-slate-100 p-4 md:p-8 relative">
      {/* 打刻完了トースト（下部スナックバー風・2.5秒で消える） */}
      {toastMessage && (
        <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center pointer-events-none px-4 pb-8 md:pb-10">
          <div className="pointer-events-auto max-w-lg w-full bg-slate-900 text-white px-6 py-4 rounded-2xl text-xl font-medium text-center shadow-2xl border border-white/10">
            {toastMessage}
          </div>
        </div>
      )}

      <div className="max-w-3xl mx-auto">
        <header className="mb-10">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <AppBrandLogo />
            <span className="text-base font-medium text-slate-500">勤怠打刻</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">
            勤怠管理システム
          </h1>
        </header>

        {/* タブ（セグメント型） */}
        <div className="mb-8 flex gap-1 rounded-xl bg-slate-200/70 p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-4 px-4 text-base font-medium transition-all ${
                activeTab === tab.id
                  ? "bg-white text-slate-900 shadow-sm ring-1 ring-black/5"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* 打刻画面 */}
        {activeTab === "punch" && (
          <div className="space-y-8 rounded-2xl border border-slate-200/80 bg-white p-8 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">打刻</h2>
            <div>
              <p className="mb-4 block text-base font-medium text-slate-900">氏名を選択</p>
              <div className="grid grid-cols-2 gap-4">
                {employees.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setSelectedEmployee(e)}
                    className={`h-24 rounded-xl px-4 text-2xl font-semibold transition-all ${
                      selectedEmployee === e
                        ? "bg-slate-900 text-white shadow-md ring-2 ring-slate-400/60"
                        : "bg-slate-100 text-slate-800 hover:bg-slate-200"
                    }`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-5">
              {selectedEmployee && canClockIn && (
                <div className="col-span-2">
                  <Button
                    size="lg"
                    variant="success"
                    onClick={() => handlePunch("clock_in")}
                    disabled={!!toastMessage || !canClockIn}
                    className="h-28 text-2xl w-full"
                  >
                    <LogIn className="w-10 h-10" />
                    出勤
                  </Button>
                </div>
              )}
              {selectedEmployee && !canClockIn && canClockOut && (
                <div className="col-span-2">
                  <Button
                    size="lg"
                    variant="destructive"
                    onClick={() => handlePunch("clock_out")}
                    disabled={!!toastMessage || !canClockOut}
                    className="h-28 text-2xl w-full"
                  >
                    <LogOut className="w-10 h-10" />
                    退勤
                  </Button>
                </div>
              )}
              {selectedEmployee && !canClockIn && !canClockOut && (
                <div className="col-span-2 space-y-2 rounded-xl border border-slate-200/80 bg-slate-50 px-4 py-5 text-center">
                  <p className="text-base font-medium text-slate-700">
                    本日の出勤・退勤は完了しています
                  </p>
                  {hasPunchedToday && (
                    <p className="text-sm leading-snug text-slate-600">
                      打刻の追加や時刻の訂正は、<strong>下の「修正・追加」ボタン</strong>から行えます。
                    </p>
                  )}
                </div>
              )}
              <div>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => handlePunch("go_out")}
                  disabled={!selectedEmployee || !!toastMessage || !canGoOut}
                  className="h-24 text-xl w-full border-amber-400 text-amber-700 hover:bg-amber-50"
                >
                  <DoorOpen className="w-9 h-9" />
                  外出
                </Button>
                {selectedEmployee && !canGoOut && (
                  <p className="mt-1 text-sm text-amber-600">外出できる状態ではありません</p>
                )}
              </div>
              <div>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => handlePunch("go_back")}
                  disabled={!selectedEmployee || !!toastMessage || !canGoBack}
                  className="h-24 text-xl w-full border-blue-400 text-blue-700 hover:bg-blue-50"
                >
                  <DoorClosed className="w-9 h-9" />
                  戻り
                </Button>
                {selectedEmployee && !canGoBack && (
                  <p className="mt-1 text-sm text-slate-500">外出していません</p>
                )}
              </div>
            </div>
            {/* 修正・追加（全幅・視認性重視） */}
            {!correctionMode && (
              <div className="space-y-2 border-t border-slate-200/80 pt-5">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCorrectionMode(true)}
                  disabled={!selectedEmployee || !hasPunchedToday}
                  className="w-full min-h-16 text-lg font-semibold border-2 border-indigo-500 text-indigo-900 bg-indigo-50/60 hover:bg-indigo-100 hover:border-indigo-600 disabled:opacity-45 disabled:hover:bg-indigo-50/60"
                >
                  <Pencil className="w-6 h-6 shrink-0" />
                  修正・追加（時刻の訂正・打刻の追加）
                </Button>
                {selectedEmployee && !hasPunchedToday && (
                  <p className="text-center text-sm text-slate-600">
                    本日の打刻がある場合のみ利用できます（先に出勤などの打刻をしてください）
                  </p>
                )}
              </div>
            )}

            {/* 修正モード */}
            {correctionMode && hasPunchedToday && (
              <div className="space-y-5 rounded-xl border-2 border-amber-300/90 bg-amber-50 p-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-amber-800">修正モード</h3>
                  <button
                    type="button"
                    onClick={() => setCorrectionMode(false)}
                    className="text-base text-slate-500 hover:text-slate-800"
                  >
                    閉じる
                  </button>
                </div>
                <p className="text-base text-amber-700">
                  打刻忘れや時刻の修正ができます。種類と時刻を選んで登録してください。
                </p>
                <div>
                  <label className="mb-3 block text-base font-medium text-slate-900">種類</label>
                  <div className="grid grid-cols-2 gap-4">
                    <Button
                      size="lg"
                      variant="success"
                      onClick={() => handlePunch("clock_in", true)}
                      disabled={!selectedEmployee || !!toastMessage || !hasPunchedToday}
                      className="h-20 text-xl w-full"
                    >
                      <LogIn className="w-7 h-7" />
                      出勤
                    </Button>
                    <Button
                      size="lg"
                      variant="destructive"
                      onClick={() => handlePunch("clock_out", true)}
                      disabled={!selectedEmployee || !!toastMessage || !hasPunchedToday}
                      className="h-20 text-xl w-full"
                    >
                      <LogOut className="w-7 h-7" />
                      退勤
                    </Button>
                    <Button
                      size="lg"
                      variant="outline"
                      onClick={() => handlePunch("go_out", true)}
                      disabled={!selectedEmployee || !!toastMessage || !hasPunchedToday}
                      className="h-20 text-xl w-full border-amber-400 text-amber-700 hover:bg-amber-50"
                    >
                      <DoorOpen className="w-7 h-7" />
                      外出
                    </Button>
                    <Button
                      size="lg"
                      variant="outline"
                      onClick={() => handlePunch("go_back", true)}
                      disabled={!selectedEmployee || !!toastMessage || !hasPunchedToday}
                      className="h-20 text-xl w-full border-blue-400 text-blue-700 hover:bg-blue-50"
                    >
                      <DoorClosed className="w-7 h-7" />
                      戻り
                    </Button>
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-base font-medium text-slate-900">時刻</label>
                  <input
                    type="time"
                    value={correctionTime}
                    onChange={(e) => setCorrectionTime(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-xl text-slate-900"
                  />
                  <p className="text-sm text-amber-800/80 mt-2">
                    登録する時刻を指定してから、上の種類を押してください。
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 今日の一覧 */}
        {activeTab === "today" && (
          <div className="rounded-2xl border border-slate-200/80 bg-white p-8 shadow-sm">
            <h2 className="mb-5 text-xl font-semibold text-slate-900">
              今日の打刻一覧（{getTodayDateStr()}）
            </h2>
            {todayPunches.length === 0 ? (
              <p className="text-base text-slate-500">本日の打刻はまだありません</p>
            ) : (
              <div className="space-y-1">
                {todayPunches
                  .sort((a, b) => {
                    const nameCmp = a.employee.localeCompare(b.employee, "ja");
                    if (nameCmp !== 0) return nameCmp;
                    return (
                      new Date(a.timestamp).getTime() -
                      new Date(b.timestamp).getTime()
                    );
                  })
                  .map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center justify-between border-b border-slate-100 py-3 last:border-0"
                    >
                      <span className="text-lg font-medium text-slate-900">{r.employee}</span>
                      <span
                        className={`text-lg font-semibold ${
                          r.type === "clock_in"
                            ? "text-green-600"
                            : r.type === "clock_out"
                              ? "text-red-600"
                              : r.type === "go_out"
                                ? "text-amber-600"
                                : "text-blue-600"
                        }`}
                      >
                        {r.type === "clock_in"
                          ? "出勤"
                          : r.type === "clock_out"
                            ? "退勤"
                            : r.type === "go_out"
                              ? "外出"
                              : "戻り"}{" "}
                        {r.timestamp.slice(11, 16)}
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
