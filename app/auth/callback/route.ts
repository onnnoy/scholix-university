import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const requestedNext = requestUrl.searchParams.get("next") ?? "/admin/dashboard";
  let safeNext = "/admin/dashboard";
  try {
    const parsedNext = new URL(requestedNext, requestUrl.origin);
    if (parsedNext.origin === requestUrl.origin) {
      safeNext = `${parsedNext.pathname}${parsedNext.search}${parsedNext.hash}`;
    }
  } catch {
    // Keep the trusted default destination for malformed redirect input.
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(safeNext, requestUrl.origin));
  }

  return NextResponse.redirect(new URL("/login?error=auth_callback", requestUrl.origin));
}
