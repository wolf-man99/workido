import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import * as React from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold transition-[background-color,color,box-shadow,transform] duration-150 active:translate-y-px disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Ink text on orange: accessible contrast for the primary CTA.
        primary: "bg-brand text-ink shadow-[inset_0_-2px_0_rgb(23_23_23/0.12)] hover:bg-brand-hover",
        dark: "bg-ink text-cream hover:bg-ink-soft",
        outline: "border border-ink/15 bg-card text-ink hover:border-ink/30 hover:bg-mist",
        ghost: "text-ink hover:bg-ink/5",
        soft: "bg-brand-soft text-brand-text hover:bg-brand-soft/70",
        danger: "bg-danger text-white hover:bg-danger/90",
        link: "h-auto rounded-none px-0 text-brand-text underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-9 px-4 text-sm",
        md: "h-11 px-5 text-sm",
        lg: "h-13 px-7 text-base",
        icon: "size-10",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({ className, variant, size, asChild = false, type, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      className={cn(buttonVariants({ variant, size }), variant === "link" && "h-auto", className)}
      {...(asChild ? {} : { type: type ?? "button" })}
      {...props}
    />
  );
}

export { buttonVariants };
