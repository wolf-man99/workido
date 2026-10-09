import type * as React from "react";
import { Alert } from "@/components/ui/feedback";
import { Container } from "@/components/ui/misc";

/** Layout for legal placeholder pages. These MUST be reviewed by a lawyer before launch. */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <Container className="max-w-3xl py-12">
      <h1 className="font-display text-4xl font-bold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">Draft · last updated {updated}</p>
      <Alert tone="warning" title="Draft — pending legal review" className="mt-6">
        This page is a placeholder outline and is not legal advice or a binding policy. It must be reviewed and completed by qualified legal counsel
        before Workido processes real transactions.
      </Alert>
      <div className="mt-8 flex flex-col gap-6 text-ink-soft [&_h2]:mt-4 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-ink [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mt-1">
        {children}
      </div>
    </Container>
  );
}
