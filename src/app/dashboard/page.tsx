import { Briefcase } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Alert } from "@/components/ui/feedback";
import { SubmitButton } from "@/components/ui/submit-button";
import { becomeSpecialistAction } from "@/lib/actions/profile";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardIndex(props: PageProps<"/dashboard">) {
  const user = await requireUser("/dashboard");
  const searchParams = await props.searchParams;

  if (searchParams.enable === "specialist" && !user.isSpecialist) {
    return (
      <Card className="max-w-2xl">
        <CardContent className="flex flex-col gap-4">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-sun-soft">
            <Briefcase className="size-6" aria-hidden />
          </span>
          <h1 className="font-display text-2xl font-bold">Offer your skills on Workido</h1>
          <p className="text-ink-soft">
            Set up a specialist profile, publish services with clear prices, and get invited to tasks that match your skills. Your hiring
            dashboard stays exactly as it is.
          </p>
          {searchParams.error ? <Alert tone="danger">Something went wrong. Please try again.</Alert> : null}
          <form action={becomeSpecialistAction}>
            <SubmitButton pendingLabel="Setting up…">Set up specialist tools</SubmitButton>
          </form>
        </CardContent>
      </Card>
    );
  }

  redirect(user.isSpecialist && !user.isBuyer ? "/dashboard/specialist" : "/dashboard/buyer");
}
