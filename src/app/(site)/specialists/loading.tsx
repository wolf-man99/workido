import { Skeleton } from "@/components/ui/feedback";
import { Container } from "@/components/ui/misc";

export default function SpecialistsLoading() {
  return (
    <Container className="flex flex-col gap-8 py-10" aria-busy="true" aria-label="Loading specialists">
      <Skeleton className="h-10 w-56" />
      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <Skeleton className="hidden h-96 lg:block" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-80" />
          ))}
        </div>
      </div>
    </Container>
  );
}
