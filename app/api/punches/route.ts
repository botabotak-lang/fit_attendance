import { NextRequest } from "next/server";
import { rejectIfApiKeyInvalid } from "@/lib/apiAuth";
import { createServiceClient } from "@/lib/supabaseServer";
import {
  deletePunch,
  insertPunch,
  listPunches,
  updatePunch,
  upsertPunches,
} from "@/lib/fitAttendanceDb";
import type { PunchRecord, PunchType } from "@/lib/types";

export const dynamic = "force-dynamic";

function isPunchRecord(v: unknown): v is PunchRecord {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.employee === "string" &&
    typeof o.type === "string" &&
    typeof o.timestamp === "string" &&
    typeof o.date === "string"
  );
}

function isPunchType(t: string): t is PunchType {
  return (
    t === "clock_in" ||
    t === "clock_out" ||
    t === "go_out" ||
    t === "go_back"
  );
}

export async function GET(request: NextRequest) {
  const denied = rejectIfApiKeyInvalid(request);
  if (denied) return denied;
  try {
    const supabase = createServiceClient();
    const records = await listPunches(supabase);
    return Response.json({ records });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    const status = msg.includes("未設定") ? 503 : 500;
    return Response.json({ error: msg }, { status });
  }
}

export async function POST(request: NextRequest) {
  const denied = rejectIfApiKeyInvalid(request);
  if (denied) return denied;
  try {
    const body: unknown = await request.json();
    if (!isPunchRecord(body) || !isPunchType(body.type)) {
      return Response.json({ error: "Invalid punch body" }, { status: 400 });
    }
    const supabase = createServiceClient();
    await insertPunch(supabase, body);
    return Response.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    const status = msg.includes("未設定") ? 503 : 500;
    return Response.json({ error: msg }, { status });
  }
}

export async function PUT(request: NextRequest) {
  const denied = rejectIfApiKeyInvalid(request);
  if (denied) return denied;
  try {
    const body = (await request.json()) as { records?: unknown };
    if (!Array.isArray(body.records)) {
      return Response.json({ error: "records array required" }, { status: 400 });
    }
    const records = body.records.filter(isPunchRecord).filter((r) => isPunchType(r.type));
    const supabase = createServiceClient();
    await upsertPunches(supabase, records);
    return Response.json({ ok: true, count: records.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    const status = msg.includes("未設定") ? 503 : 500;
    return Response.json({ error: msg }, { status });
  }
}

export async function PATCH(request: NextRequest) {
  const denied = rejectIfApiKeyInvalid(request);
  if (denied) return denied;
  try {
    const body: unknown = await request.json();
    if (!isPunchRecord(body) || !isPunchType(body.type)) {
      return Response.json({ error: "Invalid punch body" }, { status: 400 });
    }
    const supabase = createServiceClient();
    await updatePunch(supabase, body);
    return Response.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    const status = msg.includes("未設定") ? 503 : 500;
    return Response.json({ error: msg }, { status });
  }
}

export async function DELETE(request: NextRequest) {
  const denied = rejectIfApiKeyInvalid(request);
  if (denied) return denied;
  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return Response.json({ error: "id query required" }, { status: 400 });
  }
  try {
    const supabase = createServiceClient();
    await deletePunch(supabase, id);
    return Response.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    const status = msg.includes("未設定") ? 503 : 500;
    return Response.json({ error: msg }, { status });
  }
}
