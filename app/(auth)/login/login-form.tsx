"use client";

import { useActionState } from "react";
import { BookOpenCheck, LoaderCircle, LockKeyhole, Mail } from "lucide-react";
import { loginAction, type LoginState } from "./actions";

const initialState: LoginState = {};

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, initialState);

  return (
    <form action={action} className="space-y-4">
      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-slate-600">Email address</span>
        <span className="flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-100">
          <Mail size={15} className="text-slate-400" />
          <input name="email" type="email" autoComplete="email" required placeholder="you@university.edu" className="w-full bg-transparent text-sm outline-none placeholder:text-slate-300" />
        </span>
      </label>
      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-slate-600">Password</span>
        <span className="flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-100">
          <LockKeyhole size={15} className="text-slate-400" />
          <input name="password" type="password" autoComplete="current-password" required placeholder="Enter your password" className="w-full bg-transparent text-sm outline-none placeholder:text-slate-300" />
        </span>
      </label>
      {state.error ? <p role="alert" className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-700">{state.error}</p> : null}
      <button disabled={pending} className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#4ab875] text-sm font-semibold text-white shadow-sm transition hover:bg-[#3da868] disabled:cursor-not-allowed disabled:opacity-70">
        {pending ? <LoaderCircle size={16} className="animate-spin" /> : <BookOpenCheck size={16} />}
        {pending ? "Signing in…" : "Sign in to Scholix"}
      </button>
    </form>
  );
}
