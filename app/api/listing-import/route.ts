import { NextResponse } from "next/server";
import { fetchListingPage, parseListingHtml, validateListingUrl } from "@/lib/listing-import";

export const dynamic = "force-dynamic";

const MAX_BYTES = 2_000_000;
const TIMEOUT_MS = 8000;

// Fixed-window limiter mirrored from /api/vin-decode: per-instance state is
// enough for a single-region demo and keeps the route from becoming an open
// fetch relay.
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;
const hits = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(clientKey: string) {
  const now = Date.now();
  const entry = hits.get(clientKey);
  if (!entry || entry.resetAt <= now) {
    hits.set(clientKey, { count: 1, resetAt: now + RATE_WINDOW_MS });
    if (hits.size > 10_000) for (const [key, value] of hits) if (value.resetAt <= now) hits.delete(key);
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT;
}

// A cross-site form or text/plain fetch is a "simple" request, so it skips the
// CORS preflight; demanding JSON plus a matching Origin blocks it here instead.
function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}

// Streams the body and stops at the cap instead of buffering an unbounded
// response; `undefined` means the page was larger than the cap.
async function readCapped(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) {
      await reader.cancel();
      return undefined;
    }
    chunks.push(value);
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(body);
}

export async function POST(request: Request) {
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  if (isRateLimited(clientIp)) {
    return NextResponse.json({ ok: false, reason: "Too many listing imports from this address. Please wait a minute and try again." }, { status: 429 });
  }
  if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) {
    return NextResponse.json({ ok: false, reason: "Send the listing URL as JSON." }, { status: 415 });
  }
  if (!sameOrigin(request)) {
    return NextResponse.json({ ok: false, reason: "Cross-site requests are not accepted." }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => null);
    const check = validateListingUrl(String(body?.url ?? ""));
    if (!check.ok) return NextResponse.json({ ok: false, reason: check.reason }, { status: 400 });

    const result = await fetchListingPage(check.url, fetch, AbortSignal.timeout(TIMEOUT_MS));
    if (!result.ok) return NextResponse.json({ ok: false, reason: result.reason }, { status: 502 });
    const response = result.response;
    if (!response.ok) {
      return NextResponse.json({ ok: false, reason: `The listing site responded with ${response.status}. Enter the details manually.` }, { status: 502 });
    }
    if (!response.headers.get("content-type")?.includes("text/html")) {
      return NextResponse.json({ ok: false, reason: "That link did not return a listing page. Enter the details manually." }, { status: 502 });
    }

    const html = await readCapped(response);
    if (html === undefined) {
      return NextResponse.json({ ok: false, reason: "That page is too large to read. Enter the details manually." }, { status: 502 });
    }

    const { fields, note } = parseListingHtml(html);
    if (Object.keys(fields).length === 0) return NextResponse.json({ ok: false, reason: note }, { status: 422 });
    return NextResponse.json({ ok: true, fields, note });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    return NextResponse.json({
      ok: false,
      reason: timedOut ? "The listing site timed out. Enter the details manually." : "That listing could not be fetched. Enter the details manually.",
    }, { status: 502 });
  }
}
