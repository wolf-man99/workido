import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const PRIVATE_BUCKETS = new Set(["requirement-files", "order-files", "chat-files"]);
/** Types that are safe to show inline (voice notes, image previews in chat). */
const INLINE_TYPES = /^(audio\/(webm|ogg|mp4|mpeg|wav)|image\/(png|jpeg|gif|webp))$/;

/**
 * Permission-checked access to private files. Signing happens with the
 * user's own session, so Storage RLS decides access (participants only).
 * Files are forced to download, except audio and images requested with
 * `inline=1`, which the chat plays or previews.
 */
export async function GET(request: NextRequest) {
  const bucket = request.nextUrl.searchParams.get("bucket") ?? "";
  const path = request.nextUrl.searchParams.get("path") ?? "";
  const name = (request.nextUrl.searchParams.get("name") ?? "download").slice(0, 200);
  const wantsInline = request.nextUrl.searchParams.get("inline") === "1";

  if (!PRIVATE_BUCKETS.has(bucket) || !path || path.includes("..")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const storage = supabase.storage.from(bucket);
  let inline = false;
  if (wantsInline) {
    const { data: info } = await storage.info(path);
    inline = INLINE_TYPES.test(info?.contentType ?? "");
  }

  const { data, error } = inline ? await storage.createSignedUrl(path, 300) : await storage.createSignedUrl(path, 60, { download: name });
  if (error || !data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const response = NextResponse.redirect(data.signedUrl, 302);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
