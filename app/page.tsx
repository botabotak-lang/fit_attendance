"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Clock, List, FileSpreadsheet, Trash2, LogOut, LogIn, DoorOpen, DoorClosed } from "lucide-react";
import Link from "next/link";
import { EMPLOYEES, PunchRecord, PunchType, STORAGE_KEY } from "@/lib/types";

type Tab = "punch" | "today";
const TOAST_DURATION_MS = 2500;
const NOON_HOUR = 12; // 午前/午後の境界（12:00）

function getTodayDateStr() {
  return new Date().toISOString().slice(0, 10);
}

function isMorning() {
  return new Date().getHours() < NOON_HOUR;
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
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const loadRecords = () => setRecords(getRecords());

  useEffect(() => {
    loadRecords();
  }, [activeTab]);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  const handlePunch = (type: PunchType) => {
    if (!selectedEmployee || !EMPLOYEES.includes(selectedEmployee as any) || toastMessage) return;
    if (type === "clock_in" && !canClockIn) return;
    if (type === "clock_out" && !canClockOut) return;
    if (type === "go_out" && !canGoOut) return;
    if (type === "go_back" && !canGoBack) return;
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    const timestamp = `${dateStr}T${timeStr}`;
    const record: PunchRecord = {
      id: `${now.getTime()}-${Math.random().toString(36).slice(2)}`,
      employee: selectedEmployee as any,
      type,
      timestamp,
      date: dateStr,
    };
    const next = [...getRecords(), record];
    saveRecords(next);
    setRecords(next);
    const msg =
      type === "clock_in"
        ? "出勤しました"
        : type === "clock_out"
          ? "退勤しました"
          : type === "go_out"
            ? "外出しました"
            : "戻りました";
    setToastMessage(msg);
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

  const handleDelete = (id: string) => {
    if (!confirm("この打刻を削除しますか？")) return;
    const next = getRecords().filter((r) => r.id !== id);
    saveRecords(next);
    setRecords(next);
  };

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
          <Link
            href="/admin"
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 text-sm"
          >
            <FileSpreadsheet className="w-5 h-5" />
            月次集計
          </Link>
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
                {EMPLOYEES.map((e) => (
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
              {isMorning() && (
                <div className="col-span-2">
                  <Button
                    size="lg"
                    variant="success"
                    onClick={() => handlePunch("clock_in")}
                    disabled={!selectedEmployee || !!toastMessage || !canClockIn}
                    className="h-20 text-xl w-full"
                  >
                    <LogIn className="w-8 h-8" />
                    出勤
                  </Button>
                  {selectedEmployee && !canClockIn && (
                    <p className="text-sm text-amber-600 mt-1">本日はすでに出勤済みです</p>
                  )}
                </div>
              )}
              {!isMorning() && (
                <div className="col-span-2">
                  <Button
                    size="lg"
                    variant="destructive"
                    onClick={() => handlePunch("clock_out")}
                    disabled={!selectedEmployee || !!toastMessage || !canClockOut}
                    className="h-20 text-xl w-full"
                  >
                    <LogOut className="w-8 h-8" />
                    退勤
                  </Button>
                  {selectedEmployee && !canClockOut && (
                    <p className="text-sm text-amber-600 mt-1">本日はすでに退勤済みです</p>
                  )}
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
            <p className="text-sm text-gray-500">
              入り口のiPadまたはスマホで打刻できます。
            </p>
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
                      <span className="font-medium">{r.employee}</span>
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
        )}
      </div>
    </main>
  );
}
