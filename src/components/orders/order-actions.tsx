"use client";

import { Flag, Link2, Paperclip, Send, Star, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { FileUpload } from "@/components/forms/file-upload";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { FormField } from "@/components/ui/form-field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/overlays";
import { PendingButton } from "@/components/ui/submit-button";
import {
  addDeliverableFileAction,
  addDeliverableLinkAction,
  addDisputeAttachmentAction,
  openDisputeAction,
  orderTransitionAction,
  removeDeliverableAction,
  reportAction,
  submitReviewAction,
} from "@/lib/actions/orders";
import type { ParticipantAction } from "@/lib/domain/orders/state-machine";
import { formatFileSize } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Order status change, optionally collecting a note in a dialog first. */
export function TransitionButton({
  orderId,
  action,
  label,
  dialog,
  ...buttonProps
}: Omit<ButtonProps, "onClick" | "action"> & {
  orderId: string;
  action: ParticipantAction;
  label: string;
  dialog?: { title: string; description: string; noteLabel?: string; notePlaceholder?: string; minNote?: number; confirmLabel: string; tone?: "danger" };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = () =>
    startTransition(async () => {
      setError(null);
      if (dialog?.minNote && note.trim().length < dialog.minNote) {
        setError(`Please write at least ${dialog.minNote} characters.`);
        return;
      }
      const result = await orderTransitionAction(orderId, action, note || undefined);
      if (!result.ok) {
        setError(result.error);
        if (!dialog) toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Updated");
      setOpen(false);
      setNote("");
      router.refresh();
    });

  if (!dialog) {
    return (
      <PendingButton pending={pending} onClick={run} {...buttonProps}>
        {label}
      </PendingButton>
    );
  }

  return (
    <>
      <Button {...buttonProps} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title={dialog.title} description={dialog.description}>
          <div className="flex flex-col gap-4">
            {dialog.noteLabel ? (
              <FormField id={`note-${action}`} label={dialog.noteLabel} optional={!dialog.minNote}>
                {(field) => <Textarea {...field} rows={4} maxLength={2000} value={note} placeholder={dialog.notePlaceholder} onChange={(event) => setNote(event.target.value)} />}
              </FormField>
            ) : null}
            {error ? <Alert tone="danger">{error}</Alert> : null}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <DialogClose asChild>
                <Button variant="outline">Back</Button>
              </DialogClose>
              <PendingButton variant={dialog.tone === "danger" ? "danger" : "primary"} pending={pending} onClick={run}>
                {dialog.confirmLabel}
              </PendingButton>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export interface PendingDeliverable {
  id: string;
  kind: string;
  filename: string;
  size_bytes: number | null;
  external_url: string | null;
}

/** Specialist workspace: add files/links, then submit them as a delivery. */
export function DeliverableManager({ orderId, pending: drafts, isRevision }: { orderId: string; pending: PendingDeliverable[]; isRevision: boolean }) {
  const router = useRouter();
  const [linkUrl, setLinkUrl] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold">Upload files</span>
          <FileUpload
            purpose="deliverable"
            folder={`${orderId}/deliverables`}
            label="Add a deliverable file"
            onUploaded={async ({ path, file }) => {
              const result = await addDeliverableFileAction(orderId, { path, filename: file.name });
              if (result.ok) router.refresh();
              return result;
            }}
          />
        </div>
        <form
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            startTransition(async () => {
              const result = await addDeliverableLinkAction(orderId, { url: linkUrl, label: linkLabel || "Deliverable link" });
              if (result.ok) {
                setLinkUrl("");
                setLinkLabel("");
                toast.success(result.message ?? "Added");
                router.refresh();
              } else toast.error(result.fieldErrors?.url ?? result.error);
            });
          }}
        >
          <span className="text-sm font-semibold">Or share a link</span>
          <Input aria-label="Link URL" type="url" placeholder="https://drive.google.com/…" value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} />
          <Input aria-label="Link label" placeholder="Label, e.g. Final files (Figma)" value={linkLabel} maxLength={255} onChange={(event) => setLinkLabel(event.target.value)} />
          <Button type="submit" variant="outline" size="sm" disabled={busy || !linkUrl} className="self-start">
            <Link2 aria-hidden /> Add link
          </Button>
        </form>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-semibold">Ready to deliver ({drafts.length})</span>
        {drafts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing added yet. Add at least one file or link.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {drafts.map((item) => (
              <li key={item.id} className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm">
                {item.kind === "link" ? <Link2 className="size-4 text-ink/50" aria-hidden /> : <Paperclip className="size-4 text-ink/50" aria-hidden />}
                <span className="min-w-0 flex-1 truncate">{item.filename}</span>
                {item.size_bytes ? <span className="text-xs text-muted-foreground">{formatFileSize(item.size_bytes)}</span> : null}
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${item.filename}`}
                  onClick={() =>
                    startTransition(async () => {
                      const result = await removeDeliverableAction(item.id);
                      if (result.ok) router.refresh();
                      else toast.error(result.error);
                    })
                  }
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <form
        className="flex flex-col gap-3 rounded-2xl bg-mist/60 p-4"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          if (!message.trim()) {
            setError("Add a short delivery message for the buyer.");
            return;
          }
          startTransition(async () => {
            const result = await orderTransitionAction(orderId, "submit", message);
            if (!result.ok) {
              setError(result.error);
              return;
            }
            toast.success(result.message ?? "Submitted");
            setMessage("");
            router.refresh();
          });
        }}
      >
        <FormField id="delivery-message" label={isRevision ? "What did you change?" : "Delivery message"}>
          {(field) => (
            <Textarea {...field} rows={3} maxLength={4000} value={message} placeholder="Summarise what's included and how to use it." onChange={(event) => setMessage(event.target.value)} />
          )}
        </FormField>
        {error ? <Alert tone="danger">{error}</Alert> : null}
        <PendingButton type="submit" pending={busy} disabled={drafts.length === 0} className="self-start" pendingLabel="Submitting…">
          <Send aria-hidden /> {isRevision ? "Submit revision" : "Submit delivery"}
        </PendingButton>
      </form>
    </div>
  );
}

const DISPUTE_REASONS = [
  { value: "quality", label: "Quality doesn't match the agreed scope" },
  { value: "missed_deadline", label: "Delivery deadline missed" },
  { value: "scope_mismatch", label: "Disagreement about scope" },
  { value: "no_response", label: "The other party isn't responding" },
  { value: "payment", label: "Payment problem" },
  { value: "other", label: "Something else" },
] as const;

export function DisputeButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [disputeId, setDisputeId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <Flag aria-hidden /> Open a dispute
      </Button>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          setOpen(value);
          if (!value && disputeId) router.refresh();
        }}
      >
        <DialogContent title={disputeId ? "Dispute opened" : "Open a dispute"} description={disputeId ? "Add supporting files if you have them." : "Our team reviews the order history, messages and deliverables. Try messaging first if you can."}>
          {disputeId ? (
            <div className="flex flex-col gap-4">
              <FileUpload
                purpose="dispute"
                folder={`${orderId}/disputes`}
                label="Add supporting evidence (optional)"
                onUploaded={async ({ path, file }) => addDisputeAttachmentAction(disputeId, orderId, { path, filename: file.name })}
              />
              <DialogClose asChild>
                <Button>Done</Button>
              </DialogClose>
            </div>
          ) : (
            <form
              className="flex flex-col gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                startTransition(async () => {
                  setError(null);
                  const result = await openDisputeAction(orderId, { reason: reason as (typeof DISPUTE_REASONS)[number]["value"], description });
                  if (!result.ok) {
                    setError(result.fieldErrors?.reason ?? result.fieldErrors?.description ?? result.error);
                    return;
                  }
                  toast.success(result.message ?? "Dispute opened");
                  setDisputeId(result.data.disputeId);
                });
              }}
            >
              <FormField id="dispute-reason" label="Reason">
                {(field) => (
                  <Select {...field} value={reason} onChange={(event) => setReason(event.target.value)}>
                    <option value="">Choose a reason…</option>
                    {DISPUTE_REASONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                )}
              </FormField>
              <FormField id="dispute-description" label="What happened?" hint="Be specific: what was agreed, what was delivered, and what outcome you're asking for.">
                {(field) => <Textarea {...field} rows={5} maxLength={4000} value={description} onChange={(event) => setDescription(event.target.value)} />}
              </FormField>
              {error ? <Alert tone="danger">{error}</Alert> : null}
              <PendingButton type="submit" variant="danger" pending={pending} pendingLabel="Opening…">
                Open dispute
              </PendingButton>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ReviewForm({ orderId, revieweeName, isBuyer }: { orderId: string; revieweeName: string; isBuyer: boolean }) {
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (rating === 0) {
          setError("Choose a star rating.");
          return;
        }
        startTransition(async () => {
          setError(null);
          const result = await submitReviewAction(orderId, { rating, comment });
          if (!result.ok) {
            setError(result.error);
            return;
          }
          toast.success(result.message ?? "Thanks!");
          router.refresh();
        });
      }}
    >
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">How was working with {revieweeName}?</legend>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((value) => (
            <label key={value} className="cursor-pointer rounded-lg p-1 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ink">
              <input type="radio" name="rating" value={value} className="sr-only" checked={rating === value} onChange={() => setRating(value)} />
              <Star className={cn("size-8 transition-colors", value <= rating ? "fill-sun text-sun" : "text-ink/20 hover:text-sun")} aria-hidden />
              <span className="sr-only">
                {value} star{value === 1 ? "" : "s"}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <FormField id="review-comment" label="Your review" optional hint={isBuyer ? "Shown publicly on the specialist's profile with your first name and initial." : "Visible on the buyer's history."}>
        {(field) => <Textarea {...field} rows={4} maxLength={2000} value={comment} onChange={(event) => setComment(event.target.value)} />}
      </FormField>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <PendingButton type="submit" pending={pending} className="self-start" pendingLabel="Submitting…">
        Submit review
      </PendingButton>
    </form>
  );
}

const REPORT_REASONS = [
  { value: "spam", label: "Spam" },
  { value: "harassment", label: "Harassment or abuse" },
  { value: "fraud", label: "Fraud or scam" },
  { value: "off_platform_payment", label: "Asking to pay outside Workido" },
  { value: "inappropriate", label: "Inappropriate content" },
  { value: "other", label: "Something else" },
] as const;

export function ReportButton({ targetType, targetId, label = "Report", compact = false }: { targetType: "message" | "user" | "service"; targetId: string; label?: string; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<(typeof REPORT_REASONS)[number]["value"]>("spam");
  const [details, setDetails] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn("inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-danger", compact && "opacity-60 hover:opacity-100")}
        aria-label={compact ? `${label} this ${targetType}` : undefined}
      >
        <Flag className="size-3.5" aria-hidden /> {compact ? null : label}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title={`Report this ${targetType}`} description="Reports are confidential. Our team reviews every report.">
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              startTransition(async () => {
                const result = await reportAction({ targetType, targetId, reason, details });
                if (result.ok) {
                  toast.success(result.message ?? "Reported");
                  setOpen(false);
                  setDetails("");
                } else toast.error(result.error);
              });
            }}
          >
            <FormField id="report-reason" label="Reason">
              {(field) => (
                <Select {...field} value={reason} onChange={(event) => setReason(event.target.value as typeof reason)}>
                  {REPORT_REASONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              )}
            </FormField>
            <FormField id="report-details" label="Details" optional>
              {(field) => <Textarea {...field} rows={3} maxLength={2000} value={details} onChange={(event) => setDetails(event.target.value)} />}
            </FormField>
            <PendingButton type="submit" variant="danger" pending={pending}>
              Send report
            </PendingButton>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
