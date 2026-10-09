import { MessageSquareQuote } from "lucide-react";
import { StarRow } from "@/components/ui/misc";
import { formatDate } from "@/lib/format";
import { shortName } from "@/lib/utils";

export interface ReviewView {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  reviewer: { full_name: string } | null;
}

/** Reviews come only from completed orders; reviewers are shown as "First L." */
export function ReviewList({ reviews, emptyText = "No reviews yet. Reviews appear after completed orders." }: { reviews: ReviewView[]; emptyText?: string }) {
  if (reviews.length === 0) {
    return (
      <p className="flex items-center gap-2 rounded-2xl bg-mist/70 p-4 text-sm text-muted-foreground">
        <MessageSquareQuote className="size-4" aria-hidden /> {emptyText}
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-3">
      {reviews.map((review) => (
        <li key={review.id} className="rounded-2xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <StarRow rating={review.rating} />
            <span className="text-xs text-muted-foreground">
              {review.reviewer ? shortName(review.reviewer.full_name) : "Buyer"} · {formatDate(review.created_at)} · Verified order
            </span>
          </div>
          {review.comment ? <p className="mt-2 text-sm leading-relaxed text-ink-soft">{review.comment}</p> : null}
        </li>
      ))}
    </ul>
  );
}
