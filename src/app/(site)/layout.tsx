import Link from "next/link";
import { Brand } from "@/components/AppHeader";
import { PRODUCT_NAME } from "@/lib/brand";

const NAV = [
  { href: "/#how", label: "How it works" },
  { href: "/about", label: "About" },
  { href: "/pilot", label: "Pilot program" },
  { href: "/contact", label: "Contact" },
];

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-line bg-surface">
        <div className="max-w-[1080px] mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <Link href="/" aria-label={`${PRODUCT_NAME} home`}>
            <Brand />
          </Link>
          <nav className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-semibold">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="text-muted hover:text-ink">
                {n.label}
              </Link>
            ))}
            <Link href="/login" className="text-accent border border-accent rounded-md px-3 py-1.5">
              Sign in
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-line">
        <div className="max-w-[1080px] mx-auto px-4 py-6 flex flex-wrap justify-between gap-3 text-sm text-muted">
          <span>
            © {new Date().getFullYear()} {PRODUCT_NAME} (working name). In development.
          </span>
          <span className="flex gap-4">
            {NAV.slice(1).map((n) => (
              <Link key={n.href} href={n.href} className="hover:text-ink">
                {n.label}
              </Link>
            ))}
          </span>
        </div>
      </footer>
    </div>
  );
}
