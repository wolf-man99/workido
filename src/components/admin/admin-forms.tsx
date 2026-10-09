"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { FormField } from "@/components/ui/form-field";
import { Checkbox, Input, Select, Textarea } from "@/components/ui/input";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/overlays";
import { PendingButton } from "@/components/ui/submit-button";
import { markPayoutAction, resolveDisputeAction, saveCategoryAction, type CategoryInput } from "@/lib/actions/admin";
import type { ActionResult } from "@/lib/actions/result";

/** Admin action that requires a written reason (recorded in the audit log). */
export function ReasonAction({
  action,
  label,
  title,
  description,
  minLength = 5,
  confirmLabel,
  tone,
  reasonLabel = "Reason",
  optional = false,
  ...buttonProps
}: Omit<ButtonProps, "action" | "onClick"> & {
  action: (reason: string) => Promise<ActionResult<unknown>>;
  label: string;
  title: string;
  description: string;
  minLength?: number;
  confirmLabel: string;
  tone?: "danger";
  reasonLabel?: string;
  optional?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <Button {...buttonProps} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title={title} description={description}>
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!optional && reason.trim().length < minLength) {
                setError(`Please write at least ${minLength} characters.`);
                return;
              }
              startTransition(async () => {
                setError(null);
                const result = await action(reason.trim());
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                toast.success(result.message ?? "Done");
                setOpen(false);
                setReason("");
                router.refresh();
              });
            }}
          >
            <FormField id={`reason-${title}`} label={reasonLabel} optional={optional}>
              {(field) => <Textarea {...field} rows={3} maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} />}
            </FormField>
            {error ? <Alert tone="danger">{error}</Alert> : null}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <PendingButton type="submit" variant={tone === "danger" ? "danger" : "primary"} pending={pending}>
                {confirmLabel}
              </PendingButton>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function DisputeResolver({ disputeId }: { disputeId: string }) {
  const router = useRouter();
  const [outcome, setOutcome] = useState<"complete_order" | "refund_buyer" | "resume_work">("resume_work");
  const [resolution, setResolution] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          const result = await resolveDisputeAction(disputeId, outcome, resolution);
          if (result.ok) {
            toast.success(result.message ?? "Resolved");
            router.refresh();
          } else toast.error(result.error);
        });
      }}
    >
      <FormField id={`outcome-${disputeId}`} label="Decision">
        {(field) => (
          <Select {...field} value={outcome} onChange={(event) => setOutcome(event.target.value as typeof outcome)}>
            <option value="resume_work">Resume work (back to in progress)</option>
            <option value="complete_order">Complete the order (specialist is paid out)</option>
            <option value="refund_buyer">Refund the buyer</option>
          </Select>
        )}
      </FormField>
      <FormField id={`resolution-${disputeId}`} label="Resolution notes" hint="Shared with both parties on the order.">
        {(field) => <Textarea {...field} rows={3} maxLength={4000} value={resolution} onChange={(event) => setResolution(event.target.value)} />}
      </FormField>
      <PendingButton type="submit" pending={pending} className="self-start" disabled={resolution.trim().length < 10}>
        Record decision
      </PendingButton>
    </form>
  );
}

export function PayoutForm({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [reference, setReference] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          const result = await markPayoutAction(orderId, reference);
          if (result.ok) {
            toast.success(result.message ?? "Recorded");
            setReference("");
            router.refresh();
          } else toast.error(result.error);
        });
      }}
    >
      <Input aria-label="Settlement reference" placeholder="Bank / UTR reference" value={reference} maxLength={200} className="h-9 w-48" onChange={(event) => setReference(event.target.value)} />
      <PendingButton type="submit" size="sm" variant="outline" pending={pending} disabled={reference.trim().length < 3}>
        Mark paid out
      </PendingButton>
    </form>
  );
}

export function CategoryForm({
  categoryId,
  defaults,
  parents,
  iconKeys,
  onDone,
}: {
  categoryId: string | null;
  defaults: CategoryInput;
  parents: { id: string; name: string }[];
  iconKeys: string[];
  onDone?: () => void;
}) {
  const router = useRouter();
  const [values, setValues] = useState(defaults);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const set = <K extends keyof CategoryInput>(key: K, value: CategoryInput[K]) => setValues((current) => ({ ...current, [key]: value }));

  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          setError(null);
          const result = await saveCategoryAction(categoryId, values);
          if (!result.ok) {
            setError(result.fieldErrors ? Object.values(result.fieldErrors).join(" ") : result.error);
            return;
          }
          toast.success(result.message ?? "Saved");
          if (!categoryId) setValues(defaults);
          onDone?.();
          router.refresh();
        });
      }}
    >
      <FormField id={`name-${categoryId ?? "new"}`} label="Name">
        {(field) => <Input {...field} value={values.name} maxLength={60} onChange={(event) => set("name", event.target.value)} />}
      </FormField>
      <FormField id={`slug-${categoryId ?? "new"}`} label="Slug" hint="Used in URLs; changing it breaks old links.">
        {(field) => <Input {...field} value={values.slug} maxLength={60} onChange={(event) => set("slug", event.target.value)} />}
      </FormField>
      <FormField id={`description-${categoryId ?? "new"}`} label="Description" optional className="sm:col-span-2">
        {(field) => <Input {...field} value={values.description} maxLength={300} onChange={(event) => set("description", event.target.value)} />}
      </FormField>
      <FormField id={`parent-${categoryId ?? "new"}`} label="Parent">
        {(field) => (
          <Select {...field} value={values.parentId} onChange={(event) => set("parentId", event.target.value)}>
            <option value="">None (top level)</option>
            {parents
              .filter((parent) => parent.id !== categoryId)
              .map((parent) => (
                <option key={parent.id} value={parent.id}>
                  {parent.name}
                </option>
              ))}
          </Select>
        )}
      </FormField>
      <FormField id={`icon-${categoryId ?? "new"}`} label="Icon">
        {(field) => (
          <Select {...field} value={values.icon} onChange={(event) => set("icon", event.target.value)}>
            <option value="">Default</option>
            {iconKeys.map((key) => (
              <option key={key} value={key}>
                {key}
              </option>
            ))}
          </Select>
        )}
      </FormField>
      <FormField id={`sort-${categoryId ?? "new"}`} label="Sort order">
        {(field) => <Input {...field} inputMode="numeric" value={String(values.sortOrder)} onChange={(event) => set("sortOrder", event.target.value)} />}
      </FormField>
      <label className="flex items-center gap-2 self-end pb-2 text-sm font-semibold">
        <Checkbox checked={values.isActive} onChange={(event) => set("isActive", event.target.checked)} /> Active
      </label>
      {error ? <Alert tone="danger" className="sm:col-span-2">{error}</Alert> : null}
      <div className="sm:col-span-2">
        <PendingButton type="submit" size="sm" pending={pending}>
          {categoryId ? "Save category" : "Create category"}
        </PendingButton>
      </div>
    </form>
  );
}
