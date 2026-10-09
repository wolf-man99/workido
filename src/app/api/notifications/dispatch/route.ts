import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getServerEnv } from "@/lib/config/server-env";
import { dispatchNotificationEmails } from "@/lib/notifications/dispatcher";

function authorised(request: NextRequest): boolean {
  const secret = getServerEnv().CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

/**
 * Scheduled email dispatch (e.g. Vercel Cron every few minutes).
 * Requires `Authorization: Bearer <CRON_SECRET>`.
 */
async function handle(request: NextRequest) {
  if (!authorised(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const summary = await dispatchNotificationEmails();
    return NextResponse.json(summary);
  } catch (error) {
    console.error("[notifications] dispatch failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Dispatch failed" }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
