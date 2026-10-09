import { Bookmark } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ActionButton } from "@/components/forms/action-button";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { AvailabilityDot, PageHeader, RatingSummary, VerifiedBadge } from "@/components/ui/misc";
import { toggleSavedSpecialistAction } from "@/lib/actions/buyer";
import { requireUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Saved specialists" };

export default async function SavedSpecialistsPage() {
  const user = await requireUser("/dashboard/buyer/saved");
  const supabase = await createSupabaseServerClient();
  const { data: saved } = await supabase.from("saved_specialists").select("specialist_id, created_at").eq("buyer_id", user.id).order("created_at", { ascending: false });
  const ids = (saved ?? []).map((row) => row.specialist_id);
  const [{ data: profiles }, { data: specialists }] = ids.length
    ? await Promise.all([
        supabase.from("profiles").select("id, username, full_name, avatar_path").in("id", ids),
        supabase.from("specialist_profiles").select("user_id, headline, availability_status, verification_status, rating_avg, rating_count").in("user_id", ids),
      ])
    : [{ data: [] }, { data: [] }];

  // Specialists who unpublished or were suspended disappear from RLS results.
  const rows = ids
    .map((id) => ({ profile: profiles?.find((p) => p.id === id), specialist: specialists?.find((s) => s.user_id === id) }))
    .filter((row): row is { profile: NonNullable<typeof row.profile>; specialist: NonNullable<typeof row.specialist> } => Boolean(row.profile && row.specialist));

  return (
    <>
      <PageHeader eyebrow="Hiring" title="Saved specialists" description="People you'd like to work with. Invite them to a task in one click." />
      {rows.length === 0 ? (
        <EmptyState
          icon={Bookmark}
          title="No saved specialists"
          description="Tap “Save” on a specialist's profile or gig to keep them here."
          action={
            <Button asChild variant="outline">
              <Link href="/specialists">Find specialists</Link>
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {rows.map(({ profile, specialist }) => (
            <li key={profile.id} className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-border bg-card p-5">
              <div className="flex items-start gap-3">
                <Avatar name={profile.full_name} path={profile.avatar_path} />
                <div className="min-w-0 flex-1">
                  <Link href={`/specialists/${profile.username}`} className="font-semibold hover:underline">
                    {profile.full_name}
                  </Link>
                  <p className="truncate text-sm text-muted-foreground">{specialist.headline}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <AvailabilityDot status={specialist.availability_status} />
                    <RatingSummary ratingAvg={specialist.rating_avg} ratingCount={specialist.rating_count} />
                    <VerifiedBadge status={specialist.verification_status} />
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm">
                  <Link href={`/dashboard/buyer/requirements/new?invite=${profile.username}`}>Invite to a task</Link>
                </Button>
                <ActionButton variant="ghost" size="sm" action={toggleSavedSpecialistAction.bind(null, profile.id, false)}>
                  Remove
                </ActionButton>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
