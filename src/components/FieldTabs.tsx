import Link from "next/link";

export function FieldTabs({ fieldId, active }: { fieldId: string; active: "readings" | "record" }) {
  const tabs = [
    { key: "readings", href: `/fields/${fieldId}`, label: "Readings", n: 1 },
    { key: "record", href: `/fields/${fieldId}/record`, label: "Record and trust score", n: 2 },
  ];
  return (
    <nav className="flex gap-1.5 flex-wrap border-b border-line">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={t.key === active ? "page" : undefined}
          className={`font-semibold px-3 py-2.5 border-b-[3px] ${t.key === active ? "text-ink border-accent" : "text-muted border-transparent"}`}
        >
          <b className="font-mono text-crude mr-1.5">{t.n}</b>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
