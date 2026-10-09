import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { RequirementWizard } from "@/components/forms/requirement-wizard";
import { PageHeader } from "@/components/ui/misc";
import { requireActiveUser } from "@/lib/auth/session";
import { listCategories } from "@/lib/data/marketplace";
import { skillOptions } from "@/lib/data/options";
import { getRequirementWizardData } from "@/lib/data/requirements";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Edit requirement" };

export default async function EditRequirementPage(props: PageProps<"/dashboard/buyer/requirements/[id]/edit">) {
  const { id } = await props.params;
  const user = await requireActiveUser(`/dashboard/buyer/requirements/${id}/edit`);
  const searchParams = await props.searchParams;
  const [data, categories, skills] = await Promise.all([getRequirementWizardData(id, user.id), listCategories(), skillOptions()]);
  if (!data) notFound();
  if (data.status !== "draft" && data.status !== "open") redirect(`/dashboard/buyer/requirements/${id}`);

  let invite: { username: string; fullName: string } | undefined;
  if (typeof searchParams.invite === "string") {
    const supabase = await createSupabaseServerClient();
    const { data: profile } = await supabase.from("profiles").select("id, username, full_name").eq("username", searchParams.invite.toLowerCase()).maybeSingle();
    if (profile && profile.id !== user.id) invite = { username: profile.username, fullName: profile.full_name };
  }

  return (
    <>
      <PageHeader
        title={data.status === "draft" ? "Finish your task" : "Edit requirement"}
        description={data.status === "open" ? "Saving changes re-runs matching. Specialists you already invited keep their invitations." : "Pick up where you left off."}
      />
      <RequirementWizard
        requirementId={id}
        status={data.status}
        defaults={data.defaults}
        categories={categories.map((c) => ({ id: c.id, name: c.name, parentId: c.parent_id }))}
        skills={skills}
        attachments={data.attachments}
        invite={invite}
      />
    </>
  );
}
