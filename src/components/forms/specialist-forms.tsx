"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ExternalLink, Eye, EyeOff, Link2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PendingButton } from "@/components/ui/submit-button";
import type { ActionResult } from "@/lib/actions/result";
import {
  addPortfolioLinkAction,
  addPortfolioUploadAction,
  deletePortfolioItemAction,
  requestVerificationAction,
  setAvailabilityAction,
  setPortfolioVisibilityAction,
  updateSpecialistProfileAction,
} from "@/lib/actions/specialist";
import { publicStorageUrl } from "@/lib/storage/public-url";
import { cn } from "@/lib/utils";
import {
  portfolioLinkSchema,
  specialistProfileSchema,
  type PortfolioLinkInput,
  type SpecialistProfileInput,
} from "@/lib/validation/marketplace";
import { ActionButton } from "./action-button";
import { ChipPicker, type ChipOption } from "./chip-picker";
import { FileUpload } from "./file-upload";

function reportResult(result: ActionResult<unknown>, setError?: (name: string, message: string) => void) {
  if (result.ok) {
    toast.success(result.message ?? "Saved");
    return true;
  }
  if (result.fieldErrors && setError) for (const [key, message] of Object.entries(result.fieldErrors)) setError(key, message);
  toast.error(result.error);
  return false;
}

export function SpecialistProfileForm({
  defaults,
  skillOptions,
  categoryOptions,
}: {
  defaults: SpecialistProfileInput;
  skillOptions: ChipOption[];
  categoryOptions: ChipOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const form = useForm<SpecialistProfileInput, unknown, z.output<typeof specialistProfileSchema>>({
    resolver: zodResolver(specialistProfileSchema),
    defaultValues: defaults,
  });
  const errors = form.formState.errors;

  const onSubmit = form.handleSubmit(() =>
    startTransition(async () => {
      const result = await updateSpecialistProfileAction(form.getValues());
      if (reportResult(result, (name, message) => form.setError(name as keyof SpecialistProfileInput, { message }))) router.refresh();
    }),
  );

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      <FormField id="headline" label="Headline" hint="One line buyers see first, e.g. “Short-form video editor for D2C brands”." error={errors.headline?.message}>
        {(field) => <Input {...field} maxLength={120} {...form.register("headline")} />}
      </FormField>
      <FormField id="professionalBio" label="Professional bio" hint="What you do, who you work with, and how you work." error={errors.professionalBio?.message}>
        {(field) => <Textarea {...field} rows={6} maxLength={3000} {...form.register("professionalBio")} />}
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="experienceLevel" label="Experience level" error={errors.experienceLevel?.message}>
          {(field) => (
            <Select {...field} {...form.register("experienceLevel")}>
              <option value="">Choose…</option>
              <option value="entry">Entry level (0–2 years)</option>
              <option value="intermediate">Intermediate (2–5 years)</option>
              <option value="expert">Expert (5+ years)</option>
            </Select>
          )}
        </FormField>
        <FormField id="yearsExperience" label="Years of experience" optional error={errors.yearsExperience?.message}>
          {(field) => <Input {...field} inputMode="numeric" maxLength={2} {...form.register("yearsExperience")} />}
        </FormField>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">Categories</span>
        <Controller
          control={form.control}
          name="categoryIds"
          render={({ field }) => <ChipPicker id="categories" label="Categories" options={categoryOptions} value={field.value} onChange={field.onChange} max={5} />}
        />
        {errors.categoryIds?.message ? <p className="text-xs font-medium text-danger">{errors.categoryIds.message}</p> : null}
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">Skills</span>
        <Controller
          control={form.control}
          name="skillIds"
          render={({ field }) => (
            <ChipPicker id="skills" label="Skills" options={skillOptions} value={field.value} onChange={field.onChange} max={15} searchable />
          )}
        />
        {errors.skillIds?.message ? <p className="text-xs font-medium text-danger">{errors.skillIds.message}</p> : null}
      </div>
      <div>
        <PendingButton type="submit" pending={pending} pendingLabel="Saving…">
          Save profile
        </PendingButton>
      </div>
    </form>
  );
}

