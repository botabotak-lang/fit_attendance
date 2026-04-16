import { NextRequest } from "next/server";
import { rejectIfApiKeyInvalid } from "@/lib/apiAuth";
import { createServiceClient } from "@/lib/supabaseServer";
import {
  applyEmployeeRenamesOnPunches,
  listEmployeeNames,
  replaceEmployees,
} from "@/lib/fitAttendanceDb";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const denied = rejectIfApiKeyInvalid(request);
  if (denied) return denied;
  try {
    const supabase = createServiceClient();
    const names = await listEmployeeNames(supabase);
    return Response.json({ names });
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
    const body = (await request.json()) as {
      names?: unknown;
      prevNames?: unknown;
    };
    if (!Array.isArray(body.names)) {
      return Response.json({ error: "names array required" }, { status: 400 });
    }
    const names = body.names
      .filter((x): x is string => typeof x === "string")
      .map((s) => s.trim())
      .filter(Boolean);
    if (names.length === 0) {
      return Response.json({ error: "names must not be empty" }, { status: 400 });
    }
    if (new Set(names).size !== names.length) {
      return Response.json({ error: "duplicate names" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const prev =
      Array.isArray(body.prevNames) &&
      body.prevNames.length === names.length &&
      body.prevNames.every((x): x is string => typeof x === "string")
        ? (body.prevNames as string[]).map((s) => s.trim())
        : null;

    if (prev && prev.length === names.length) {
      await applyEmployeeRenamesOnPunches(supabase, prev, names);
    }
    await replaceEmployees(supabase, names);
    return Response.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    const status = msg.includes("未設定") ? 503 : 500;
    return Response.json({ error: msg }, { status });
  }
}
