import { redirect } from "next/navigation";
import type { Role } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";


// Who is signed in, and which organizations they belong to.
export async function getViewer() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: memberships }] = await Promise.all([
    supabase.from("profiles").select("full_name, email").eq("id", user.id).maybeSingle(),
    supabase.from("memberships").select("role, organizations(id, name, kind)").eq("user_id", user.id),
  ]);

  const orgs = (memberships ?? []).map((m) => {
    const org = m.organizations as unknown as { id: string; name: string; kind: "operator" | "lender" };
    return { ...org, role: m.role as Role };
  });

  return { supabase, user, name: profile?.full_name ?? user.email ?? "Signed in", orgs };
}
