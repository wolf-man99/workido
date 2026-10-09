import type { Metadata } from "next";
import { AdminNav } from "@/components/admin/admin-nav";
import { SiteHeader } from "@/components/layout/site-header";
import { requireAdmin } from "@/lib/auth/session";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin · Workido" }, robots: { index: false, follow: false } };

/** Admin area: returns 404 for anyone who isn't an active administrator. */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireAdmin();
  return (
    <>
      <SiteHeader />
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-ink px-3 py-1 text-xs font-bold uppercase tracking-wider text-cream">Admin</span>
        </div>
        <AdminNav />
        <main id="main" className="flex min-w-0 flex-col gap-6">
          {children}
        </main>
      </div>
    </>
  );
}
