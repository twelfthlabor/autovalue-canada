import { NextResponse } from "next/server";
import { isAllowedListingHost, parseListingHtml, validateListingUrl } from "@/lib/listing-import";

export const dynamic = "force-dynamic";

const MAX_BYTES = 2_000_000;
const TIMEOUT_MS = 8000;

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
  try {
    const body = await request.json().catch(() => null);
    const check = validateListingUrl(String(body?.url ?? ""));
    if (!check.ok) return NextResponse.json({ ok: false, reason: check.reason }, { status: 400 });

    const response = await fetch(check.url, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "AutoValue-Canada/0.3 listing-import (one page per request; contact: portfolio demo)",
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: "follow",
      cache: "no-store",
    });

    // Redirects are followed by the platform, so re-check the host that
    // actually served the response before reading anything.
    if (!isAllowedListingHost(new URL(response.url).hostname)) {
      return NextResponse.json({ ok: false, reason: "That link redirected away from the supported listing sites." }, { status: 502 });
    }
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
