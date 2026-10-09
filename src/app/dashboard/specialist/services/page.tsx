import { Pencil, Plus, Store, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ActionButton } from "@/components/forms/action-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/misc";
import { deleteServiceAction, setServicePublishedAction } from "@/lib/actions/specialist";
import { requireSpecialist } from "@/lib/auth/session";
import { listMyServices } from "@/lib/data/specialist";
import { formatMoney } from "@/lib/domain/money";
import { formatDeliveryTime } from "@/lib/format";

export const metadata: Metadata = { title: "My services" };

const STATUS = {
  draft: { label: "Draft", tone: "neutral" },
  published: { label: "Published", tone: "success" },
  unpublished: { label: "Unpublished", tone: "warning" },
  removed: { label: "Removed by moderation", tone: "danger" },
} as const;

export default async function ServicesPage() {
  const user = await requireSpecialist();
  const services = await listMyServices(user.id);

  return (
    <>
      <PageHeader
        eyebrow="Selling"
        title="My services"
        description="Fixed-scope gigs buyers can purchase directly."
        actions={
          <Button asChild>
            <Link href="/dashboard/specialist/services/new">
              <Plus aria-hidden /> New service
            </Link>
          </Button>
        }
      />
      {services.length === 0 ? (
        <EmptyState
          icon={Store}
          title="No services yet"
          description="Package what you do best into a clear scope, price and delivery time."
          action={
            <Button asChild>
              <Link href="/dashboard/specialist/services/new">Create your first service</Link>
            </Button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {services.map((service) => {
            const status = STATUS[service.publication_status];
            return (
              <li key={service.id} className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-border bg-card p-4 sm:flex-row sm:items-center sm:p-5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-display font-bold">{service.title}</p>
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {service.categories?.name} · {formatMoney(service.price_minor, service.currency)} · {formatDeliveryTime(service.delivery_time_hours)} ·{" "}
                    {service.included_revisions} revision{service.included_revisions === 1 ? "" : "s"}
                  </p>
                  {service.publication_status === "removed" && service.moderation_note ? (
                    <p className="mt-1 text-sm text-danger">Reason: {service.moderation_note}</p>
                  ) : null}
                </div>
                {service.publication_status !== "removed" ? (
                  <div className="flex flex-wrap gap-2">
                    {service.publication_status === "published" ? (
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/gigs/${service.slug}`}>View</Link>
                      </Button>
                    ) : null}
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/dashboard/specialist/services/${service.id}/edit`}>
                        <Pencil aria-hidden /> Edit
                      </Link>
                    </Button>
                    <ActionButton variant="outline" size="sm" action={setServicePublishedAction.bind(null, service.id, service.publication_status !== "published")}>
                      {service.publication_status === "published" ? "Unpublish" : "Publish"}
                    </ActionButton>
                    <ActionButton
                      variant="ghost"
                      size="sm"
                      aria-label={`Delete ${service.title}`}
                      action={deleteServiceAction.bind(null, service.id)}
                      confirm={{
                        title: "Delete this service?",
                        description: "Services that have been ordered can't be deleted — unpublish them instead.",
                        confirmLabel: "Delete",
                        tone: "danger",
                      }}
                    >
                      <Trash2 aria-hidden />
                    </ActionButton>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
