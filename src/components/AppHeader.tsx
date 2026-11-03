import Link from "next/link";
import { PRODUCT } from "@/lib/brand";
import { ROLE_LABEL, type Role } from "@/lib/roles";

export function Brand() {
  return (
    <span className="font-display font-extrabold text-3xl tracking-tight">
      {PRODUCT.first}
      <span className="text-crude">{PRODUCT.second}</span>
    </span>
  );
}

export function AppHeader({ name, org }: { name: string; org?: { name: string; role: Role } }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2">
      <Link href="/fields" aria-label="Your fields">
        <Brand />
      </Link>
      <div className="flex items-center gap-4 text-sm">
        <div className="text-right">
          <div className="font-semibold">{name}</div>
          {org && (
            <div className="text-muted">
              {org.name} · {ROLE_LABEL[org.role]}
            </div>
          )}
        </div>
        <form action="/auth/signout" method="post">
          <button className="text-accent font-semibold border border-accent rounded-md px-3 py-1.5 cursor-pointer">Sign out</button>
        </form>
      </div>
    </header>
  );
}

export function SampleBanner() {
  return (
    <div className="bg-warn-soft text-warn rounded-md px-3 py-2 text-sm font-semibold">
      Demo with invented sample data. Not real operator figures.
    </div>
  );
}
