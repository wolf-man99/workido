import type { Metadata } from "next";
import { RequirementWizard } from "@/components/forms/requirement-wizard";
import { Alert } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/misc";
import { requireActiveUser } from "@/lib/auth/session";
import { listCategories } from "@/lib/data/marketplace";
import { skillOptions } from "@/lib/data/options";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { emptyRequirement } from "@/lib/validation/requirement";

export const metadata: Metadata = { title: "Post a task" };

export default async function NewRequirementPage(props: PageProps<"/dashboard/buyer/requirements/new">) {
  const user = await requireActiveUser("/dashboard/buyer/requirements/new");
  const searchParams = await props.searchParams;
  const inviteUsername = typeof searchParams.invite === "string" ? searchParams.invite.toLowerCase().slice(0, 30) : null;

  const [categories, skills] = await Promise.all([listCategories(), skillOptions()]);

  let invite: { username: string; fullName: string } | undefined;
  let inviteProblem: string | null = null;
  if (inviteUsername) {
    const supabase = await createSupabaseServerClient();
    const { data: profile } = await supabase.from("profiles").select("id, username, full_name").eq("username", inviteUsername).maybeSingle();
    if (!profile) inviteProblem = "We couldn't find that specialist.";
    else if (profile.id === user.id) inviteProblem = "You can't invite yourself.";
    else invite = { username: profile.username, fullName: profile.full_name };
  }

  return (
    <>
      <PageHeader title="Post a task" description="Describe what you need. We'll match you with a small shortlist of suitable, available specialists." />
      {inviteProblem ? <Alert tone="warning">{inviteProblem}</Alert> : null}
      <RequirementWizard
        defaults={emptyRequirement}
        categories={categories.map((c) => ({ id: c.id, name: c.name, parentId: c.parent_id }))}
        skills={skills}
        attachments={[]}
        invite={invite}
      />
    </>
  );
}
