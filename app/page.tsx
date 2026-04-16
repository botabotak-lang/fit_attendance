"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Clock, List, LogOut, LogIn, DoorOpen, DoorClosed, Pencil } from "lucide-react";
import { PunchRecord, PunchType, STORAGE_KEY } from "@/lib/types";
import {
  getEmployees,
  EMPLOYEES_CHANGED_EVENT,
  EMPLOYEES_STORAGE_KEY,
} from "@/lib/employees";

type Tab = "punch" | "today";
const TOAST_DURATION_MS = 2500;

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
  const loadRecords = () => setRecords(getRecords());
  const loadEmployees = () => setEmployees(getEmployees());

  useEffect(() => {
    loadEmployees();
    loadRecords();
  }, []);

  useEffect(() => {
    loadRecords();
  }, [activeTab]);

  useEffect(() => {
    const onEmployeesChanged = () => {
      loadEmployees();
      if (typeof window === "undefined") return;
      const list = getEmployees();
      setSelectedEmployee((cur) => (cur && list.includes(cur) ? cur : ""));
    };
    window.addEventListener(EMPLOYEES_CHANGED_EVENT, onEmployeesChanged);
    const onStorage = (e: StorageEvent) => {
      if (e.key === EMPLOYEES_STORAGE_KEY) onEmployeesChanged();
    };
    window.addEventListener("storage", onStorage);
    const onFocus = () => loadEmployees();
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener(EMPLOYEES_CHANGED_EVENT, onEmployeesChanged);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
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
    if (correctionMode && !has) setCorrectionMode(false);
  }, [correctionMode, selectedEmployee, records]);

  const handlePunch = (type: PunchType, useCorrection = false) => {
    if (!selectedEmployee || !employees.includes(selectedEmployee) || toastMessage) return;
    if (useCorrection) {
      const todayStr = getTodayDateStr();
      const hasAnyToday = getRecords().some(
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
    const next = [...getRecords(), record];
    saveRecords(next);
    setRecords(next);
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
    { id: "punch", label: "打刻", icon: <Clock className="w-5 h-5" /> },
    { id: "today", label: "今日", icon: <List className="w-5 h-5" /> },
  ];

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-6 relative">
      {/* 打刻完了トースト（中央表示・2.5秒で消える） */}
      {toastMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="bg-gray-900 text-white px-8 py-4 rounded-xl text-xl font-medium shadow-lg">
            {toastMessage}
          </div>
        </div>
      )}

      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            勤怠管理システム
          </h1>
          <span />

        </div>

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
            <h2 className="text-lg font-semibold text-gray-900">打刻</h2>
            <div>
              <p className="block text-sm font-medium text-gray-900 mb-3">氏名を選択</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {employees.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setSelectedEmployee(e)}
                    className={`py-4 px-4 rounded-xl text-lg font-semibold transition-all ${
                      selectedEmployee === e
                        ? "bg-blue-600 text-white shadow-md ring-2 ring-blue-400"
                        : "bg-gray-100 text-gray-800 hover:bg-gray-200"
                    }`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {selectedEmployee && canClockIn && (
                <div className="col-span-2">
                  <Button
                    size="lg"
                    variant="success"
                    onClick={() => handlePunch("clock_in")}
                    disabled={!!toastMessage || !canClockIn}
                    className="h-20 text-xl w-full"
                  >
                    <LogIn className="w-8 h-8" />
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
                    className="h-20 text-xl w-full"
                  >
                    <LogOut className="w-8 h-8" />
                    退勤
                  </Button>
                </div>
              )}
              {selectedEmployee && !canClockIn && !canClockOut && (
                <div className="col-span-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-4 text-center">
                  <p className="text-sm font-medium text-gray-700">
                    本日の出勤・退勤は完了しています
                  </p>
                </div>
              )}
              <div>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => handlePunch("go_out")}
                  disabled={!selectedEmployee || !!toastMessage || !canGoOut}
                  className="h-20 text-xl w-full border-amber-400 text-amber-700 hover:bg-amber-50"
                >
                  <DoorOpen className="w-8 h-8" />
                  外出
                </Button>
                {selectedEmployee && !canGoOut && (
                  <p className="text-sm text-amber-600 mt-1">外出できる状態ではありません</p>
                )}
              </div>
              <div>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => handlePunch("go_back")}
                  disabled={!selectedEmployee || !!toastMessage || !canGoBack}
                  className="h-20 text-xl w-full border-blue-400 text-blue-700 hover:bg-blue-50"
                >
                  <DoorClosed className="w-8 h-8" />
                  戻り
                </Button>
                {selectedEmployee && !canGoBack && (
                  <p className="text-sm text-gray-500 mt-1">外出していません</p>
                )}
              </div>
            </div>
            {/* 修正ボタン */}
            {!correctionMode && (
              <div className="flex flex-col items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCorrectionMode(true)}
                  disabled={!selectedEmployee || !hasPunchedToday}
                  className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-gray-400"
                >
                  <Pencil className="w-4 h-4" />
                  修正・追加
                </button>
                {selectedEmployee && !hasPunchedToday && (
                  <p className="text-xs text-gray-500 text-center">
                    本日の打刻がある場合のみ修正できます（先に打刻してください）
                  </p>
                )}
              </div>
            )}

            {/* 修正モード */}
            {correctionMode && hasPunchedToday && (
              <div className="border-2 border-amber-300 rounded-xl p-4 bg-amber-50 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-amber-800">修正モード</h3>
                  <button
                    type="button"
                    onClick={() => setCorrectionMode(false)}
                    className="text-sm text-gray-500 hover:text-gray-800"
                  >
                    閉じる
                  </button>
                </div>
                <p className="text-sm text-amber-700">
                  打刻忘れや時刻の修正ができます。種類と時刻を選んで登録してください。
                </p>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">種類</label>
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      size="lg"
                      variant="success"
                      onClick={() => handlePunch("clock_in", true)}
                      disabled={!selectedEmployee || !!toastMessage || !hasPunchedToday}
                      className="h-14 text-base w-full"
                    >
                      <LogIn className="w-6 h-6" />
                      出勤
                    </Button>
                    <Button
                      size="lg"
                      variant="destructive"
                      onClick={() => handlePunch("clock_out", true)}
                      disabled={!selectedEmployee || !!toastMessage || !hasPunchedToday}
                      className="h-14 text-base w-full"
                    >
                      <LogOut className="w-6 h-6" />
                      退勤
                    </Button>
                    <Button
                      size="lg"
                      variant="outline"
                      onClick={() => handlePunch("go_out", true)}
                      disabled={!selectedEmployee || !!toastMessage || !hasPunchedToday}
                      className="h-14 text-base w-full border-amber-400 text-amber-700 hover:bg-amber-50"
                    >
                      <DoorOpen className="w-6 h-6" />
                      外出
                    </Button>
                    <Button
                      size="lg"
                      variant="outline"
                      onClick={() => handlePunch("go_back", true)}
                      disabled={!selectedEmployee || !!toastMessage || !hasPunchedToday}
                      className="h-14 text-base w-full border-blue-400 text-blue-700 hover:bg-blue-50"
                    >
                      <DoorClosed className="w-6 h-6" />
                      戻り
                    </Button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">時刻</label>
                  <input
                    type="time"
                    value={correctionTime}
                    onChange={(e) => setCorrectionTime(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 text-lg bg-white"
                  />
                  <p className="text-xs text-amber-800/80 mt-1">
                    登録する時刻を指定してから、上の種類を押してください。
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 今日の一覧 */}
        {activeTab === "today" && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
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
                      <span className="font-medium text-gray-900">{r.employee}</span>
                      <span
                        className={
                          r.type === "clock_in"
                            ? "text-green-600 font-semibold"
                            : r.type === "clock_out"
                              ? "text-red-600 font-semibold"
                              : r.type === "go_out"
                                ? "text-amber-600 font-semibold"
                                : "text-blue-600 font-semibold"
                        }
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
