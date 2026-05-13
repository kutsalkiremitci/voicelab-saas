import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "voicelab_session";
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type Me = {
  user: {
    id: string;
    role: "user" | "admin";
    status: "unverified" | "active" | "suspended";
  } | null;
};

async function resolveSession(sid: string): Promise<Me["user"]> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/auth/me`, {
      headers: { cookie: `${SESSION_COOKIE}=${sid}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { user?: Me["user"] };
    return body.user ?? null;
  } catch {
    return null;
  }
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const sid = req.cookies.get(SESSION_COOKIE)?.value;

  const isApp = pathname.startsWith("/app");
  const isAdmin = pathname.startsWith("/admin");
  if (!isApp && !isAdmin) return NextResponse.next();

  if (!sid) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  const user = await resolveSession(sid);
  if (!user) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user.status === "unverified") {
    return NextResponse.redirect(new URL("/verify-email", req.url));
  }
  if (user.status === "suspended") {
    return NextResponse.redirect(new URL("/login?suspended=1", req.url));
  }
  if (isAdmin && user.role !== "admin") {
    return NextResponse.redirect(new URL("/app", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*", "/admin/:path*"],
};
