"use client";

import { Paperclip, Send } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { FileUpload } from "@/components/forms/file-upload";
import { ReportButton } from "@/components/orders/order-actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { fetchMessagesSinceAction, markConversationReadAction, sendAttachmentAction, sendMessageAction, type ChatMessage } from "@/lib/actions/messages";
import { formatDateTime, formatFileSize } from "@/lib/format";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

function fileHref(path: string, name: string) {
  return `/api/files?${new URLSearchParams({ bucket: "order-files", path, name }).toString()}`;
}

/**
 * Order chat or pre-order enquiry (orderId null: text only). New messages
 * arrive through Supabase Realtime (which enforces RLS); if realtime is
 * unavailable the thread falls back to polling, so messaging keeps working.
 */
export function ChatThread({
  conversationId,
  orderId,
  currentUserId,
  names,
  initialMessages,
  canSend,
  emptyText = "No messages yet. Say hello and share anything the other person needs.",
}: {
  conversationId: string;
  orderId: string | null;
  currentUserId: string;
  names: Record<string, string>;
  initialMessages: ChatMessage[];
  canSend: boolean;
  emptyText?: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [body, setBody] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [live, setLive] = useState(false);
  const [pending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);

  const merge = useCallback((incoming: ChatMessage[]) => {
    if (incoming.length === 0) return;
    setMessages((current) => {
      const known = new Set(current.map((m) => m.id));
      const added = incoming.filter((m) => !known.has(m.id));
      return added.length ? [...current, ...added].sort((a, b) => a.created_at.localeCompare(b.created_at)) : current;
    });
  }, []);

  // Realtime subscription.
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel(`conversation:${conversationId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` }, (payload) => {
        merge([payload.new as ChatMessage]);
        void markConversationReadAction(conversationId);
      })
      .subscribe((status) => setLive(status === "SUBSCRIBED"));
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversationId, merge]);

  // Polling fallback when realtime isn't connected.
  useEffect(() => {
    if (live) return;
    const timer = setInterval(async () => {
      const latest = messages.at(-1)?.created_at ?? null;
      const result = await fetchMessagesSinceAction(conversationId, latest);
      if (result.ok) merge(result.data);
    }, 15000);
    return () => clearInterval(timer);
  }, [live, conversationId, messages, merge]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  useEffect(() => {
    void markConversationReadAction(conversationId);
  }, [conversationId]);

  const send = () => {
    const text = body.trim();
    if (!text) return;
    startTransition(async () => {
      const result = await sendMessageAction(conversationId, { body: text });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setBody("");
      merge([result.data]);
    });
  };

  return (
    <div className="flex min-h-[60vh] flex-col overflow-hidden rounded-3xl border border-border bg-card">
      <div className="flex-1 overflow-y-auto p-4 sm:p-5" aria-live="polite" aria-label="Messages">
        {messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          <ol className="flex flex-col gap-3">
            {messages.map((message) => {
              if (message.message_type === "system") {
                return (
                  <li key={message.id} className="mx-auto max-w-[90%] rounded-2xl bg-sun-soft px-4 py-2 text-center text-xs text-ink-soft">
                    {message.body} <span className="text-muted-foreground">· {formatDateTime(message.created_at)}</span>
                  </li>
                );
              }
              const mine = message.sender_id === currentUserId;
              return (
                <li key={message.id} className={cn("group flex flex-col gap-1", mine ? "items-end" : "items-start")}>
                  <div className={cn("max-w-[85%] rounded-2xl px-4 py-2.5 text-sm sm:max-w-[70%]", mine ? "rounded-br-md bg-ink text-cream" : "rounded-bl-md bg-mist text-ink")}>
                    {message.attachment_path ? (
                      <a href={fileHref(message.attachment_path, message.attachment_name ?? "file")} className={cn("mb-1 inline-flex items-center gap-2 font-semibold underline", mine ? "text-cream" : "text-ink")}>
                        <Paperclip className="size-4" aria-hidden /> {message.attachment_name}
                        {message.attachment_size ? <span className="text-xs font-normal opacity-70">{formatFileSize(message.attachment_size)}</span> : null}
                      </a>
                    ) : null}
                    {message.body ? <p className="whitespace-pre-line break-words">{message.body}</p> : null}
                  </div>
                  <div className="flex items-center gap-2 px-1 text-[11px] text-muted-foreground">
                    <span>
                      {mine ? "You" : (message.sender_id && names[message.sender_id]) || "Workido"} · {formatDateTime(message.created_at)}
                    </span>
                    {!mine && message.sender_id ? <ReportButton targetType="message" targetId={message.id} compact /> : null}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
        <div ref={bottomRef} />
      </div>

      {canSend ? (
        <div className="border-t border-border p-3 sm:p-4">
          {showUpload && orderId ? (
            <div className="mb-3">
              <FileUpload
                purpose="message"
                folder={`${orderId}/messages`}
                label="Attach a file"
                onUploaded={async ({ path, file }) => {
                  const result = await sendAttachmentAction(conversationId, { path, filename: file.name });
                  if (result.ok) {
                    merge([result.data]);
                    setShowUpload(false);
                  }
                  return result;
                }}
              />
            </div>
          ) : null}
          <form
            className="flex items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              send();
            }}
          >
            {orderId ? (
              <Button type="button" variant="ghost" size="icon" aria-label="Attach a file" aria-pressed={showUpload} onClick={() => setShowUpload((value) => !value)}>
                <Paperclip className="size-5" />
              </Button>
            ) : null}
            <Textarea
              aria-label="Message"
              rows={1}
              maxLength={4000}
              value={body}
              placeholder="Write a message…"
              className="min-h-11 flex-1 resize-none py-2.5"
              onChange={(event) => setBody(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  send();
                }
              }}
            />
            <Button type="submit" size="icon" aria-label="Send message" disabled={pending || !body.trim()}>
              <Send className="size-4" />
            </Button>
          </form>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {orderId ? "" : "Files can be shared once an order is placed. "}Keep communication and payments on Workido. Never share passwords or pay outside the
            platform. {live ? "" : "(Updates every few seconds)"}
          </p>
        </div>
      ) : (
        <p className="border-t border-border p-4 text-sm text-muted-foreground">Messaging is read-only for this conversation.</p>
      )}
    </div>
  );
}
