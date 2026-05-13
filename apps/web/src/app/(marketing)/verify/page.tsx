import { redirect } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export default async function VerifyTokenPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  if (!token) {
    redirect("/verify-email?error=missing-token");
  }

  const res = await fetch(`${API_BASE}/api/v1/auth/verify?token=${encodeURIComponent(token)}`, {
    redirect: "manual",
    cache: "no-store",
  });

  const location = res.headers.get("location");
  if (location) {
    const url = new URL(location);
    redirect(url.pathname + url.search);
  }
  redirect("/verify-email?error=invalid-or-expired");
}
