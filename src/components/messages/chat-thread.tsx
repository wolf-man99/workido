"use client";

import { Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchMessagesSinceAction, markConversationReadAction } from "@/lib/actions/messages";
import { fetchProposalAction } from "@/lib/actions/proposals";
import { isProposalOpen, type ChatMessage, type ProposalView } from "@/lib/chat/messages";
import { formatDateTime } from "@/lib/format";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Composer } from "./composer";
import { MessageBubble, type ChatFileBucket } from "./message-bubble";
import { ProposalCard } from "./proposal-card";
import { SendProposalButton, type ProposalDefaults } from "./proposal-forms";

/**
 * Order chat or pre-order enquiry (orderId null). Text, files, images, voice
 * notes, replies and — in enquiries — proposals. New messages arrive through
 * Supabase Realtime (which enforces RLS); if realtime is unavailable the
 * thread falls back to polling, so messaging keeps working either way.
 */
export function ChatThread({
  conversationId,
  orderId,
  currentUserId,
  names,
  initialMessages,
  initialProposals = [],
  canSend,
  proposalDefaults = null,
  emptyText = "No messages yet. Say hello and share anything the other person needs.",
}: {
  conversationId: string;
  orderId: string | null;
  currentUserId: string;
  names: Record<string, string>;
  initialMessages: ChatMessage[];
  initialProposals?: ProposalView[];
  canSend: boolean;
  /** Set for the specialist in an enquiry: enables "Send a proposal". */
  proposalDefaults?: ProposalDefaults | null;
  emptyText?: string;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [proposals, setProposals] = useState<Record<string, ProposalView>>(() => Object.fromEntries(initialProposals.map((p) => [p.id, p])));
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const bucket: ChatFileBucket = orderId ? "order-files" : "chat-files";
  const upload = orderId ? { purpose: "message" as const, folder: `${orderId}/messages` } : { purpose: "chat" as const, folder: conversationId };

  const refreshProposal = useCallback(
    async (proposalId: string) => {
      const result = await fetchProposalAction(proposalId);
      if (result.ok) setProposals((current) => ({ ...current, [proposalId]: result.data }));
      router.refresh();
    },
    [router],
  );

  const merge = useCallback(
    (incoming: ChatMessage[]) => {
      if (incoming.length === 0) return;
      setMessages((current) => {
        const known = new Set(current.map((m) => m.id));
        const added = incoming.filter((m) => !known.has(m.id));
        return added.length ? [...current, ...added].sort((a, b) => a.created_at.localeCompare(b.created_at)) : current;
      });
      for (const proposalId of new Set(incoming.map((m) => m.proposal_id).filter((id): id is string => Boolean(id)))) {
        void refreshProposal(proposalId);
      }
    },
    [refreshProposal],
  );

  // Pull anything newer right away (after our own proposal actions).
  const latestRef = useRef<string | null>(initialMessages.at(-1)?.created_at ?? null);
  useEffect(() => {
    latestRef.current = messages.at(-1)?.created_at ?? null;
  }, [messages]);
  const pullNew = useCallback(async () => {
    const result = await fetchMessagesSinceAction(conversationId, latestRef.current);
    if (result.ok) merge(result.data);
  }, [conversationId, merge]);

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

  const byId = useMemo(() => new Map(messages.map((m) => [m.id, m])), [messages]);
  // A proposal's card appears at its first event; later events are short notes.
  const firstEventIds = useMemo(() => {
    const seen = new Set<string>();
    const first = new Set<string>();
    for (const m of messages) {
      if (m.proposal_id && !seen.has(m.proposal_id)) {
        seen.add(m.proposal_id);
        first.add(m.id);
      }
    }
    return first;
  }, [messages]);
  const hasOpenProposal = Object.values(proposals).some((p) => isProposalOpen(p));

  const nameOf = (id: string | null) => (id ? names[id] : undefined) ?? "Workido";

  const jumpTo = (messageId: string) => {
    document.getElementById(`message-${messageId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlighted(messageId);
    setTimeout(() => setHighlighted((current) => (current === messageId ? null : current)), 1600);
  };

  return (
    <div className="flex min-h-[60vh] flex-col overflow-hidden rounded-3xl border border-border bg-card">
      <p className="flex items-start gap-2 border-b border-border bg-mint-soft/50 px-4 py-2.5 text-xs text-ink-soft">
        <Lock className="mt-px size-3.5 shrink-0 text-mint-text" aria-hidden />
        {orderId
          ? "Keep messages and files here: they're part of the order record if you ever need support."
          : "Agree the details here and pay on Workido. Disputes, refunds and verified reviews only cover work ordered on Workido."}
      </p>
      <div className="flex-1 overflow-y-auto p-4 sm:p-5" aria-live="polite" aria-label="Messages">
        {messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          <ol className="flex flex-col gap-3">
            {messages.map((message) => {
              if (message.message_type === "system") {
                const proposal = message.proposal_id ? proposals[message.proposal_id] : undefined;
                if (proposal && firstEventIds.has(message.id)) {
                  return (
                    <li key={message.id} id={`message-${message.id}`} className={proposal.specialist_id === currentUserId ? "flex justify-end" : "flex justify-start"}>
                      <ProposalCard
                        proposal={proposal}
                        viewerId={currentUserId}
                        names={names}
                        onChanged={() => {
                          void refreshProposal(proposal.id);
                          void pullNew();
                        }}
                      />
                    </li>
                  );
                }
                return (
                  <li key={message.id} id={`message-${message.id}`} className="mx-auto max-w-[90%] rounded-2xl bg-sun-soft px-4 py-2 text-center text-xs text-ink-soft">
                    {message.sender_id ? <span className="font-semibold">{message.sender_id === currentUserId ? "You" : nameOf(message.sender_id)}: </span> : null}
                    {message.body} <span className="text-muted-foreground">· {formatDateTime(message.created_at)}</span>
                  </li>
                );
              }
              const parent = message.reply_to_id ? byId.get(message.reply_to_id) : null;
              return (
                <MessageBubble
                  key={message.id}
                  message={message}
                  mine={message.sender_id === currentUserId}
                  senderName={nameOf(message.sender_id)}
                  parent={parent}
                  parentSenderName={parent ? (parent.sender_id === currentUserId ? "You" : nameOf(parent.sender_id)) : ""}
                  bucket={bucket}
                  highlighted={highlighted === message.id}
                  canReply={canSend}
                  onReply={setReplyTo}
                  onJumpTo={jumpTo}
                />
              );
            })}
          </ol>
        )}
        <div ref={bottomRef} />
      </div>

      {canSend ? (
        <Composer
          conversationId={conversationId}
          upload={upload}
          replyTo={replyTo}
          replyToName={replyTo ? (replyTo.sender_id === currentUserId ? "yourself" : nameOf(replyTo.sender_id)) : ""}
          onCancelReply={() => setReplyTo(null)}
          onSent={(message) => merge([message])}
          live={live}
          toolbar={
            proposalDefaults ? (
              <SendProposalButton size="sm" conversationId={conversationId} defaults={proposalDefaults} hasOpenProposal={hasOpenProposal} onSent={() => void pullNew()} />
            ) : null
          }
        />
      ) : (
        <p className="border-t border-border p-4 text-sm text-muted-foreground">Messaging is read-only for this conversation.</p>
      )}
    </div>
  );
}
