import { BadgeCheck, Clock, Eye, EyeOff } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ActionButton } from "@/components/forms/action-button";
import { SpecialistProfileForm, VerificationRequestForm } from "@/components/forms/specialist-forms";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/misc";
import { setProfilePublishedAction } from "@/lib/actions/specialist";
import { requireSpecialist } from "@/lib/auth/session";
import { categoryOptions, skillOptions } from "@/lib/data/options";
import { getMySpecialistWorkspace } from "@/lib/data/specialist";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Profile & skills" };

export default async function SpecialistProfilePage() {
  const user = await requireSpecialist();
  const [workspace, skills, categories] = await Promise.all([getMySpecialistWorkspace(user.id), skillOptions(), categoryOptions()]);
  const profile = workspace.profile;
  if (!profile) {
    return <Alert tone="danger">Your specialist profile could not be loaded.</Alert>;
  }
  const verification = workspace.latestVerification;

  return (
    <>
      <PageHeader
        eyebrow="Selling"
        title="Profile & skills"
        description="This is what buyers see on your public profile and in match results."
        actions={
          profile.is_published ? (
            <Link href={`/specialists/${user.username}`} className="text-sm font-semibold text-brand-text hover:underline">
              View public profile
            </Link>
          ) : null
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Publication</CardTitle>
          <CardDescription>
            {profile.is_published
              ? `Published on ${formatDate(profile.published_at)}. Buyers can find you and your services.`
              : "Your profile is private. Complete the details below, then publish it."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ActionButton variant={profile.is_published ? "outline" : "primary"} action={setProfilePublishedAction.bind(null, !profile.is_published)}>
            {profile.is_published ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
            {profile.is_published ? "Unpublish profile" : "Publish profile"}
          </ActionButton>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Professional details</CardTitle>
        </CardHeader>
        <CardContent>
          <SpecialistProfileForm
            skillOptions={skills}
            categoryOptions={categories}
            defaults={{
              headline: profile.headline ?? "",
              professionalBio: profile.professional_bio ?? "",
              experienceLevel: profile.experience_level ?? "",
              yearsExperience: profile.years_experience === null ? "" : String(profile.years_experience),
              skillIds: workspace.skillIds,
              categoryIds: workspace.categoryIds,
            }}
          />
        </CardContent>
      </Card>

      <Card id="verification">
        <CardHeader>
          <CardTitle>Verification</CardTitle>
          <CardDescription>
            Our team reviews your profile and portfolio. A verified badge is shown only after approval.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {profile.verification_status === "verified" ? (
            <Alert tone="success" title="You're verified">
              <span className="inline-flex items-center gap-1">
                <BadgeCheck className="size-4" aria-hidden /> Your verified badge is visible to buyers.
              </span>
            </Alert>
          ) : null}
          {profile.verification_status === "pending" ? (
            <Alert tone="info" title="Review in progress">
              <span className="inline-flex items-center gap-1">
                <Clock className="size-4" aria-hidden /> Submitted {formatDate(verification?.submitted_at)}. We&apos;ll notify you when it&apos;s reviewed.
              </span>
            </Alert>
          ) : null}
          {profile.verification_status === "rejected" ? (
            <Alert tone="warning" title="Verification not approved">
              {verification?.decision_note ?? "Please update your profile and portfolio and try again."}
            </Alert>
          ) : null}
          {profile.verification_status === "not_submitted" || profile.verification_status === "rejected" ? (
            profile.is_published && workspace.portfolioCount > 0 ? (
              <VerificationRequestForm />
            ) : (
              <p className="text-sm text-muted-foreground">
                Publish your profile and add at least one{" "}
                <Link href="/dashboard/specialist/portfolio" className="font-semibold text-brand-text hover:underline">
                  portfolio item
                </Link>{" "}
                to request verification.
              </p>
            )
          ) : null}
        </CardContent>
      </Card>
    </>
  );
}
