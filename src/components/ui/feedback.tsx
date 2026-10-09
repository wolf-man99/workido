import { CircleAlert, CircleCheck, Info, LoaderCircle, TriangleAlert } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

const alertTones = {
  info: { className: "border-[#cfe0ff] bg-[#f3f7ff] text-[#1e3a8a]", Icon: Info },
  success: { className: "border-mint/40 bg-mint-soft text-mint-text", Icon: CircleCheck },
  warning: { className: "border-sun bg-sun-soft text-warning-text", Icon: TriangleAlert },
  danger: { className: "border-danger/30 bg-danger-soft text-danger", Icon: CircleAlert },
} as const;

export function Alert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: keyof typeof alertTones;
  title?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const { className: toneClass, Icon } = alertTones[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("flex gap-3 rounded-2xl border p-4 text-sm", toneClass, className)}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="flex flex-col gap-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className="leading-relaxed">{children}</div> : null}
      </div>
    </div>
  );
}

export function Spinner({ className, label = "Loading" }: { className?: string; label?: string }) {
  return (
    <span role="status" className={cn("inline-flex items-center", className)}>
      <LoaderCircle className="size-5 animate-spin text-ink/60" aria-hidden />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-xl bg-ink/[0.06]", className)} />;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-3 rounded-[var(--radius-card)] border border-dashed border-ink/15 bg-card/60 px-6 py-12 text-center", className)}>
      {Icon ? (
        <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-soft text-brand-text">
          <Icon className="size-6" />
        </span>
      ) : null}
      <div className="flex max-w-md flex-col gap-1">
        <p className="font-display text-lg font-bold text-ink">{title}</p>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
