"use client";

import { MessageCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import type { ButtonProps } from "@/components/ui/button";
import { PendingButton } from "@/components/ui/submit-button";
import { startEnquiryAction } from "@/lib/actions/messages";

/** Opens the pre-order chat with a specialist (optionally about one gig). */
export function ContactSpecialistButton({
  specialistId,
  serviceId,
  label,
  ...buttonProps
}: Omit<ButtonProps, "onClick" | "children"> & { specialistId: string; serviceId?: string; label: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <PendingButton
      {...buttonProps}
      pending={pending}
      pendingLabel="Opening chat…"
      onClick={() =>
        startTransition(async () => {
          const result = await startEnquiryAction(specialistId, serviceId);
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          router.push(`/dashboard/messages/${result.data.conversationId}`);
        })
      }
    >
      <MessageCircle aria-hidden /> {label}
    </PendingButton>
  );
}
