"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Checkbox, Input, Textarea } from "@/components/ui/input";
import { PendingButton } from "@/components/ui/submit-button";
import { removeAvatarAction, setAvatarAction, updateProfileAction, updateSettingsAction } from "@/lib/actions/profile";
import type { ActionResult } from "@/lib/actions/result";
import { profileSchema, settingsSchema, type ProfileInput, type SettingsInput } from "@/lib/validation/profile";
import type { z } from "zod";
import { FileUpload } from "./file-upload";

function applyResult<T extends Record<string, unknown>>(
  result: ActionResult<unknown>,
  setError: (name: keyof T & string, error: { message: string }) => void,
): boolean {
  if (result.ok) {
    toast.success(result.message ?? "Saved");
    return true;
  }
  if (result.fieldErrors) {
    for (const [key, message] of Object.entries(result.fieldErrors)) setError(key as keyof T & string, { message });
  }
  toast.error(result.error);
  return false;
}

export function ProfileForm({ defaults }: { defaults: ProfileInput }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const form = useForm<ProfileInput, unknown, z.output<typeof profileSchema>>({ resolver: zodResolver(profileSchema), defaultValues: defaults });
  const errors = form.formState.errors;

  const onSubmit = form.handleSubmit(() => {
    startTransition(async () => {
      const result = await updateProfileAction(form.getValues());
      if (applyResult<ProfileInput>(result, form.setError)) router.refresh();
    });
  });

  return (
    <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
      <FormField id="fullName" label="Display name" error={errors.fullName?.message}>
        {(field) => <Input {...field} autoComplete="name" {...form.register("fullName")} />}
      </FormField>
      <FormField id="username" label="Username" hint="Used in your public profile URL." error={errors.username?.message}>
        {(field) => <Input {...field} autoComplete="username" {...form.register("username")} />}
      </FormField>
      <FormField id="bio" label="Short bio" optional className="sm:col-span-2" error={errors.bio?.message}>
        {(field) => <Textarea {...field} rows={3} maxLength={500} {...form.register("bio")} />}
      </FormField>
      <FormField id="city" label="City" optional error={errors.city?.message}>
        {(field) => <Input {...field} autoComplete="address-level2" {...form.register("city")} />}
      </FormField>
      <FormField id="region" label="State / region" optional error={errors.region?.message}>
        {(field) => <Input {...field} autoComplete="address-level1" {...form.register("region")} />}
      </FormField>
      <FormField id="countryCode" label="Country code" optional hint="Two letters, e.g. IN" error={errors.countryCode?.message}>
        {(field) => <Input {...field} maxLength={2} autoComplete="country" {...form.register("countryCode")} />}
      </FormField>
      <FormField id="websiteUrl" label="Website or portfolio link" optional error={errors.websiteUrl?.message}>
        {(field) => <Input {...field} type="url" inputMode="url" placeholder="https://" {...form.register("websiteUrl")} />}
      </FormField>
      <div className="sm:col-span-2">
        <PendingButton type="submit" pending={pending} pendingLabel="Saving…">
          Save profile
        </PendingButton>
      </div>
    </form>
  );
}

export function AvatarForm({ userId, name, avatarPath }: { userId: string; name: string; avatarPath: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <Avatar name={name} path={avatarPath} size="xl" />
      <div className="flex flex-1 flex-col gap-2">
        <FileUpload
          purpose="avatar"
          folder={userId}
          label="Upload a new photo"
          onUploaded={async ({ path }) => {
            const result = await setAvatarAction({ path });
            if (result.ok) router.refresh();
            return result;
          }}
        />
        {avatarPath ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="self-start"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await removeAvatarAction();
                if (result.ok) {
                  toast.success(result.message ?? "Removed");
                  router.refresh();
                } else toast.error(result.error);
              })
            }
          >
            Remove photo
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function PreferencesForm({ defaults }: { defaults: SettingsInput }) {
  const [pending, startTransition] = useTransition();
  const form = useForm<SettingsInput, unknown, z.output<typeof settingsSchema>>({ resolver: zodResolver(settingsSchema), defaultValues: defaults });

  const onSubmit = form.handleSubmit(() => {
    startTransition(async () => {
      applyResult<SettingsInput>(await updateSettingsAction(form.getValues()), form.setError);
    });
  });

  const toggles: { name: "emailNotifications" | "marketingEmails" | "whatsappOptIn"; label: string; hint: string }[] = [
    { name: "emailNotifications", label: "Email me about my orders and messages", hint: "Order updates, offers and new messages." },
    { name: "marketingEmails", label: "Product news and tips", hint: "Occasional updates about Workido. Off by default." },
    { name: "whatsappOptIn", label: "WhatsApp updates (coming soon)", hint: "We'll only use this once WhatsApp notifications launch." },
  ];

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {toggles.map((toggle) => (
        <label key={toggle.name} className="flex cursor-pointer items-start gap-3">
          <Checkbox className="mt-0.5" {...form.register(toggle.name)} />
          <span>
            <span className="block text-sm font-semibold text-ink">{toggle.label}</span>
            <span className="block text-xs text-muted-foreground">{toggle.hint}</span>
          </span>
        </label>
      ))}
      <FormField id="phone" label="Phone number" optional hint="Private. Never shown on your profile or shared automatically." error={form.formState.errors.phone?.message}>
        {(field) => <Input {...field} type="tel" autoComplete="tel" className="max-w-xs" {...form.register("phone")} />}
      </FormField>
      <div>
        <PendingButton type="submit" pending={pending} pendingLabel="Saving…">
          Save preferences
        </PendingButton>
      </div>
    </form>
  );
}
