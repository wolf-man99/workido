"use client";

import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/overlays";
import type { ActionResult } from "@/lib/actions/result";

/**
 * Runs a (bound) server action, shows the outcome and refreshes the page.
 * With `confirm`, asks first in an accessible dialog.
 */
export function ActionButton({
  action,
  children,
  confirm,
  redirectTo,
  ...buttonProps
}: Omit<ButtonProps, "onClick"> & {
  action: () => Promise<ActionResult<unknown>>;
  confirm?: { title: string; description: string; confirmLabel?: string; tone?: "danger" | "default" };
  redirectTo?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const run = () =>
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        if (result.message) toast.success(result.message);
        setOpen(false);
        if (redirectTo) router.push(redirectTo);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });

  const button = (
    <Button {...buttonProps} disabled={pending || buttonProps.disabled} aria-busy={pending} onClick={confirm ? () => setOpen(true) : run}>
      {pending && !confirm ? <LoaderCircle className="animate-spin" aria-hidden /> : null}
      {children}
    </Button>
  );

  if (!confirm) return button;

  return (
    <>
      {button}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title={confirm.title} description={confirm.description}>
          <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button variant={confirm.tone === "danger" ? "danger" : "primary"} onClick={run} disabled={pending} aria-busy={pending}>
              {pending ? <LoaderCircle className="animate-spin" aria-hidden /> : null}
              {confirm.confirmLabel ?? "Confirm"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
