import type { Metadata } from "next";
import Link from "next/link";
import { DeleteAccount } from "@/components/forms/delete-account";
import { AvatarForm, PreferencesForm, ProfileForm } from "@/components/forms/settings-forms";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { SubmitButton } from "@/components/ui/submit-button";
import { becomeSpecialistAction, enableBuyerAction } from "@/lib/actions/profile";
import { requireUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Account settings" };

export default async function SettingsPage() {
  const user = await requireUser("/dashboard/settings");
  const supabase = await createSupabaseServerClient();
  const [{ data: profile }, { data: settings }, { data: deletionBlocker }] = await Promise.all([
    supabase.from("profiles").select("full_name, username, bio, city, region, country_code, website_url").eq("id", user.id).single(),
    supabase.from("user_settings").select("email_notifications, marketing_emails, whatsapp_opt_in, phone").eq("user_id", user.id).single(),
    supabase.rpc("account_deletion_blocker"),
  ]);

  return (
    <>
      <PageHeader title="Account settings" description="Manage your public profile, contact preferences and roles." />

      <Card>
        <CardHeader>
          <CardTitle>Profile photo</CardTitle>
          <CardDescription>JPG, PNG or WebP up to 2 MB.</CardDescription>
        </CardHeader>
        <CardContent>
          <AvatarForm userId={user.id} name={user.fullName} avatarPath={user.avatarPath} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Public profile</CardTitle>
          <CardDescription>Your email address is never shown publicly.</CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm
            defaults={{
              fullName: profile?.full_name ?? "",
              username: profile?.username ?? "",
              bio: profile?.bio ?? "",
              city: profile?.city ?? "",
              region: profile?.region ?? "",
              countryCode: profile?.country_code ?? "",
              websiteUrl: profile?.website_url ?? "",
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contact preferences</CardTitle>
          <CardDescription>In-app notifications are always on.</CardDescription>
        </CardHeader>
        <CardContent>
          <PreferencesForm
            defaults={{
              emailNotifications: settings?.email_notifications ?? true,
              marketingEmails: settings?.marketing_emails ?? false,
              whatsappOptIn: settings?.whatsapp_opt_in ?? false,
              phone: settings?.phone ?? "",
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Roles</CardTitle>
          <CardDescription>You can hire and offer services from the same account.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {user.roles.map((role) => (
              <Badge key={role} tone={role === "admin" ? "dark" : "brand"} className="capitalize">
                {role}
              </Badge>
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            {!user.isSpecialist ? (
              <form action={becomeSpecialistAction}>
                <SubmitButton variant="outline" pendingLabel="Setting up…">
                  Become a specialist
                </SubmitButton>
              </form>
            ) : null}
            {!user.isBuyer ? (
              <form action={enableBuyerAction}>
                <SubmitButton variant="outline" pendingLabel="Enabling…">
                  Start hiring
                </SubmitButton>
              </form>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Security</CardTitle>
          <CardDescription>Signed in as {user.email ?? user.username}.</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/reset-password" className="text-sm font-semibold text-brand-text hover:underline">
            Change password
          </Link>
        </CardContent>
      </Card>

      <Card className="border-danger/30">
        <CardHeader>
          <CardTitle>Delete account</CardTitle>
          <CardDescription>Permanently delete your Workido account, whether you hire, work or both.</CardDescription>
        </CardHeader>
        <CardContent>
          <DeleteAccount blocker={deletionBlocker ?? null} />
        </CardContent>
      </Card>
    </>
  );
}
