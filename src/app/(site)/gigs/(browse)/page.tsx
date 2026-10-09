import type { Metadata } from "next";
import { GigBrowser } from "@/components/marketplace/gig-browser";
import { Container, PageHeader } from "@/components/ui/misc";

export const metadata: Metadata = {
  title: "Explore gigs",
  description: "Fixed-scope professional services with transparent prices and delivery times.",
};

export default async function GigsPage(props: PageProps<"/gigs">) {
  const params = await props.searchParams;
  return (
    <Container className="flex flex-col gap-8 py-10">
      <PageHeader title="Explore gigs" description="Fixed scope, transparent prices and clear delivery times. Pick one and get started." />
      <GigBrowser path="/gigs" params={params} />
    </Container>
  );
}