const availabilityOptions = [
  { value: "available", title: "Available", body: "Taking new work. You appear in matches and can be hired instantly.", dot: "bg-mint" },
  { value: "busy", title: "Busy", body: "Taking work with longer timelines. You won't be matched to urgent tasks.", dot: "bg-sun" },
  { value: "unavailable", title: "Unavailable", body: "Not taking new work. Buyers can't order your services or invite you.", dot: "bg-ink/30" },
] as const;

export function AvailabilityForm({ current }: { current: "available" | "busy" | "unavailable" }) {
  const router = useRouter();
  const [value, setValue] = useState(current);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          if (reportResult(await setAvailabilityAction({ availability: value }))) router.refresh();
        });
      }}
    >
      <fieldset className="grid gap-3 sm:grid-cols-3">
        <legend className="sr-only">Availability</legend>
        {availabilityOptions.map((option) => (
          <label
            key={option.value}
            className={cn(
              "flex cursor-pointer flex-col gap-2 rounded-2xl border-2 p-4 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink",
              value === option.value ? "border-ink bg-card" : "border-border bg-card/60 hover:border-ink/30",
            )}
          >
            <input type="radio" name="availability" value={option.value} checked={value === option.value} onChange={() => setValue(option.value)} className="sr-only" />
            <span className="flex items-center gap-2 font-display font-bold">
              <span className={cn("size-2.5 rounded-full", option.dot)} aria-hidden /> {option.title}
            </span>
            <span className="text-sm text-ink-soft">{option.body}</span>
          </label>
        ))}
      </fieldset>
      <div>
        <PendingButton type="submit" pending={pending} disabled={value === current} pendingLabel="Saving…">
          Update availability
        </PendingButton>
      </div>
    </form>
  );
}

export function VerificationRequestForm() {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          if (reportResult(await requestVerificationAction({ note }))) router.refresh();
        });
      }}
    >
      <FormField id="verification-note" label="Anything our reviewers should know?" optional hint="E.g. links to published work or certifications.">
        {(field) => <Textarea {...field} rows={3} maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)} />}
      </FormField>
      <div>
        <PendingButton type="submit" variant="dark" pending={pending} pendingLabel="Submitting…">
          Request verification
        </PendingButton>
      </div>
    </form>
  );
}

/* --------------------------------- Portfolio -------------------------------- */

export interface PortfolioItemView {
  id: string;
  title: string;
  description: string | null;
  asset_path: string | null;
  external_url: string | null;
  visibility: "public" | "hidden";
  categoryName: string | null;
}

