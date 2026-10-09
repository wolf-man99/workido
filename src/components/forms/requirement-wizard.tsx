"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Check, CircleCheck, Paperclip, Plus, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { FormField } from "@/components/ui/form-field";
import { Checkbox, Input, Select, Textarea } from "@/components/ui/input";
import { PendingButton } from "@/components/ui/submit-button";
import {
  addRequirementAttachmentAction,
  removeRequirementAttachmentAction,
  saveRequirementDraftAction,
  submitRequirementAction,
} from "@/lib/actions/requirements";
import type { ActionResult } from "@/lib/actions/result";
import { formatBudgetRange, parseMajorToMinor } from "@/lib/domain/money";
import { EXPERIENCE_LABELS, URGENCY_LABELS, formatFileSize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { STEP_FIELDS, requirementSchema, type RequirementInput } from "@/lib/validation/requirement";
import { ChipPicker, type ChipOption } from "./chip-picker";
import { FileUpload } from "./file-upload";

export interface WizardCategory {
  id: string;
  name: string;
  parentId: string | null;
}

export interface WizardAttachment {
  id: string;
  filename: string;
  sizeBytes: number;
}

const STEPS = [
  { key: "describe", label: "Describe" },
  { key: "scope", label: "Scope" },
  { key: "preferences", label: "Preferences" },
  { key: "review", label: "Review" },
] as const;

function safeMinor(value: string): number | null {
  try {
    return value.trim() ? parseMajorToMinor(value) : null;
  } catch {
    return null;
  }
}

export function RequirementWizard({
  requirementId: initialId,
  status,
  defaults,
  categories,
  skills,
  attachments: initialAttachments,
  invite,
}: {
  requirementId?: string;
  status?: "draft" | "open";
  defaults: RequirementInput;
  categories: WizardCategory[];
  skills: ChipOption[];
  attachments: WizardAttachment[];
  invite?: { username: string; fullName: string };
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [requirementId, setRequirementId] = useState(initialId ?? null);
  const [attachments, setAttachments] = useState(initialAttachments);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [posted, setPosted] = useState<{ id: string; matches: number } | null>(null);
  const isOpen = status === "open";

  const form = useForm<RequirementInput, unknown, z.output<typeof requirementSchema>>({
    resolver: zodResolver(requirementSchema),
    defaultValues: defaults,
    mode: "onTouched",
  });
  const errors = form.formState.errors;

  const parents = categories.filter((category) => !category.parentId);
  const values = useWatch({ control: form.control }) as RequirementInput;
  const categoryId = values.categoryId;
  const children = categories.filter((category) => category.parentId === categoryId);
  const selectedSkills = values.skills ?? [];
  const skillLabels = useMemo(() => new Map(skills.map((skill) => [skill.id, skill.label])), [skills]);

  function applyFieldErrors(result: ActionResult<unknown>) {
    if (!result.ok && result.fieldErrors) {
      for (const [key, message] of Object.entries(result.fieldErrors)) {
        form.setError(key as keyof RequirementInput, { message });
      }
    }
  }

  async function saveDraft(silent = false): Promise<string | null> {
    const result = await saveRequirementDraftAction(requirementId, form.getValues());
    if (!result.ok) {
      applyFieldErrors(result);
      if (!silent) toast.error(result.error);
      return null;
    }
    // The URL deliberately stays the same (changing routes mid-wizard would
    // remount it); saved drafts are listed under "My requirements".
    if (!requirementId) setRequirementId(result.data.id);
    if (!silent) toast.success("Draft saved");
    return result.data.id;
  }

  async function next() {
    setError(null);
    const key = STEPS[step]?.key;
    if (key && key !== "review") {
      const valid = await form.trigger([...STEP_FIELDS[key]] as (keyof RequirementInput)[]);
      if (!valid) return;
    }
    // Save a draft after step 1 so files can be attached in step 2.
    if (step === 0 && !isOpen) {
      startTransition(async () => {
        const id = await saveDraft(true);
        if (id) setStep(1);
      });
      return;
    }
    setStep((current) => Math.min(current + 1, STEPS.length - 1));
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const valid = await form.trigger();
      if (!valid) {
        setError("Some details need attention. Go back to fix the highlighted fields.");
        return;
      }
      const result = await submitRequirementAction(requirementId, form.getValues(), invite?.username);
      if (!result.ok) {
        applyFieldErrors(result);
        setError(result.error);
        return;
      }
      if (isOpen) {
        toast.success("Requirement updated");
        router.push(`/dashboard/buyer/requirements/${result.data.id}`);
        router.refresh();
        return;
      }
      setPosted(result.data);
    });
  }

  if (posted) {
    return (
      <div className="flex flex-col items-start gap-5 rounded-3xl border border-border bg-card p-6 sm:p-8">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-mint-soft text-mint-text">
          <CircleCheck className="size-7" aria-hidden />
        </span>
        <div className="flex flex-col gap-2">
          <h2 className="font-display text-2xl font-bold">Your task is live</h2>
          <p className="text-ink-soft">
            {posted.matches > 0
              ? `We found ${posted.matches} suitable specialist${posted.matches === 1 ? "" : "s"} based on skills, category, availability, delivery time and budget.`
              : "We couldn't find a strong match right now. You can widen your requirements, browse specialists, or refresh matches later."}
          </p>
        </div>
        <ol className="flex flex-col gap-2 text-sm text-ink-soft">
          <li>1. Review your shortlist and invite the specialists you like{invite ? ` (${invite.fullName} has already been invited)` : ""}.</li>
          <li>2. Invited specialists send an offer with their price and timeline.</li>
          <li>3. Accept the offer that fits, pay securely, and work begins.</li>
        </ol>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href={`/dashboard/buyer/requirements/${posted.id}`}>
              Review your matches <ArrowRight aria-hidden />
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/specialists">Browse specialists</Link>
          </Button>
        </div>
      </div>
    );
  }

  const budgetMin = safeMinor(values.budgetMin);
  const budgetMax = safeMinor(values.budgetMax);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-6">
      {invite ? (
        <Alert tone="info">
          {invite.fullName} will be invited to this task automatically when you post it. Matching will also suggest others.
        </Alert>
      ) : null}

      <ol className="grid grid-cols-4 gap-2" aria-label="Progress">
        {STEPS.map((item, index) => (
          <li key={item.key} className="flex flex-col gap-1.5">
            <span className={cn("h-1.5 rounded-full", index <= step ? "bg-brand" : "bg-mist")} aria-hidden />
            <span className={cn("text-xs font-semibold", index === step ? "text-ink" : "text-muted-foreground")} aria-current={index === step ? "step" : undefined}>
              {index + 1}. {item.label}
            </span>
          </li>
        ))}
      </ol>

      <div className="rounded-3xl border border-border bg-card p-5 sm:p-7">
        {step === 0 ? (
          <div className="flex flex-col gap-5">
            <h2 className="font-display text-xl font-bold">What do you need done?</h2>
            <FormField id="title" label="Task title" hint="E.g. “8-slide Instagram carousel for a product launch”." error={errors.title?.message}>
              {(field) => <Input {...field} maxLength={120} {...form.register("title")} />}
            </FormField>
            <FormField id="description" label="Detailed description" hint="Context, goals, audience and anything the specialist must know." error={errors.description?.message}>
              {(field) => <Textarea {...field} rows={6} maxLength={5000} {...form.register("description")} />}
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="categoryId" label="Category" error={errors.categoryId?.message}>
                {(field) => (
                  <Select
                    {...field}
                    {...form.register("categoryId", {
                      onChange: () => form.setValue("subcategoryId", ""),
                    })}
                  >
                    <option value="">Choose…</option>
                    {parents.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </Select>
                )}
              </FormField>
              <FormField id="subcategoryId" label="Subcategory" optional>
                {(field) => (
                  <Select {...field} disabled={children.length === 0} {...form.register("subcategoryId")}>
                    <option value="">{children.length ? "Any" : "None available"}</option>
                    {children.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </Select>
                )}
              </FormField>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-sm font-semibold">
                Required skills <span className="font-normal text-muted-foreground">(optional)</span>
              </span>
              <Controller
                control={form.control}
                name="skills"
                render={({ field }) => (
                  <ChipPicker
                    id="skills"
                    label="Required skills"
                    searchable
                    max={10}
                    options={skills}
                    value={field.value.map((skill) => skill.skillId)}
                    onChange={(ids) =>
                      field.onChange(ids.map((id) => field.value.find((skill) => skill.skillId === id) ?? { skillId: id, mandatory: false }))
                    }
                  />
                )}
              />
              {selectedSkills.length > 0 ? (
                <div className="flex flex-col gap-2 rounded-2xl bg-mist/60 p-3">
                  <p className="text-xs text-muted-foreground">Mark must-have skills. Specialists without them won&apos;t be matched.</p>
                  {selectedSkills.map((skill, index) => (
                    <label key={skill.skillId} className="flex items-center gap-2 text-sm">
                      <Checkbox {...form.register(`skills.${index}.mandatory` as const)} />
                      Must have: <span className="font-semibold">{skillLabels.get(skill.skillId)}</span>
                    </label>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="flex flex-col gap-5">
            <h2 className="font-display text-xl font-bold">Define the scope</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="budgetMin" label="Minimum budget (₹)" optional error={errors.budgetMin?.message}>
                {(field) => <Input {...field} inputMode="decimal" placeholder="e.g. 1000" {...form.register("budgetMin")} />}
              </FormField>
              <FormField id="budgetMax" label="Maximum budget (₹)" error={errors.budgetMax?.message}>
                {(field) => <Input {...field} inputMode="decimal" placeholder="e.g. 3000" {...form.register("budgetMax")} />}
              </FormField>
              <FormField id="deadline" label="Delivery deadline" optional hint="Leave empty if you're flexible." error={errors.deadline?.message}>
                {(field) => <Input {...field} type="date" min={today} {...form.register("deadline")} />}
              </FormField>
              <div className="grid grid-cols-2 gap-3">
                <FormField id="quantity" label="Items / units" optional error={errors.quantity?.message}>
                  {(field) => <Input {...field} inputMode="numeric" placeholder="e.g. 4" {...form.register("quantity")} />}
                </FormField>
                <FormField id="revisionsExpected" label="Revisions" optional error={errors.revisionsExpected?.message}>
                  {(field) => <Input {...field} inputMode="numeric" placeholder="e.g. 1" {...form.register("revisionsExpected")} />}
                </FormField>
              </div>
            </div>
            <FormField id="deliverables" label="Expected deliverables" optional hint="Formats, sizes, number of files…" error={errors.deliverables?.message}>
              {(field) => <Textarea {...field} rows={3} maxLength={2000} {...form.register("deliverables")} />}
            </FormField>
            <div className="flex flex-col gap-2">
              <span className="text-sm font-semibold">
                Reference links <span className="font-normal text-muted-foreground">(optional)</span>
              </span>
              <Controller
                control={form.control}
                name="referenceLinks"
                render={({ field }) => <LinkListEditor value={field.value} onChange={field.onChange} />}
              />
              {errors.referenceLinks ? <p className="text-xs font-medium text-danger">{errors.referenceLinks.message ?? "Check your links"}</p> : null}
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-sm font-semibold">
                Attachments <span className="font-normal text-muted-foreground">(optional · brand kits, briefs, examples)</span>
              </span>
              {attachments.length > 0 ? (
                <ul className="flex flex-col gap-2">
                  {attachments.map((attachment) => (
                    <li key={attachment.id} className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm">
                      <Paperclip className="size-4 text-ink/50" aria-hidden />
                      <span className="min-w-0 flex-1 truncate">{attachment.filename}</span>
                      <span className="text-xs text-muted-foreground">{formatFileSize(attachment.sizeBytes)}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove ${attachment.filename}`}
                        onClick={async () => {
                          const result = await removeRequirementAttachmentAction(attachment.id);
                          if (result.ok) setAttachments((list) => list.filter((item) => item.id !== attachment.id));
                          else toast.error(result.error);
                        }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {requirementId ? (
                <FileUpload
                  purpose="requirement"
                  folder={requirementId}
                  label="Add a file"
                  onUploaded={async ({ path, file }) => {
                    const result = await addRequirementAttachmentAction(requirementId, { path, filename: file.name });
                    if (result.ok) setAttachments((list) => [...list, { id: result.data.id, filename: file.name, sizeBytes: file.size }]);
                    return result;
                  }}
                />
              ) : null}
              <p className="text-xs text-muted-foreground">Files are private: only you and specialists you invite can open them.</p>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="flex flex-col gap-5">
            <h2 className="font-display text-xl font-bold">Matching preferences</h2>
            <p className="-mt-3 text-sm text-muted-foreground">All optional. We use these to rank your shortlist.</p>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-sm font-semibold">How urgent is it?</legend>
              <div className="grid gap-2 sm:grid-cols-3">
                {(["flexible", "standard", "urgent"] as const).map((urgency) => (
                  <label
                    key={urgency}
                    className={cn(
                      "flex cursor-pointer flex-col gap-1 rounded-2xl border-2 p-3 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ink",
                      values.urgency === urgency ? "border-ink bg-brand-soft/50" : "border-border hover:border-ink/30",
                    )}
                  >
                    <input type="radio" value={urgency} className="sr-only" {...form.register("urgency")} />
                    <span className="font-semibold">{URGENCY_LABELS[urgency]}</span>
                    <span className="text-xs text-muted-foreground">
                      {urgency === "flexible" ? "No rush" : urgency === "standard" ? "Normal timelines" : "Only specialists available now"}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <FormField id="preferredExperience" label="Preferred experience" optional>
              {(field) => (
                <Select {...field} {...form.register("preferredExperience")}>
                  <option value="">No preference</option>
                  <option value="entry">Entry level</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="expert">Expert</option>
                </Select>
              )}
            </FormField>
            <FormField id="locationPreference" label="Location preference" optional hint="Only if it matters, e.g. for a shoot or a local market." error={errors.locationPreference?.message}>
              {(field) => <Input {...field} maxLength={100} {...form.register("locationPreference")} />}
            </FormField>
            <label className="flex items-center gap-3 text-sm">
              <Checkbox {...form.register("remoteOk")} /> Remote work is fine
            </label>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="flex flex-col gap-5">
            <h2 className="font-display text-xl font-bold">Review your task</h2>
            <dl className="grid gap-4 sm:grid-cols-2">
              <ReviewItem label="Title" value={values.title} wide />
              <ReviewItem label="Description" value={values.description} wide />
              <ReviewItem label="Category" value={[parents.find((c) => c.id === values.categoryId)?.name, children.find((c) => c.id === values.subcategoryId)?.name].filter(Boolean).join(" › ") || "—"} />
              <ReviewItem
                label="Skills"
                value={values.skills.length ? values.skills.map((s) => `${skillLabels.get(s.skillId) ?? ""}${s.mandatory ? " (must have)" : ""}`).join(", ") : "Any"}
              />
              <ReviewItem label="Budget" value={formatBudgetRange(budgetMin, budgetMax)} />
              <ReviewItem label="Deadline" value={values.deadline || "Flexible"} />
              <ReviewItem label="Deliverables" value={values.deliverables || "—"} wide />
              <ReviewItem label="Items / revisions" value={`${values.quantity || "—"} items · ${values.revisionsExpected || "—"} revisions`} />
              <ReviewItem label="Urgency" value={URGENCY_LABELS[values.urgency]} />
              <ReviewItem label="Experience" value={values.preferredExperience ? EXPERIENCE_LABELS[values.preferredExperience] : "No preference"} />
              <ReviewItem label="Location" value={`${values.locationPreference || "Anywhere"}${values.remoteOk ? " · remote OK" : ""}`} />
              <ReviewItem label="Reference links" value={values.referenceLinks.filter(Boolean).join("\n") || "—"} wide />
              <ReviewItem label="Attachments" value={attachments.length ? attachments.map((a) => a.filename).join(", ") : "None"} wide />
            </dl>
          </div>
        ) : null}
      </div>

      {error ? <Alert tone="danger">{error}</Alert> : null}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2">
          {step > 0 ? (
            <Button type="button" variant="ghost" onClick={() => setStep(step - 1)} disabled={pending}>
              <ArrowLeft aria-hidden /> Back
            </Button>
          ) : null}
          {!isOpen ? (
            <PendingButton type="button" variant="outline" pending={pending} onClick={() => startTransition(async () => void (await saveDraft()))}>
              Save draft
            </PendingButton>
          ) : null}
        </div>
        {step < STEPS.length - 1 ? (
          <PendingButton type="button" pending={pending} onClick={next}>
            Next <ArrowRight aria-hidden />
          </PendingButton>
        ) : (
          <PendingButton type="button" size="lg" pending={pending} pendingLabel={isOpen ? "Saving…" : "Posting…"} onClick={submit}>
            <Check aria-hidden /> {isOpen ? "Save changes" : "Post task"}
          </PendingButton>
        )}
      </div>
    </div>
  );
}

function LinkListEditor({ value, onChange }: { value: string[]; onChange: (links: string[]) => void }) {
  const links = value.length > 0 ? value : [""];
  return (
    <div className="flex flex-col gap-2">
      {links.map((link, index) => (
        <div key={index} className="flex gap-2">
          <Input
            aria-label={`Reference link ${index + 1}`}
            type="url"
            placeholder="https://"
            value={link}
            onChange={(event) => onChange(links.map((item, i) => (i === index ? event.target.value : item)))}
          />
          {links.length > 1 ? (
            <Button type="button" variant="ghost" size="icon" aria-label={`Remove link ${index + 1}`} onClick={() => onChange(links.filter((_, i) => i !== index))}>
              <X className="size-4" />
            </Button>
          ) : null}
        </div>
      ))}
      {links.length < 10 ? (
        <Button type="button" variant="ghost" size="sm" className="self-start" onClick={() => onChange([...links, ""])}>
          <Plus aria-hidden /> Add another link
        </Button>
      ) : null}
    </div>
  );
}

function ReviewItem({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={cn("flex flex-col gap-1", wide && "sm:col-span-2")}>
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="whitespace-pre-line text-sm text-ink">{value}</dd>
    </div>
  );
}
