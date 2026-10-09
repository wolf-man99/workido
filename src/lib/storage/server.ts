import "server-only";
import type { ServerSupabaseClient } from "@/lib/supabase/server";
import { UPLOAD_RULES, verifyFileSignature, type UploadPurpose } from "./file-validation";

export interface InspectedUpload {
  size: number;
  contentType: string;
}

/**
 * Verifies an object the user just uploaded: it must exist (the user can
 * read it under storage RLS), respect the size limit, and its leading bytes
 * must match the declared type. Invalid objects are deleted.
 */
export async function inspectUploadedObject(
  supabase: ServerSupabaseClient,
  purpose: UploadPurpose,
  path: string,
): Promise<{ ok: true; upload: InspectedUpload } | { ok: false; error: string }> {
  const rules = UPLOAD_RULES[purpose];
  const bucket = supabase.storage.from(rules.bucket);

  const { data: info, error } = await bucket.info(path);
  if (error || !info) return { ok: false, error: "We couldn't find that upload. Please try again." };

  const size = info.size ?? 0;
  const contentType = info.contentType ?? "";
  const reject = async (message: string) => {
    await bucket.remove([path]);
    return { ok: false as const, error: message };
  };

  if (size <= 0 || size > rules.maxBytes) return reject("The file is empty or too large.");
  if (!rules.mimeTypes.includes(contentType)) return reject("This file type isn't supported here.");

  const { data: signed, error: signError } = await bucket.createSignedUrl(path, 60);
  if (signError || !signed) return reject("We couldn't verify that upload.");
  const response = await fetch(signed.signedUrl, { headers: { Range: "bytes=0-4095" }, cache: "no-store" });
  if (!response.ok) return reject("We couldn't verify that upload.");
  const head = new Uint8Array(await response.arrayBuffer()).slice(0, 4096);

  const signature = verifyFileSignature(contentType, head);
  if (!signature.ok) return reject(signature.error);

  return { ok: true, upload: { size, contentType } };
}

/** Builds the URL of the permission-checked download route for a private file. */
export function privateFileHref(bucket: "requirement-files" | "order-files", path: string, filename: string): string {
  const params = new URLSearchParams({ bucket, path, name: filename });
  return `/api/files?${params.toString()}`;
}
