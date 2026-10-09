import { BadgeCheck, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ReasonAction } from "@/components/admin/admin-forms";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/misc";
import { reviewVerificationAction } from "@/lib/actions/admin";
import { requireAdmin } from "@/lib/auth/session";
import { EXPERIENCE_LABELS, formatDateTime } from "@/lib/format";
import { publicStorageUrl } from "@/lib/storage/public-url";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Verification" };

export default async function VerificationQueuePage() {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const { data: requests } = await supabase
    .from("verification_requests")
    .select("id, specialist_id, message, submitted_at")
    .eq("status", "pending")
    .order("submitted_at");
  const ids = (requests ?? []).map((request) => request.specialist_id);
  const [{ data: profiles }, { data: specialists }, { data: portfolio }, { data: skills }] = ids.length
    ? await Promise.all([
        supabase.from("profiles").select("id, username, full_name, avatar_path, website_url").in("id", ids),
        supabase.from("specialist_profiles").select("user_id, headline, professional_bio, experience_level, years_experience").in("user_id", ids),
        supabase.from("portfolio_items").select("id, specialist_id, title, asset_path, external_url").in("specialist_id", ids),
        supabase.from("specialist_skills").select("specialist_id, skills(name)").in("specialist_id", ids),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }];

  return (
    <>
      <PageHeader title="Verification queue" description="Review profile and portfolio evidence. The verified badge appears only after you approve." />
      {(requests ?? []).length === 0 ? (
        <EmptyState icon={BadgeCheck} title="No pending requests" description="New verification requests will appear here." />
      ) : (
        <ul className="flex flex-col gap-4">
          {(requests ?? []).map((request) => {
            const profile = profiles?.find((p) => p.id === request.specialist_id);
            const specialist = specialists?.find((s) => s.user_id === request.specialist_id);
            const items = (portfolio ?? []).filter((item) => item.specialist_id === request.specialist_id);
            const skillNames = (skills ?? []).filter((row) => row.specialist_id === request.specialist_id).map((row) => row.skills?.name).filter(Boolean);
            return (
              <li key={request.id} className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-border bg-card p-5">
                <div className="flex flex-wrap items-start gap-3">
                  <Avatar name={profile?.full_name ?? "?"} path={profile?.avatar_path} size="lg" />
                  <div className="min-w-0 flex-1">
                    <Link href={`/admin/users/${request.specialist_id}`} className="font-display text-lg font-bold hover:underline">
                      {profile?.full_name}
                    </Link>
                    <p className="text-sm text-ink-soft">{specialist?.headline}</p>
                    <p className="text-xs text-muted-foreground">
                      Submitted {formatDateTime(request.submitted_at)}
                      {specialist?.experience_level ? ` · ${EXPERIENCE_LABELS[specialist.experience_level]}` : ""}
                      {specialist?.years_experience !== null && specialist?.years_experience !== undefined ? ` · ${specialist.years_experience} yrs` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <ReasonAction
                      label="Approve"
                      title="Approve verification?"
                      description="The specialist will get a public Verified badge."
                      reasonLabel="Internal note"
                      optional
                      confirmLabel="Approve"
                      action={reviewVerificationAction.bind(null, request.id, true)}
                    />
                    <ReasonAction
                      variant="outline"
                      label="Reject"
                      title="Reject verification?"
                      description="Explain what's missing. The specialist will see this reason."
                      minLength={10}
                      confirmLabel="Reject"
                      tone="danger"
                      action={reviewVerificationAction.bind(null, request.id, false)}
                    />
                  </div>
                </div>
                {request.message ? <p className="rounded-2xl bg-mist/60 p-3 text-sm">“{request.message}”</p> : null}
                {specialist?.professional_bio ? <p className="line-clamp-4 whitespace-pre-line text-sm text-ink-soft">{specialist.professional_bio}</p> : null}
                <div className="flex flex-wrap gap-1">
                  {skillNames.map((name) => (
                    <Badge key={name}>{name}</Badge>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {items.map((item) =>
                    item.asset_path ? (
                      <a key={item.id} href={publicStorageUrl("portfolio", item.asset_path)} target="_blank" rel="noopener noreferrer" className="overflow-hidden rounded-xl border border-border">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={publicStorageUrl("portfolio", item.asset_path)} alt={item.title} className="aspect-[16/10] w-full object-cover" />
                      </a>
                    ) : (
                      <a key={item.id} href={item.external_url ?? "#"} target="_blank" rel="noopener noreferrer nofollow" className="flex aspect-[16/10] items-center justify-center gap-1 rounded-xl border border-border bg-mist p-2 text-center text-xs font-semibold">
                        {item.title} <ExternalLink className="size-3" aria-hidden />
                      </a>
                    ),
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