export function PortfolioManager({
  userId,
  items,
  categoryOptions,
}: {
  userId: string;
  items: PortfolioItemView[];
  categoryOptions: ChipOption[];
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"upload" | "link">("upload");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [titleError, setTitleError] = useState<string | null>(null);
  const linkForm = useForm<PortfolioLinkInput, unknown, z.output<typeof portfolioLinkSchema>>({
    resolver: zodResolver(portfolioLinkSchema),
    defaultValues: { title: "", description: "", categoryId: "", externalUrl: "" },
  });
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-[var(--radius-card)] border border-border bg-card p-5 sm:p-6">
        <div className="mb-4 flex gap-2" role="tablist" aria-label="Add portfolio item">
          {(["upload", "link"] as const).map((option) => (
            <button
              key={option}
              type="button"
              role="tab"
              aria-selected={mode === option}
              onClick={() => setMode(option)}
              className={cn("rounded-full px-4 py-2 text-sm font-semibold", mode === option ? "bg-ink text-cream" : "bg-mist text-ink-soft")}
            >
              {option === "upload" ? "Upload an image" : "Add a link"}
            </button>
          ))}
        </div>

        {mode === "upload" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="portfolio-title" label="Title" error={titleError ?? undefined}>
              {(field) => <Input {...field} value={title} maxLength={100} onChange={(event) => setTitle(event.target.value)} />}
            </FormField>
            <FormField id="portfolio-category" label="Category" optional>
              {(field) => (
                <Select {...field} value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
                  <option value="">None</option>
                  {categoryOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              )}
            </FormField>
            <FormField id="portfolio-description" label="Description" optional className="sm:col-span-2">
              {(field) => <Textarea {...field} rows={2} maxLength={1000} value={description} onChange={(event) => setDescription(event.target.value)} />}
            </FormField>
            <div className="sm:col-span-2">
              <FileUpload
                purpose="portfolio"
                folder={userId}
                label="Choose an image (JPG, PNG, WebP or GIF)"
                disabled={title.trim().length < 2}
                onUploaded={async ({ path }) => {
                  const result = await addPortfolioUploadAction({ title, description, categoryId, path });
                  if (result.ok) {
                    setTitle("");
                    setDescription("");
                    router.refresh();
                  } else if (result.fieldErrors?.title) setTitleError(result.fieldErrors.title);
                  return result;
                }}
              />
              {title.trim().length < 2 ? <p className="mt-1 text-xs text-muted-foreground">Add a title first.</p> : null}
            </div>
          </div>
        ) : (
          <form
            className="grid gap-4 sm:grid-cols-2"
            noValidate
            onSubmit={linkForm.handleSubmit(() =>
              startTransition(async () => {
                const result = await addPortfolioLinkAction(linkForm.getValues());
                if (reportResult(result, (name, message) => linkForm.setError(name as keyof PortfolioLinkInput, { message }))) {
                  linkForm.reset();
                  router.refresh();
                }
              }),
            )}
          >
            <FormField id="link-title" label="Title" error={linkForm.formState.errors.title?.message}>
              {(field) => <Input {...field} maxLength={100} {...linkForm.register("title")} />}
            </FormField>
            <FormField id="link-url" label="Link" error={linkForm.formState.errors.externalUrl?.message}>
              {(field) => <Input {...field} type="url" placeholder="https://" {...linkForm.register("externalUrl")} />}
            </FormField>
            <FormField id="link-category" label="Category" optional>
              {(field) => (
                <Select {...field} {...linkForm.register("categoryId")}>
                  <option value="">None</option>
                  {categoryOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              )}
            </FormField>
            <FormField id="link-description" label="Description" optional>
              {(field) => <Input {...field} maxLength={1000} {...linkForm.register("description")} />}
            </FormField>
            <div className="sm:col-span-2">
              <PendingButton type="submit" pending={pending} pendingLabel="Adding…">
                <Link2 aria-hidden /> Add link
              </PendingButton>
            </div>
          </form>
        )}
      </div>

      {items.length > 0 ? (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <li key={item.id} className="flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-border bg-card">
              <div className="aspect-[16/10] bg-mist">
                {item.asset_path ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={publicStorageUrl("portfolio", item.asset_path)} alt={item.title} className="size-full object-cover" loading="lazy" />
                ) : (
                  <div className="flex size-full items-center justify-center text-ink/40">
                    <Link2 className="size-8" aria-hidden />
                  </div>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold">{item.title}</p>
                  {item.visibility === "hidden" ? <Badge>Hidden</Badge> : null}
                </div>
                {item.categoryName ? <p className="text-xs text-muted-foreground">{item.categoryName}</p> : null}
                {item.external_url ? (
                  <a href={item.external_url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-text hover:underline">
                    Open link <ExternalLink className="size-3.5" aria-hidden />
                  </a>
                ) : null}
                <div className="mt-auto flex gap-2 pt-2">
                  <ActionButton
                    variant="outline"
                    size="sm"
                    action={setPortfolioVisibilityAction.bind(null, item.id, item.visibility === "hidden")}
                  >
                    {item.visibility === "hidden" ? <Eye aria-hidden /> : <EyeOff aria-hidden />}
                    {item.visibility === "hidden" ? "Show" : "Hide"}
                  </ActionButton>
                  <ActionButton
                    variant="ghost"
                    size="sm"
                    action={deletePortfolioItemAction.bind(null, item.id)}
                    confirm={{ title: "Remove this item?", description: "It will be removed from your profile permanently.", confirmLabel: "Remove", tone: "danger" }}
                  >
                    <Trash2 aria-hidden /> Remove
                  </ActionButton>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No portfolio items yet. Buyers are much more likely to hire specialists with relevant examples.</p>
      ) : null}
      <Button type="button" variant="link" className="self-start" onClick={() => router.push("/dashboard/specialist")}>
        Back to overview
      </Button>
    </div>
  );
}
