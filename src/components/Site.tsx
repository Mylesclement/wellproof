// Small building blocks shared by the public pages.

export function Section({ id, children, tint }: { id?: string; children: React.ReactNode; tint?: boolean }) {
  return (
    <section id={id} className={`scroll-mt-4 ${tint ? "bg-surface border-y border-line" : ""}`}>
      <div className="max-w-[1080px] mx-auto px-4 py-12 flex flex-col gap-6">{children}</div>
    </section>
  );
}

export function Heading({ eyebrow, title, lead }: { eyebrow?: string; title: string; lead?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 max-w-[68ch]">
      {eyebrow && <span className="label text-crude">{eyebrow}</span>}
      <h2 className="font-display font-bold text-2xl sm:text-3xl tracking-tight text-balance">{title}</h2>
      {lead && <p className="text-muted text-lg">{lead}</p>}
    </div>
  );
}

export function Card({ title, children, n }: { title: string; children: React.ReactNode; n?: number }) {
  return (
    <div className="panel">
      <h3 className="font-display font-bold flex items-baseline gap-2">
        {n != null && <span className="font-mono text-crude">{n}</span>}
        {title}
      </h3>
      <div className="text-muted flex flex-col gap-2">{children}</div>
    </div>
  );
}

export const grid = "grid gap-4 grid-cols-[repeat(auto-fit,minmax(240px,1fr))]";
