"use client";

import { X } from "lucide-react";
import { Dialog as DialogPrimitive, DropdownMenu as MenuPrimitive } from "radix-ui";
import * as React from "react";
import { cn } from "@/lib/utils";

/* ---------------------------------- Dialog --------------------------------- */

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({
  className,
  children,
  title,
  description,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & { title: string; description?: string }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-[2px] data-[state=open]:animate-[fade-up_0.2s_ease-out]" />
      <DialogPrimitive.Content
        className={cn(
          "fixed inset-x-3 bottom-3 z-50 max-h-[90dvh] overflow-y-auto rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-lift)] focus:outline-none sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2",
          "data-[state=open]:animate-[fade-up_0.2s_ease-out]",
          className,
        )}
        {...props}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <DialogPrimitive.Title className="font-display text-xl font-bold text-ink">{title}</DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="text-sm text-muted-foreground">{description}</DialogPrimitive.Description>
            ) : (
              <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
            )}
          </div>
          <DialogPrimitive.Close className="-m-1 rounded-full p-1.5 text-ink/60 hover:bg-ink/5 hover:text-ink" aria-label="Close">
            <X className="size-5" />
          </DialogPrimitive.Close>
        </div>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

/* ---------------------------------- Sheet ---------------------------------- */

export function SheetContent({
  className,
  children,
  title,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & { title: string }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink/40" />
      <DialogPrimitive.Content
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-[86vw] max-w-sm flex-col gap-2 overflow-y-auto bg-cream p-5 shadow-[var(--shadow-lift)] focus:outline-none",
          "data-[state=open]:animate-[fade-up_0.2s_ease-out]",
          className,
        )}
        {...props}
      >
        <div className="mb-2 flex items-center justify-between">
          <DialogPrimitive.Title className="font-display text-lg font-bold">{title}</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
          <DialogPrimitive.Close className="rounded-full p-2 hover:bg-ink/5" aria-label="Close menu">
            <X className="size-5" />
          </DialogPrimitive.Close>
        </div>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

/* ------------------------------- Dropdown menu ----------------------------- */

export const DropdownMenu = MenuPrimitive.Root;
export const DropdownMenuTrigger = MenuPrimitive.Trigger;

export function DropdownMenuContent({ className, sideOffset = 8, ...props }: React.ComponentProps<typeof MenuPrimitive.Content>) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Content
        sideOffset={sideOffset}
        className={cn(
          "z-50 min-w-56 rounded-2xl border border-border bg-card p-1.5 shadow-[var(--shadow-lift)] data-[state=open]:animate-[fade-up_0.15s_ease-out]",
          className,
        )}
        {...props}
      />
    </MenuPrimitive.Portal>
  );
}

export function DropdownMenuItem({ className, ...props }: React.ComponentProps<typeof MenuPrimitive.Item>) {
  return (
    <MenuPrimitive.Item
      className={cn(
        "flex cursor-pointer select-none items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-ink outline-none data-[highlighted]:bg-mist [&_svg]:size-4 [&_svg]:text-ink/60",
        className,
      )}
      {...props}
    />
  );
}

export function DropdownMenuLabel({ className, ...props }: React.ComponentProps<typeof MenuPrimitive.Label>) {
  return <MenuPrimitive.Label className={cn("px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground", className)} {...props} />;
}

export function DropdownMenuSeparator({ className, ...props }: React.ComponentProps<typeof MenuPrimitive.Separator>) {
  return <MenuPrimitive.Separator className={cn("my-1.5 h-px bg-border", className)} {...props} />;
}
