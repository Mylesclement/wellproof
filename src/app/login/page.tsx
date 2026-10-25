"use client";

import { useActionState } from "react";
import { Brand } from "@/components/AppHeader";
import { signIn } from "./actions";

const DEMO_ACCOUNTS = [
  ["admin@sample-operator.example", "Operator admin"],
  ["staff@sample-operator.example", "Operator staff"],
  ["lender@sample-lender.example", "Lender viewer"],
];

export default function LoginPage() {
  const [error, action, pending] = useActionState(signIn, null);
  return (
    <main className="max-w-md mx-auto px-4 py-16 flex flex-col gap-6">
      <div>
        <Brand />
        <p className="text-muted mt-1">A verified production record that lenders and partners can trust.</p>
      </div>
      <form action={action} className="panel">
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Email
          <input className="input" name="email" type="email" autoComplete="email" required />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Password
          <input className="input" name="password" type="password" autoComplete="current-password" required />
        </label>
        {error && (
          <p role="alert" className="text-bad text-sm">
            {error}
          </p>
        )}
        <button className="btn" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
      {process.env.NODE_ENV !== "production" && (
        <div className="text-sm text-muted">
          <p className="label mb-1">Local demo accounts (password: wellproof-demo)</p>
          <ul className="font-mono">
            {DEMO_ACCOUNTS.map(([email, role]) => (
              <li key={email}>
                {email} <span className="font-sans">· {role}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}
