import type { Metadata } from "next";
import { ServiceForm } from "@/components/forms/service-form";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { requireSpecialist } from "@/lib/auth/session";
import { categoryOptions } from "@/lib/data/options";
import { getMySpecialistWorkspace } from "@/lib/data/specialist";

export const metadata: Metadata = { title: "New service" };

export default async function NewServicePage() {
  const user = await requireSpecialist();
  const [categories, workspace] = await Promise.all([categoryOptions(), getMySpecialistWorkspace(user.id)]);
  return (
    <>
      <PageHeader eyebrow="Selling" title="Create a service" description="A clear scope and honest delivery time help buyers choose you." />
      <Card>
        <CardContent>
          <ServiceForm
            categories={categories}
            profilePublished={Boolean(workspace.profile?.is_published)}
            defaults={{
              title: "",
              categoryId: "",
              description: "",
              deliverables: "",
              buyerInstructions: "",
              price: "",
              deliveryValue: "2",
              deliveryUnit: "days",
              includedRevisions: "1",
              publish: true,
            }}
          />
        </CardContent>
      </Card>
    </>
  );
}
