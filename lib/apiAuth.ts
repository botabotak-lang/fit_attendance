import { NextRequest } from "next/server";

/** ATTENDANCE_API_KEY が設定されているとき、全 API で一致するヘッダを要求する */
export function rejectIfApiKeyInvalid(request: NextRequest): Response | null {
  const expected = process.env.ATTENDANCE_API_KEY;
  if (!expected) return null;
  const got = request.headers.get("x-attendance-api-key") ?? "";
  if (got !== expected) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
