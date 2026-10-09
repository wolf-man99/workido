"use client";

import { LoaderCircle } from "lucide-react";
import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "./button";

/** Submit button for <form action={serverAction}> forms; shows pending state. */
export function SubmitButton({ children, pendingLabel, disabled, ...props }: ButtonProps & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled} aria-busy={pending} {...props}>
      {pending ? <LoaderCircle className="animate-spin" aria-hidden /> : null}
      {pending && pendingLabel ? pendingLabel : children}
    </Button>
  );
}

/** Button with an explicit pending flag, for react-hook-form submissions. */
export function PendingButton({ pending, children, pendingLabel, disabled, ...props }: ButtonProps & { pending: boolean; pendingLabel?: string }) {
  return (
    <Button disabled={pending || disabled} aria-busy={pending} {...props}>
      {pending ? <LoaderCircle className="animate-spin" aria-hidden /> : null}
      {pending && pendingLabel ? pendingLabel : children}
    </Button>
  );
}
