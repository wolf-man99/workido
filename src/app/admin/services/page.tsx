import type { Metadata } from "next";
import Link from "next/link";
import { ReasonAction } from "@/components/admin/admin-forms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/misc";
import { moderateServiceAction } from "@/lib/actions/admin";
import { requireAdmin } from "@/lib/auth/session";
import { formatMoney } from "@/lib/domain/money";
import { formatDate } from "@/lib/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { escapeLikeForFilter } from "@/lib/validation/search";

export const metadata: Metadata = { title: "Listings" };

const STATUS_TONES = { draft: "neutral", published: "success", unpublished: "warning", removed: "danger" } as const;

export default async function AdminServicesPage(props: PageProps<"/admin/services">) {
  await requireAdmin();
  const params = await props.searchParams;
  const q = typeof params.q === "string" ? params.q.slice(0, 80) : "";
  const status = ["draft", "published", "unpublished", "removed"].includes(String(params.status)) ? (params.status as keyof typeof STATUS_TONES) : undefined;

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("services")
    .select("id, slug, title, price_minor, currency, publication_status, moderation_note, updated_at, specialist:specialist_profiles!services_specialist_id_fkey(profiles(full_name, username))")
    .order("updated_at", { ascending: false })
    .limit(100);
  if (q) query = query.ilike("title", `%${escapeLikeForFilter(q)}%`);
  if (status) query = query.eq("publication_status", status);
  const { data: services, error } = await query;
  if (error) throw new Error("Could not load listings");

  return (
    <>
      <PageHeader title="Listings" description="Moderate service listings. Removed listings can't be republished by their owner." />
      <form method="get" className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-border bg-card p-4 sm:flex-row">
        <Input name="q" type="search" defaultValue={q} placeholder="Search titles" aria-label="Search listings" className="sm:flex-1" />
        <Select name="status" defaultValue={status ?? ""} aria-label="Status" className="sm:w-44">
          <option value="">Any status</option>
          <option value="published">Published</option>
          <option value="unpublished">Unpublished</option>
          <option value="draft">Draft</option>
          <option value="removed">Removed</option>
        </Select>
        <Button type="submit">Filter</Button>
      </form>
      <ul className="flex flex-col gap-2">
        {(services ?? []).map((service) => (
          <li key={service.id} className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-border bg-card p-4 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                {service.publication_status === "published" ? (
                  <Link href={`/gigs/${service.slug}`} className="font-semibold hover:underline">
                    {service.title}
                  </Link>
                ) : (
                  <span className="font-semibold">{service.title}</span>
                )}
                <Badge tone={STATUS_TONES[service.publication_status]} className="capitalize">
                  {service.publication_status}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {service.specialist?.profiles?.full_name} · {formatMoney(service.price_minor, service.currency)} · updated {formatDate(service.updated_at)}
              </p>
              {service.moderation_note ? <p className="text-xs text-danger">Note: {service.moderation_note}</p> : null}
            </div>
            {service.publication_status === "removed" ? (
              <ReasonAction
                variant="outline"
                size="sm"
                label="Restore"
                title="Restore this listing?"
                description="It returns as unpublished; the owner can then republish it."
                confirmLabel="Restore"
                action={moderateServiceAction.bind(null, service.id, false)}
              />
            ) : (
              <ReasonAction
                variant="outline"
                size="sm"
                label="Remove"
                title="Remove this listing?"
                description="The listing is hidden immediately and the specialist is notified with your reason."
                confirmLabel="Remove listing"
                tone="danger"
                action={moderateServiceAction.bind(null, service.id, true)}
              />
            )}
          </li>
        ))}
        {(services ?? []).length === 0 ? <p className="text-sm text-muted-foreground">No listings found.</p> : null}
      </ul>
    </>
  );
}
