"use client";

import { getPublicEnv } from "@/lib/config/public-env";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Uploads a file straight to Supabase Storage with progress reporting.
 * Authorisation is enforced by storage RLS policies using the user's JWT.
 */
export async function uploadWithProgress({
  bucket,
  path,
  file,
  upsert = false,
  onProgress,
}: {
  bucket: string;
  path: string;
  file: File;
  upsert?: boolean;
  onProgress?: (fraction: number) => void;
}): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Your session has expired. Please log in again.");

  const env = getPublicEnv();
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  const url = `${env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "")}/storage/v1/object/${bucket}/${encodedPath}`;

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader("Authorization", `Bearer ${session.access_token}`);
    xhr.setRequestHeader("apikey", env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    xhr.setRequestHeader("x-upsert", upsert ? "true" : "false");
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.setRequestHeader("Cache-Control", "max-age=3600");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded / event.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(1);
        resolve();
        return;
      }
      let message = "Upload failed. Please try again.";
      try {
        const body = JSON.parse(xhr.responseText) as { message?: string; error?: string };
        if (xhr.status === 413 || /size/i.test(body.message ?? "")) message = "That file is too large.";
        else if (/mime|type/i.test(body.message ?? "")) message = "This file type isn't supported here.";
        else if (xhr.status === 403 || /security|policy/i.test(body.message ?? "")) message = "You don't have permission to upload here.";
      } catch {
        // Keep the generic message.
      }
      reject(new Error(message));
    };
    xhr.onerror = () => reject(new Error("Network error during upload. Check your connection and try again."));
    xhr.send(file);
  });
}
