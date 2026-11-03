import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { getViewer } from "@/lib/viewer";

export default async function Home() {
  const { supabase, name, orgs } = await getViewer();
  // Row-level security returns only the fields this person may see.
  const { data: fields } = await supabase
    .from("fields")
    .select("id, name, units, is_sample, organizations(name)")
    .order("name");

  return (
    <main className="max-w-[1080px] mx-auto px-4 pt-5 pb-12 flex flex-col gap-5">
      <AppHeader name={name} org={orgs[0]} />
      <section className="flex flex-col gap-4">
        <h2 className="font-display font-bold text-xl">Fields</h2>
        {!fields?.length && <p className="text-muted">No fields have been shared with you yet.</p>}
        <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(280px,1fr))]">
          {fields?.map((f) => (
            <Link key={f.id} href={`/fields/${f.id}`} className="panel hover:border-accent">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display font-bold">{f.name}</h3>
                {f.is_sample && <span className="pill bg-warn-soft text-warn">Sample data</span>}
              </div>
              <p className="text-muted text-sm">
                {(f.organizations as unknown as { name: string }).name} · {f.units}
              </p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
