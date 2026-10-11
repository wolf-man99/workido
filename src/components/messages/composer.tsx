"use client";

import { Paperclip, Send, ShieldAlert, X } from "lucide-react";
import { useRef, useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { FileUpload } from "@/components/forms/file-upload";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { sendAttachmentAction, sendMessageAction } from "@/lib/actions/messages";
import { mentionsContactDetails } from "@/lib/chat/contact-details";
import type { ChatMessage } from "@/lib/chat/messages";
import { storageFileName, UPLOAD_RULES, validateFileMetadata } from "@/lib/storage/file-validation";
import { uploadWithProgress } from "@/lib/storage/upload-client";
import { messageSnippet } from "./message-bubble";
import { VoiceRecorder } from "./voice-recorder";

export function Composer({
  conversationId,
  upload,
  replyTo,
  replyToName,
  onCancelReply,
  onSent,
  toolbar,
  live,
}: {
  conversationId: string;
  /** Where attachments and voice notes go. */
  upload: { purpose: "message" | "chat"; folder: string };
  replyTo: ChatMessage | null;
  replyToName: string;
  onCancelReply: () => void;
  onSent: (message: ChatMessage) => void;
  toolbar?: ReactNode;
  live: boolean;
}) {
  const [body, setBody] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [voiceActive, setVoiceActive] = useState(false);
  const [contactWarning, setContactWarning] = useState(false);
  const [pending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const finish = (message: ChatMessage) => {
    onSent(message);
    onCancelReply();
  };

  const send = (confirmed = false) => {
    const text = body.trim();
    if (!text) return;
    if (!confirmed && mentionsContactDetails(text)) {
      setContactWarning(true);
      return;
    }
    setContactWarning(false);
    startTransition(async () => {
      const result = await sendMessageAction(conversationId, { body: text, replyToId: replyTo?.id });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setBody("");
      finish(result.data);
    });
  };

  async function sendVoiceNote(file: File, durationSeconds: number): Promise<boolean> {
    const check = validateFileMetadata(upload.purpose, file);
    if (!check.ok) {
      toast.error(check.error);
      return false;
    }
    const path = `${upload.folder}/${storageFileName(file.name, crypto.randomUUID())}`;
    try {
      await uploadWithProgress({ bucket: UPLOAD_RULES[upload.purpose].bucket, path, file });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Your voice note couldn't be uploaded.");
      return false;
    }
    const result = await sendAttachmentAction(conversationId, { path, filename: "Voice note", durationSeconds, replyToId: replyTo?.id });
    if (!result.ok) {
      toast.error(result.error);
      return false;
    }
    finish(result.data);
    return true;
  }

  return (
    <div className="border-t border-border p-3 sm:p-4">
      {replyTo ? (
        <div className="mb-2 flex items-start gap-2 rounded-xl border-l-4 border-brand bg-mist/60 px-3 py-2 text-xs">
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Replying to {replyToName}</p>
            <p className="line-clamp-1 break-words text-ink-soft">{messageSnippet(replyTo)}</p>
          </div>
          <button type="button" onClick={onCancelReply} className="rounded p-0.5 text-ink/60 hover:text-ink" aria-label="Cancel reply">
            <X className="size-4" />
          </button>
        </div>
      ) : null}

      {contactWarning ? (
        <div role="alert" className="mb-2 flex flex-col gap-2 rounded-xl border border-sun bg-sun-soft p-3 text-sm">
          <p className="flex items-start gap-2 text-warning-text">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              <strong>Sharing contact or payment details?</strong> Keep the conversation and payment on Workido. Disputes, refunds and verified reviews only
              cover work agreed and paid for here.
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setContactWarning(false);
                textareaRef.current?.focus();
              }}
            >
              Edit message
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => send(true)} disabled={pending}>
              Send anyway
            </Button>
          </div>
        </div>
      ) : null}

      {showUpload ? (
        <div className="mb-3">
          <FileUpload
            purpose={upload.purpose}
            folder={upload.folder}
            label="Attach a file or image"
            onUploaded={async ({ path, file }) => {
              const result = await sendAttachmentAction(conversationId, { path, filename: file.name, replyToId: replyTo?.id });
              if (result.ok) {
                finish(result.data);
                setShowUpload(false);
              }
              return result;
            }}
          />
        </div>
      ) : null}

      {toolbar ? <div className="mb-2 flex flex-wrap gap-2">{toolbar}</div> : null}

      <form
        className="flex items-end gap-1.5"
        onSubmit={(event) => {
          event.preventDefault();
          send();
        }}
      >
        {!voiceActive ? (
          <Button type="button" variant="ghost" size="icon" aria-label="Attach a file" aria-pressed={showUpload} onClick={() => setShowUpload((value) => !value)}>
            <Paperclip className="size-5" />
          </Button>
        ) : null}
        <VoiceRecorder disabled={pending} onActiveChange={setVoiceActive} onSend={sendVoiceNote} />
        {!voiceActive ? (
          <>
            <Textarea
              ref={textareaRef}
              aria-label="Message"
              rows={1}
              maxLength={4000}
              value={body}
              placeholder="Write a message…"
              className="min-h-11 flex-1 resize-none py-2.5"
              onChange={(event) => {
                setBody(event.target.value);
                if (contactWarning) setContactWarning(false);
              }}
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
          </>
        ) : null}
      </form>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Keep chats and payments on Workido. Never share passwords or pay outside the platform. {live ? "" : "(Updates every few seconds)"}
      </p>
    </div>
  );
}
