"use client";

import { Paperclip, Upload } from "lucide-react";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/actions/result";
import { acceptAttribute, storageFileName, UPLOAD_RULES, validateFileMetadata, type UploadPurpose } from "@/lib/storage/file-validation";
import { uploadWithProgress } from "@/lib/storage/upload-client";
import { formatFileSize } from "@/lib/format";
import { cn } from "@/lib/utils";

interface UploadedFile {
  path: string;
  file: File;
}

/**
 * Upload control: validates locally, uploads with a progress bar, then asks
 * the server to verify and record the file (`onUploaded`).
 */
export function FileUpload({
  purpose,
  folder,
  onUploaded,
  label = "Upload a file",
  compact = false,
  disabled = false,
}: {
  purpose: UploadPurpose;
  /** Storage folder, e.g. "<orderId>/deliverables". */
  folder: string;
  onUploaded: (upload: UploadedFile) => Promise<ActionResult<unknown>>;
  label?: string;
  compact?: boolean;
  disabled?: boolean;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [current, setCurrent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const rules = UPLOAD_RULES[purpose];

  async function handleFile(file: File) {
    setError(null);
    const check = validateFileMetadata(purpose, file);
    if (!check.ok) {
      setError(check.error);
      return;
    }
    const path = `${folder}/${storageFileName(file.name, crypto.randomUUID())}`;
    setCurrent(file.name);
    setProgress(0);
    try {
      await uploadWithProgress({ bucket: rules.bucket, path, file, onProgress: setProgress });
      const result = await onUploaded({ path, file });
      if (!result.ok) {
        setError(result.error);
      } else {
        toast.success(`${file.name} uploaded`);
      }
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed.");
    } finally {
      setProgress(null);
      setCurrent(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const busy = progress !== null;

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        className="sr-only"
        accept={acceptAttribute(purpose)}
        disabled={disabled || busy}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
      {compact ? (
        <Button type="button" variant="outline" size="sm" disabled={disabled || busy} onClick={() => inputRef.current?.click()}>
          <Paperclip aria-hidden /> {busy ? "Uploading…" : label}
        </Button>
      ) : (
        <label
          htmlFor={inputId}
          className={cn(
            "flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-ink/15 bg-card px-4 py-6 text-center transition-colors hover:border-ink/30 hover:bg-mist/50",
            (disabled || busy) && "pointer-events-none opacity-60",
          )}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            const file = event.dataTransfer.files?.[0];
            if (file) void handleFile(file);
          }}
        >
          <Upload className="size-5 text-ink/60" aria-hidden />
          <span className="text-sm font-semibold text-ink">{label}</span>
          <span className="text-xs text-muted-foreground">Up to {formatFileSize(rules.maxBytes)} · drag & drop or tap to choose</span>
        </label>
      )}
      {busy ? (
        <div className="flex flex-col gap-1" aria-live="polite">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span className="truncate">{current}</span>
            <span>{Math.round((progress ?? 0) * 100)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-mist" role="progressbar" aria-valuenow={Math.round((progress ?? 0) * 100)} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${Math.round((progress ?? 0) * 100)}%` }} />
          </div>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
