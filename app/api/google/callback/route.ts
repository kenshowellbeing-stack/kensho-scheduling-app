import { NextResponse } from "next/server";
import { saveGoogleTokensFromCode } from "@/lib/googleCalendar";

// Google redirects here after you click "Allow" on the consent screen, with
// a one-time ?code=... we exchange for a refresh token. Runs once, ever
// (unless you disconnect and reconnect).
export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get("code");
  if (!code) {
    return new NextResponse("Missing ?code from Google. Try connecting again.", {
      status: 400,
    });
  }

  try {
    await saveGoogleTokensFromCode(code);
  } catch (err) {
    console.error("Google Calendar connect failed:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return new NextResponse(`Couldn't connect Google Calendar: ${message}`, {
      status: 500,
    });
  }

  return new NextResponse(
    "Google Calendar connected! You can close this tab. New confirmed bookings will now appear on your calendar automatically.",
    { status: 200 }
  );
}
