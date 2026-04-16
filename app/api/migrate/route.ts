import { NextRequest } from "next/server";
import { rejectIfApiKeyInvalid } from "@/lib/apiAuth";
import { createServiceClient } from "@/lib/supabaseServer";
import { replaceEmployees, upsertPunches } from "@/lib/fitAttendanceDb";
import type { PunchRecord, PunchType } from "@/lib/types";

export const dynamic = "force-dynamic";

function isPunchType(t: string): t is PunchType {
  return (
    t === "clock_in" ||
    t === "clock_out" ||
    t === "go_out" ||
    t === "go_back"
  );
}

function isPunchRecord(v: unknown): v is PunchRecord {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.employee === "string" &&
    typeof o.type === "string" &&
    typeof o.timestamp === "string" &&
    typeof o.date === "string" &&
    isPunchType(o.type)
  );
}

export async function POST(request: NextRequest) {
  const denied = rejectIfApiKeyInvalid(request);
  if (denied) return denied;
  try {
    const body = (await request.json()) as {
      punches?: unknown;
      employeeNames?: unknown;
    };
    const punches = Array.isArray(body.punches)
      ? body.punches.filter(isPunchRecord)
      : [];
    const supabase = createServiceClient();
    if (punches.length > 0) {
      await upsertPunches(supabase, punches);
    }
    if (Array.isArray(body.employeeNames) && body.employeeNames.length > 0) {
      const names = body.employeeNames
        .filter((x): x is string => typeof x === "string")
        .map((s) => s.trim())
        .filter(Boolean);
      if (names.length > 0 && new Set(names).size === names.length) {
        await replaceEmployees(supabase, names);
      }
    }
    return Response.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    const status = msg.includes("未設定") ? 503 : 500;
    return Response.json({ error: msg }, { status });
  }
}
