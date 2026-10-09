"use server";

import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fromDbError, fromZodError, ok, type ActionResult } from "./result";

const contactSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(100),
  email: z.email("Enter a valid email address").trim().max(254),
  topic: z.enum(["general", "buying", "selling", "payments", "trust_safety", "other"]),
  message: z.string().trim().min(10, "Tell us a bit more (at least 10 characters)").max(4000),
  // Honeypot: real users never fill this hidden field.
  website: z.string().max(0).optional().default(""),
});

export type ContactInput = z.input<typeof contactSchema>;

export async function sendContactMessageAction(input: ContactInput): Promise<ActionResult<undefined>> {
  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) {
    // Silently accept bot submissions caught by the honeypot.
    if (parsed.error.issues.some((issue) => issue.path[0] === "website")) return ok(undefined, "Thanks! We'll get back to you soon.");
    return fromZodError(parsed.error);
  }
  const user = await getCurrentUser();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("contact_messages").insert({
    user_id: user?.id ?? null,
    name: parsed.data.name,
    email: parsed.data.email,
    topic: parsed.data.topic,
    message: parsed.data.message,
  });
  if (error) return fromDbError(error, "We couldn't send your message. Please try again.");
  return ok(undefined, "Thanks! We'll get back to you soon.");
}
