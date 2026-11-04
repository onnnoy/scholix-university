"use client";

import { LogOut } from "lucide-react";
import { signOutAction } from "@/lib/auth/actions";

export function SignOutButton() {
  return (
    <form action={signOutAction} className="shrink-0">
      <button
        type="submit"
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
      >
        <LogOut size={16} aria-hidden="true" />
        <span>Sign out</span>
      </button>
    </form>
  );
}
