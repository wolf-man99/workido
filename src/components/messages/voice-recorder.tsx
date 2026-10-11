"use client";

import { Mic, Send, Square, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { baseMimeType } from "@/lib/storage/file-validation";

/** Longest voice note we record. */
export const MAX_VOICE_NOTE_SECONDS = 180;

const PREFERRED_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
const EXTENSIONS: Record<string, string> = { "audio/webm": "webm", "audio/ogg": "ogg", "audio/mp4": "m4a" };

function formatClock(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

type State =
  | { kind: "idle" }
  | { kind: "recording"; startedAt: number }
  | { kind: "preview"; file: File; url: string; seconds: number }
  | { kind: "sending"; file: File; url: string; seconds: number };

/**
 * Records a voice note in the browser (MediaRecorder), lets the sender listen
 * back, then hands the file to `onSend`. Nothing is uploaded until "Send".
 */
export function VoiceRecorder({
  disabled,
  onActiveChange,
  onSend,
}: {
  disabled?: boolean;
  onActiveChange?: (active: boolean) => void;
  onSend: (file: File, durationSeconds: number) => Promise<boolean>;
}) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const [elapsed, setElapsed] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const discardRef = useRef(false);

  const setActive = (next: State) => {
    setState(next);
    onActiveChange?.(next.kind !== "idle");
  };

  // Ticking timer and the length limit while recording.
  useEffect(() => {
    if (state.kind !== "recording") return;
    const timer = setInterval(() => {
      const seconds = Math.floor((Date.now() - state.startedAt) / 1000);
      setElapsed(seconds);
      if (seconds >= MAX_VOICE_NOTE_SECONDS) recorderRef.current?.stop();
    }, 250);
    return () => clearInterval(timer);
  }, [state]);

  // Release the microphone and the preview URL when leaving the page.
  const urlRef = useRef<string | null>(null);
  useEffect(
    () => () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [],
  );
  const releaseUrl = () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
  };

  async function start() {
    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      toast.error("Voice notes aren't supported in this browser.");
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      toast.error("Allow microphone access to record a voice note.");
      return;
    }
    const mimeType = PREFERRED_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    streamRef.current = stream;
    recorderRef.current = recorder;
    chunksRef.current = [];
    discardRef.current = false;
    const startedAt = Date.now();

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      if (discardRef.current) {
        setActive({ kind: "idle" });
        return;
      }
      const type = baseMimeType(recorder.mimeType || mimeType || "audio/webm");
      const blob = new Blob(chunksRef.current, { type });
      const seconds = Math.min(MAX_VOICE_NOTE_SECONDS, Math.max(1, Math.round((Date.now() - startedAt) / 1000)));
      if (blob.size === 0) {
        toast.error("Nothing was recorded. Please try again.");
        setActive({ kind: "idle" });
        return;
      }
      const file = new File([blob], `voice-note-${new Date(startedAt).toISOString().replace(/[:.]/g, "-")}.${EXTENSIONS[type] ?? "webm"}`, { type });
      urlRef.current = URL.createObjectURL(blob);
      setActive({ kind: "preview", file, url: urlRef.current, seconds });
    };

    setElapsed(0);
    recorder.start(250);
    setActive({ kind: "recording", startedAt });
  }

  function stop(discard: boolean) {
    discardRef.current = discard;
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }

  function discardPreview() {
    releaseUrl();
    setActive({ kind: "idle" });
  }

  async function send() {
    if (state.kind !== "preview") return;
    const { file, url, seconds } = state;
    setState({ kind: "sending", file, url, seconds });
    const sent = await onSend(file, seconds);
    if (sent) {
      releaseUrl();
      setActive({ kind: "idle" });
    } else {
      setState({ kind: "preview", file, url, seconds });
    }
  }

  if (state.kind === "idle") {
    return (
      <Button type="button" variant="ghost" size="icon" aria-label="Record a voice note" disabled={disabled} onClick={() => void start()}>
        <Mic className="size-5" />
      </Button>
    );
  }

  if (state.kind === "recording") {
    return (
      <div className="flex flex-1 items-center gap-3 rounded-xl border border-danger/30 bg-danger-soft/40 px-3 py-2" role="status" aria-live="polite">
        <span className="size-2.5 animate-pulse rounded-full bg-danger" aria-hidden />
        <span className="text-sm font-semibold tabular-nums">Recording {formatClock(elapsed)}</span>
        <span className="text-xs text-muted-foreground">max {formatClock(MAX_VOICE_NOTE_SECONDS)}</span>
        <div className="ml-auto flex gap-1">
          <Button type="button" variant="ghost" size="icon" aria-label="Cancel recording" onClick={() => stop(true)}>
            <X className="size-5" />
          </Button>
          <Button type="button" size="icon" aria-label="Stop recording" onClick={() => stop(false)}>
            <Square className="size-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center gap-2 rounded-xl border border-border bg-mist/50 px-2 py-1.5">
      <audio src={state.url} controls preload="metadata" className="h-9 min-w-0 flex-1" aria-label="Voice note preview" />
      <Button type="button" variant="ghost" size="icon" aria-label="Discard voice note" disabled={state.kind === "sending"} onClick={discardPreview}>
        <Trash2 className="size-5" />
      </Button>
      <Button type="button" size="icon" aria-label="Send voice note" disabled={state.kind === "sending"} onClick={() => void send()}>
        <Send className="size-4" />
      </Button>
    </div>
  );
}
