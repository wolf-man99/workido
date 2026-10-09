import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { SiteHeader } from "@/components/layout/site-header";
import { Alert } from "@/components/ui/feedback";
import { requireUser } from "@/lib/auth/session";

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const user = await requireUser("/dashboard");
  return (
    <>
      <SiteHeader />
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row lg:gap-10 lg:px-8 lg:py-10">
        <DashboardNav isSpecialist={user.isSpecialist} />
        <main id="main" className="flex min-w-0 flex-1 flex-col gap-6">
          {user.accountStatus !== "active" ? (
            <Alert tone="danger" title="Your account is suspended">
              You can view your history, but you can&apos;t post tasks, place orders or send messages. Contact support if you think this is a
              mistake.
            </Alert>
          ) : null}
          {children}
        </main>
      </div>
    </>
  );
}
