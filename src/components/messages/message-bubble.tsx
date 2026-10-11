"use client";

import { Mic, Paperclip, Reply, ShieldAlert } from "lucide-react";
import { ReportButton } from "@/components/orders/order-actions";
import type { ChatMessage } from "@/lib/chat/messages";
import { formatDateTime, formatFileSize } from "@/lib/format";
import { cn } from "@/lib/utils";

export type ChatFileBucket = "order-files" | "chat-files";

export function fileHref(bucket: ChatFileBucket, path: string, name: string, inline = false) {
  const params = new URLSearchParams({ bucket, path, name });
  if (inline) params.set("inline", "1");
  return `/api/files?${params.toString()}`;
}

/** Short text describing a message, for reply quotes. */
export function messageSnippet(message: ChatMessage): string {
  if (message.attachment_type?.startsWith("audio/")) return "Voice note";
  if (message.attachment_path) return message.body || message.attachment_name || "Attachment";
  return message.body ?? "";
}

const IMAGE_TYPES = /^image\/(png|jpeg|gif|webp)$/;

function formatSeconds(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function MessageBubble({
  message,
  mine,
  senderName,
  parent,
  parentSenderName,
  bucket,
  highlighted,
  canReply,
  onReply,
  onJumpTo,
}: {
  message: ChatMessage;
  mine: boolean;
  senderName: string;
  parent: ChatMessage | null | undefined;
  parentSenderName: string;
  bucket: ChatFileBucket;
  highlighted: boolean;
  canReply: boolean;
  onReply: (message: ChatMessage) => void;
  onJumpTo: (messageId: string) => void;
}) {
  const isAudio = Boolean(message.attachment_path && message.attachment_type?.startsWith("audio/"));
  const isImage = Boolean(message.attachment_path && message.attachment_type && IMAGE_TYPES.test(message.attachment_type));

  return (
    <li id={`message-${message.id}`} className={cn("group flex scroll-mt-24 flex-col gap-1", mine ? "items-end" : "items-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm transition-shadow sm:max-w-[70%]",
          mine ? "rounded-br-md bg-ink text-cream" : "rounded-bl-md bg-mist text-ink",
          highlighted && "ring-4 ring-brand/40",
        )}
      >
        {message.reply_to_id ? (
          <button
            type="button"
            onClick={() => parent && onJumpTo(parent.id)}
            disabled={!parent}
            className={cn(
              "mb-2 block w-full rounded-lg border-l-4 px-2.5 py-1.5 text-left text-xs",
              mine ? "border-brand bg-cream/10 text-cream/80" : "border-brand bg-card/70 text-ink-soft",
            )}
          >
            <span className="block font-semibold">{parent ? parentSenderName : "Earlier message"}</span>
            {parent ? <span className="line-clamp-2 break-words">{messageSnippet(parent)}</span> : null}
          </button>
        ) : null}

        {isAudio ? (
          <div className="mb-1 flex flex-col gap-1">
            <span className={cn("flex items-center gap-1.5 text-xs font-semibold", mine ? "text-cream/80" : "text-ink-soft")}>
              <Mic className="size-3.5" aria-hidden /> Voice note{message.attachment_duration_seconds ? ` · ${formatSeconds(message.attachment_duration_seconds)}` : ""}
            </span>
            <audio
              controls
              preload="none"
              src={fileHref(bucket, message.attachment_path!, message.attachment_name ?? "voice-note", true)}
              className="h-10 w-64 max-w-full"
              aria-label={`Voice note from ${mine ? "you" : senderName}`}
            />
          </div>
        ) : isImage ? (
          <a href={fileHref(bucket, message.attachment_path!, message.attachment_name ?? "image")} className="mb-1 block" aria-label={`Download ${message.attachment_name ?? "image"}`}>
            {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL, not optimisable */}
            <img
              src={fileHref(bucket, message.attachment_path!, message.attachment_name ?? "image", true)}
              alt={message.attachment_name ?? "Shared image"}
              loading="lazy"
              className="max-h-64 min-h-12 min-w-12 rounded-xl bg-card/20 object-contain"
            />
            <span className={cn("mt-1 flex items-center gap-1.5 text-xs", mine ? "text-cream/80" : "text-ink-soft")}>
              <Paperclip className="size-3.5" aria-hidden /> {message.attachment_name}
            </span>
          </a>
        ) : message.attachment_path ? (
          <a
            href={fileHref(bucket, message.attachment_path, message.attachment_name ?? "file")}
            className={cn("mb-1 inline-flex items-center gap-2 font-semibold underline", mine ? "text-cream" : "text-ink")}
          >
            <Paperclip className="size-4" aria-hidden /> {message.attachment_name}
            {message.attachment_size ? <span className="text-xs font-normal opacity-70">{formatFileSize(message.attachment_size)}</span> : null}
          </a>
        ) : null}

        {message.body ? <p className="whitespace-pre-line break-words">{message.body}</p> : null}
      </div>

      {message.contact_flagged ? (
        <p className="flex max-w-[85%] items-start gap-1.5 px-1 text-[11px] text-warning-text sm:max-w-[70%]">
          <ShieldAlert className="mt-px size-3.5 shrink-0" aria-hidden />
          {mine
            ? "Looks like contact or payment details. Deals and payments outside Workido aren't covered by disputes or refunds."
            : "This message may share contact or payment details. Stay protected: keep the conversation and payment on Workido."}
        </p>
      ) : null}

      <div className="flex items-center gap-2 px-1 text-[11px] text-muted-foreground">
        <span>
          {mine ? "You" : senderName} · {formatDateTime(message.created_at)}
        </span>
        {canReply ? (
          <button
            type="button"
            onClick={() => onReply(message)}
            className="inline-flex items-center gap-1 rounded px-1 opacity-70 hover:text-ink hover:opacity-100 focus-visible:opacity-100"
            aria-label={`Reply to ${mine ? "your" : `${senderName}'s`} message`}
          >
            <Reply className="size-3.5" aria-hidden /> Reply
          </button>
        ) : null}
        {!mine && message.sender_id ? <ReportButton targetType="message" targetId={message.id} compact /> : null}
      </div>
    </li>
  );
}
