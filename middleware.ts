import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * `/admin` のみ Basic 認証（環境変数 ADMIN_BASIC_AUTH が `ユーザー名:パスワード` のとき有効）。
 * 未設定なら開発用にそのまま通す。打刻トップ `/` は開いたまま。
 */
export function middleware(request: NextRequest) {
  const raw = process.env.ADMIN_BASIC_AUTH?.trim();
  if (!raw) return NextResponse.next();

  const colon = raw.indexOf(":");
  if (colon <= 0) return NextResponse.next();

  const expectedUser = raw.slice(0, colon);
  const expectedPass = raw.slice(colon + 1);
  if (!expectedPass) return NextResponse.next();

  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Basic ")) {
    return unauthorized();
  }
  let decoded: string;
  try {
    decoded = atob(auth.slice(6));
  } catch {
    return unauthorized();
  }
  const d = decoded.indexOf(":");
  if (d < 0) return unauthorized();
  const user = decoded.slice(0, d);
  const pass = decoded.slice(d + 1);
  if (user !== expectedUser || pass !== expectedPass) {
    return unauthorized();
  }
  return NextResponse.next();
}

function unauthorized() {
  return new NextResponse("認証が必要です（社長専用）。", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="FIT Attendance Admin"' },
  });
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
