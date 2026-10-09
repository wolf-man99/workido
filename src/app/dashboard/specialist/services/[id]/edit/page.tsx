import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ServiceForm } from "@/components/forms/service-form";
import { Card, CardContent } from "@/components/ui/card";
import { Alert } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/misc";
import { requireSpecialist } from "@/lib/auth/session";
import { categoryOptions } from "@/lib/data/options";
import { getMyService, getMySpecialistWorkspace } from "@/lib/data/specialist";
import { minorToMajorInput } from "@/lib/domain/money";
import { fromHours } from "@/lib/validation/marketplace";

export const metadata: Metadata = { title: "Edit service" };

export default async function EditServicePage(props: PageProps<"/dashboard/specialist/services/[id]/edit">) {
  const { id } = await props.params;
  const user = await requireSpecialist();
  const [service, categories, workspace] = await Promise.all([getMyService(user.id, id), categoryOptions(), getMySpecialistWorkspace(user.id)]);
  if (!service) notFound();

  return (
    <>
      <PageHeader eyebrow="Selling" title="Edit service" description="Changes apply to new orders only — existing orders keep the scope they were bought with." />
      {service.publication_status === "removed" ? (
        <Alert tone="danger" title="Removed by moderation">
          {service.moderation_note ?? "This listing can no longer be edited."}
        </Alert>
      ) : (
        <Card>
          <CardContent>
            <ServiceForm
              serviceId={service.id}
              categories={categories}
              profilePublished={Boolean(workspace.profile?.is_published)}
              defaults={{
                title: service.title,
                categoryId: service.category_id,
                description: service.description,
                deliverables: service.deliverables,
                buyerInstructions: service.buyer_instructions ?? "",
                price: minorToMajorInput(service.price_minor, service.currency),
                ...fromHours(service.delivery_time_hours),
                includedRevisions: String(service.included_revisions),
                publish: service.publication_status === "published",
              }}
            />
          </CardContent>
        </Card>
      )}
    </>
  );
}
