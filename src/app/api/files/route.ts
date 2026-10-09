import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const PRIVATE_BUCKETS = new Set(["requirement-files", "order-files"]);

/**
 * Permission-checked download for private files. Signing happens with the
 * user's own session, so Storage RLS decides access (participants only).
 * Returns a 60-second signed URL forced to download (never rendered inline).
 */
export async function GET(request: NextRequest) {
  const bucket = request.nextUrl.searchParams.get("bucket") ?? "";
  const path = request.nextUrl.searchParams.get("path") ?? "";
  const name = (request.nextUrl.searchParams.get("name") ?? "download").slice(0, 200);

  if (!PRIVATE_BUCKETS.has(bucket) || !path || path.includes("..")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60, { download: name });
  if (error || !data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const response = NextResponse.redirect(data.signedUrl, 302);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
