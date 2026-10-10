"use server";

import { z } from "zod";
import { track } from "@/lib/analytics/track";
import { getCurrentUser } from "@/lib/auth/session";
import { inspectUploadedObject } from "@/lib/storage/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { uuid } from "@/lib/validation/marketplace";
import { fail, fromDbError, fromZodError, ok, type ActionResult } from "./result";

export interface ChatMessage {
  id: string;
  sender_id: string | null;
  message_type: "text" | "file" | "system";
  body: string | null;
  attachment_path: string | null;
  attachment_name: string | null;
  attachment_size: number | null;
  created_at: string;
}

const MESSAGE_COLUMNS = "id, sender_id, message_type, body, attachment_path, attachment_name, attachment_size, created_at";

const textSchema = z.object({ body: z.string().trim().min(1, "Write a message").max(4000, "Messages can be up to 4,000 characters") });

/**
 * Opens (or reuses) the buyer's pre-order chat with a specialist, optionally
 * about one of their gigs. Nothing is paid until the buyer places an order.
 */
export async function startEnquiryAction(specialistId: string, serviceId?: string): Promise<ActionResult<{ conversationId: string }>> {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in to message specialists.");
  if (user.accountStatus !== "active") return fail("Your account is suspended.");
  if (!uuid.safeParse(specialistId).success || (serviceId && !uuid.safeParse(serviceId).success)) return fail("Invalid specialist.");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("start_enquiry", { p_specialist_id: specialistId, p_service_id: serviceId });
  if (error || !data) return fromDbError(error, "We couldn't start the conversation. Please try again.");
  await track("enquiry_started", { has_service: Boolean(serviceId) }, user.id);
  return ok({ conversationId: data });
}

/** Participants only (enforced by RLS); suspended users are blocked by the policy. */
export async function sendMessageAction(conversationId: string, input: { body: string }): Promise<ActionResult<ChatMessage>> {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in again.");
  if (user.accountStatus !== "active") return fail("Your account is suspended.");
  if (!uuid.safeParse(conversationId).success) return fail("Invalid conversation.");
  const parsed = textSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("messages")
    .insert({ conversation_id: conversationId, sender_id: user.id, message_type: "text", body: parsed.data.body })
    .select(MESSAGE_COLUMNS)
    .single();
  if (error) return fromDbError(error, "Your message couldn't be sent.");
  return ok(data);
}

export async function sendAttachmentAction(conversationId: string, input: { path: string; filename: string; caption?: string }): Promise<ActionResult<ChatMessage>> {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in again.");
  if (user.accountStatus !== "active") return fail("Your account is suspended.");
  if (!uuid.safeParse(conversationId).success) return fail("Invalid conversation.");
  const supabase = await createSupabaseServerClient();
  const { data: conversation } = await supabase.from("conversations").select("order_id").eq("id", conversationId).maybeSingle();
  if (!conversation?.order_id) return fail("Files can be shared once an order is placed.");
  if (!input.path.startsWith(`${conversation.order_id}/messages/`)) return fail("Invalid upload.");

  const inspected = await inspectUploadedObject(supabase, "message", input.path);
  if (!inspected.ok) return fail(inspected.error);

  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: user.id,
      message_type: "file",
      body: input.caption?.trim().slice(0, 4000) || null,
      attachment_path: input.path,
      attachment_name: input.filename.slice(0, 255),
      attachment_type: inspected.upload.contentType,
      attachment_size: inspected.upload.size,
    })
    .select(MESSAGE_COLUMNS)
    .single();
  if (error) {
    await supabase.storage.from("order-files").remove([input.path]);
    return fromDbError(error, "Your file couldn't be sent.");
  }
  return ok(data);
}

/** Fallback polling when realtime isn't available. */
export async function fetchMessagesSinceAction(conversationId: string, since: string | null): Promise<ActionResult<ChatMessage[]>> {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in again.");
  if (!uuid.safeParse(conversationId).success) return fail("Invalid conversation.");
  const supabase = await createSupabaseServerClient();
  let query = supabase.from("messages").select(MESSAGE_COLUMNS).eq("conversation_id", conversationId).order("created_at").limit(200);
  if (since) query = query.gt("created_at", since);
  const { data, error } = await query;
  if (error) return fromDbError(error);
  return ok(data);
}

export async function markConversationReadAction(conversationId: string): Promise<void> {
  if (!uuid.safeParse(conversationId).success) return;
  const supabase = await createSupabaseServerClient();
  await supabase.rpc("mark_conversation_read", { p_conversation_id: conversationId });
}
