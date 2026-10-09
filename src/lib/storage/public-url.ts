import { getPublicEnv } from "@/lib/config/public-env";

export type PublicBucket = "avatars" | "portfolio";

/** Public URL for an object in a public bucket (avatars, portfolio). */
export function publicStorageUrl(bucket: PublicBucket, path: string): string {
  const base = getPublicEnv().NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "");
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  return `${base}/storage/v1/object/public/${bucket}/${encodedPath}`;
}
