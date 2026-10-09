import type { Metadata } from "next";
import { AvailabilityForm } from "@/components/forms/specialist-forms";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { requireSpecialist } from "@/lib/auth/session";
import { getMySpecialistWorkspace } from "@/lib/data/specialist";

export const metadata: Metadata = { title: "Availability" };

export default async function AvailabilityPage() {
  const user = await requireSpecialist();
  const { profile } = await getMySpecialistWorkspace(user.id);
  return (
    <>
      <PageHeader
        eyebrow="Selling"
        title="Availability"
        description="Keep this accurate. Matching favours specialists who can actually deliver on time."
      />
      <Card>
        <CardContent>
          <AvailabilityForm current={profile?.availability_status ?? "available"} />
        </CardContent>
      </Card>
    </>
  );
}
