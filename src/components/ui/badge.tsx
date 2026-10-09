import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold [&_svg]:size-3.5",
  {
    variants: {
      tone: {
        neutral: "bg-mist text-ink-soft",
        brand: "bg-brand-soft text-brand-text",
        info: "bg-[#e7f0ff] text-[#1d4ed8]",
        success: "bg-mint-soft text-mint-text",
        warning: "bg-sun-soft text-warning-text",
        danger: "bg-danger-soft text-danger",
        dark: "bg-ink text-cream",
        outline: "border border-border bg-card text-ink-soft",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
