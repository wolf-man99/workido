"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/overlays";
import { PendingButton } from "@/components/ui/submit-button";
import { deleteAccountAction } from "@/lib/actions/account";
import { DELETE_ACCOUNT_PHRASE } from "@/lib/validation/account";

/** "Delete account" button and the typed-confirmation dialog behind it. */
export function DeleteAccount({ blocker }: { blocker: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const confirmed = confirmation.trim() === DELETE_ACCOUNT_PHRASE;

  function onOpenChange(next: boolean) {
    if (pending) return;
    setOpen(next);
    if (!next) {
      setConfirmation("");
      setError(null);
    }
  }

  return (
    <>
      <Button variant="danger" onClick={() => setOpen(true)}>
        Delete account
      </Button>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent title="Delete your Workido account?" description="This can't be undone.">
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!confirmed || blocker) return;
              startTransition(async () => {
                setError(null);
                const result = await deleteAccountAction({ confirmation });
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                router.replace("/account-deleted");
                router.refresh();
              });
            }}
          >
            <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm text-ink-soft">
              <li>Your profile, services, portfolio, tasks, offers and saved specialists are deleted.</li>
              <li>Orders you&apos;ve completed stay in the other person&apos;s history, shown as &ldquo;Deleted user&rdquo;.</li>
              <li>You&apos;ll be logged out, and you can sign up again with the same email later.</li>
            </ul>
            {blocker ? <Alert tone="warning">{blocker}</Alert> : null}
            <FormField id="delete-account-confirmation" label={`To confirm, type "${DELETE_ACCOUNT_PHRASE}"`}>
              {(field) => (
                <Input
                  {...field}
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  placeholder={DELETE_ACCOUNT_PHRASE}
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  disabled={Boolean(blocker) || pending}
                />
              )}
            </FormField>
            {error ? <Alert tone="danger">{error}</Alert> : null}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <DialogClose asChild>
                <Button variant="outline" disabled={pending}>
                  Cancel
                </Button>
              </DialogClose>
              <PendingButton type="submit" variant="danger" pending={pending} pendingLabel="Deleting…" disabled={!confirmed || Boolean(blocker)}>
                Delete my account
              </PendingButton>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
