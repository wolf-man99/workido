"use server";

import { z } from "zod";
import { track } from "@/lib/analytics/track";
import { getCurrentUser } from "@/lib/auth/session";
import { MESSAGE_COLUMNS, type ChatMessage } from "@/lib/chat/messages";
import { inspectUploadedObject } from "@/lib/storage/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { uuid } from "@/lib/validation/marketplace";
import { fail, fromDbError, fromZodError, ok, type ActionResult } from "./result";

export type { ChatMessage } from "@/lib/chat/messages";

const textSchema = z.object({
  body: z.string().trim().min(1, "Write a message").max(4000, "Messages can be up to 4,000 characters"),
  replyToId: uuid.optional(),
});

const attachmentSchema = z.object({
  path: z.string().min(1).max(500),
  filename: z.string().trim().min(1).max(255),
  caption: z.string().trim().max(4000).optional(),
  replyToId: uuid.optional(),
  durationSeconds: z.number().int().min(1).max(600).optional(),
});

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
export async function sendMessageAction(conversationId: string, input: { body: string; replyToId?: string }): Promise<ActionResult<ChatMessage>> {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in again.");
  if (user.accountStatus !== "active") return fail("Your account is suspended.");
  if (!uuid.safeParse(conversationId).success) return fail("Invalid conversation.");
  const parsed = textSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: user.id,
      message_type: "text",
      body: parsed.data.body,
      reply_to_id: parsed.data.replyToId ?? null,
    })
    .select(MESSAGE_COLUMNS)
    .single();
  if (error) return fromDbError(error, "Your message couldn't be sent.");
  return ok(data);
}

/**
 * Records a file or voice note the user just uploaded. Order chats keep files
 * with the order (order-files/<order>/messages); pre-order chats use
 * chat-files/<conversation>. The stored bytes are checked before sending.
 */
export async function sendAttachmentAction(
  conversationId: string,
  input: { path: string; filename: string; caption?: string; replyToId?: string; durationSeconds?: number },
): Promise<ActionResult<ChatMessage>> {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in again.");
  if (user.accountStatus !== "active") return fail("Your account is suspended.");
  if (!uuid.safeParse(conversationId).success) return fail("Invalid conversation.");
  const parsed = attachmentSchema.safeParse(input);
  if (!parsed.success) return fail("That upload couldn't be sent.");
  const supabase = await createSupabaseServerClient();
  const { data: conversation } = await supabase.from("conversations").select("id, order_id").eq("id", conversationId).maybeSingle();
  if (!conversation) return fail("Conversation not found.");
  const purpose = conversation.order_id ? "message" : "chat";
  const folder = conversation.order_id ? `${conversation.order_id}/messages/` : `${conversation.id}/`;
  if (!parsed.data.path.startsWith(folder)) return fail("Invalid upload.");

  const inspected = await inspectUploadedObject(supabase, purpose, parsed.data.path);
  if (!inspected.ok) return fail(inspected.error);
  const isAudio = inspected.upload.contentType.startsWith("audio/");

  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: user.id,
      message_type: "file",
      body: parsed.data.caption || null,
      attachment_path: parsed.data.path,
      attachment_name: parsed.data.filename,
      attachment_type: inspected.upload.contentType,
      attachment_size: inspected.upload.size,
      attachment_duration_seconds: isAudio ? (parsed.data.durationSeconds ?? null) : null,
      reply_to_id: parsed.data.replyToId ?? null,
    })
    .select(MESSAGE_COLUMNS)
    .single();
  if (error) {
    await supabase.storage.from(conversation.order_id ? "order-files" : "chat-files").remove([parsed.data.path]);
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
