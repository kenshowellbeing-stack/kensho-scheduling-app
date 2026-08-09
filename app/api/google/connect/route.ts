import { NextResponse } from "next/server";
import { getGoogleAuthUrl } from "@/lib/googleCalendar";

// Visit this URL in your browser to connect your Google account. It sends
// you to Google's own consent screen, then Google redirects back to
// /api/google/callback once you click "Allow".
export async function GET() {
  const url = getGoogleAuthUrl();
  return NextResponse.redirect(url);
}
